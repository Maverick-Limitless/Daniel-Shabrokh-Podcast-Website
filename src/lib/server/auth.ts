import { createHash, randomBytes } from 'node:crypto';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import type { Cookies } from '@sveltejs/kit';
import { db } from './db';
import { logAdminEvent } from './audit';

// PRD §6.4 / §10: argon2id with OWASP-recommended minimum parameters.
// @node-rs/argon2 hashes with Argon2id by default; the numeric parameters
// are set explicitly to the OWASP minimums.
const ARGON2_PARAMS = {
	memoryCost: 19456, // 19 MiB
	timeCost: 2,
	parallelism: 1
} as const;

export const SESSION_COOKIE = 'dsh_session';
const SLIDE_MS = 12 * 60 * 60 * 1000; // sliding inactivity window
const REFRESH_THRESHOLD_MS = 6 * 60 * 60 * 1000; // extend when less than this remains
const ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000; // hard lifetime cap
const LOGIN_MAX_FAILURES = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LAST_SEEN_STALE_MS = 15 * 60 * 1000;

// Precomputed hash of a random password: when the username does not exist we
// still run a full argon2 verification against this, so response timing does
// not reveal whether an account exists (PRD §6.3).
const dummyHashPromise = argonHash(randomBytes(18).toString('base64'), ARGON2_PARAMS);

export function hashPassword(password: string): Promise<string> {
	return argonHash(password, ARGON2_PARAMS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
	try {
		return await argonVerify(hash, password);
	} catch {
		return false;
	}
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Rate-limit key: sha256(username|ip) — no raw PII in the audit table. */
export function loginKey(username: string, ip: string): string {
	return sha256(`${username.toLowerCase()}|${ip}`);
}

/**
 * Cookie options. `secure` is derived from the actual request protocol at
 * every call site: HTTPS deployments always get Secure cookies; plain-http
 * only occurs in local testing.
 */
function cookieOptions(maxAgeSeconds: number, secure: boolean) {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure,
		maxAge: maxAgeSeconds
	};
}

/** Creates a brand-new session row + cookie. Used at login (session regeneration) and rotation. */
export async function createSession(administratorId: string, cookies: Cookies, secure: boolean): Promise<string> {
	const token = randomBytes(32).toString('base64url');
	const now = Date.now();
	await db.session.create({
		data: {
			id: sha256(token), // DB stores only the hash (PRD §6.4)
			administratorId,
			createdAt: new Date(now),
			expiresAt: new Date(now + SLIDE_MS)
		}
	});
	cookies.set(SESSION_COOKIE, token, cookieOptions(Math.floor(SLIDE_MS / 1000), secure));
	return sha256(token);
}

export async function getSessionFromCookie(cookies: Cookies, secure: boolean) {
	const token = cookies.get(SESSION_COOKIE);
	if (!token) return null;

	const sessionId = sha256(token);
	const session = await db.session.findUnique({
		where: { id: sessionId },
		include: { administrator: true }
	});
	if (!session) return null;

	const now = Date.now();
	if (session.expiresAt.getTime() <= now || now - session.createdAt.getTime() > ABSOLUTE_MS) {
		await db.session.delete({ where: { id: sessionId } }).catch(() => {});
		return null;
	}

	// Sliding expiry: extend when the remaining window drops below the threshold,
	// never past the absolute cap.
	let expiresAt = session.expiresAt;
	if (expiresAt.getTime() - now < REFRESH_THRESHOLD_MS) {
		expiresAt = new Date(Math.min(now + SLIDE_MS, session.createdAt.getTime() + ABSOLUTE_MS));
	}

	if (expiresAt.getTime() !== session.expiresAt.getTime() || now - session.lastSeenAt.getTime() > LAST_SEEN_STALE_MS) {
		await db.session
			.update({ where: { id: sessionId }, data: { expiresAt, lastSeenAt: new Date(now) } })
			.catch(() => {});
		if (expiresAt.getTime() !== session.expiresAt.getTime()) {
			cookies.set(
				SESSION_COOKIE,
				token,
				cookieOptions(Math.floor((expiresAt.getTime() - now) / 1000), secure)
			);
		}
	}

	return {
		sessionId,
		session: { ...session, expiresAt },
		administrator: session.administrator
	};
}

export async function destroySession(cookies: Cookies): Promise<void> {
	const token = cookies.get(SESSION_COOKIE);
	if (token) {
		await db.session.delete({ where: { id: sha256(token) } }).catch(() => {});
	}
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

export async function destroyOtherSessions(administratorId: string, keepSessionId: string): Promise<void> {
	await db.session.deleteMany({
		where: { administratorId, NOT: { id: keepSessionId } }
	});
}

/** Opportunistic cleanup of expired sessions and stale audit rows. */
async function purgeExpired(): Promise<void> {
	const now = new Date();
	await db.session
		.deleteMany({
			where: {
				OR: [
					{ expiresAt: { lt: now } },
					{ createdAt: { lt: new Date(now.getTime() - ABSOLUTE_MS) } }
				]
			}
		})
		.catch(() => {});
	await db.adminEvent
		.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } } })
		.catch(() => {});
}

export type LoginResult = { ok: true } | { ok: false; message: string };

export async function attemptLogin(
	username: string,
	password: string,
	ip: string,
	cookies: Cookies,
	secure: boolean
): Promise<LoginResult> {
	const key = loginKey(username, ip);

	// Rate limit: count recent failures for this identifier (PRD §6.3).
	const failures = await db.adminEvent.count({
		where: {
			type: 'login_failed',
			identifierHash: key,
			createdAt: { gte: new Date(Date.now() - LOGIN_WINDOW_MS) }
		}
	});
	if (failures >= LOGIN_MAX_FAILURES) {
		await logAdminEvent({ type: 'login_rate_limited', detail: 'threshold reached', identifierHash: key });
		return {
			ok: false,
			message: 'Too many failed attempts. Please wait 15 minutes before trying again.'
		};
	}

	const administrator = await db.administrator.findUnique({ where: { username } });
	let valid = false;
	if (administrator) {
		valid = await verifyPassword(administrator.passwordHash, password);
	} else {
		// Equalize timing so a missing account is indistinguishable from a wrong password.
		await verifyPassword(await dummyHashPromise, password);
	}

	if (!valid || !administrator) {
		await logAdminEvent({
			type: 'login_failed',
			actor: username.slice(0, 40),
			identifierHash: key
		});
		// Generic error: never reveals whether the account exists (PRD §6.3).
		return { ok: false, message: 'Invalid username or password.' };
	}

	// A fresh token + row is created at login: the session is regenerated (PRD §6.3).
	await createSession(administrator.id, cookies, secure);
	await logAdminEvent({ type: 'login_success', actor: administrator.username });
	await purgeExpired();
	return { ok: true };
}

export type PasswordChangeResult = { ok: true } | { ok: false; message: string };

/**
 * Changes the administrator password: requires the current password, invalidates
 * every other session, rotates the current session, and records the event
 * (PRD §6.5).
 */
export async function changePassword(
	administratorId: string,
	currentPassword: string,
	newPassword: string,
	cookies: Cookies,
	secure: boolean
): Promise<PasswordChangeResult> {
	const administrator = await db.administrator.findUnique({ where: { id: administratorId } });
	if (!administrator) return { ok: false, message: 'Account not found.' };

	if (!(await verifyPassword(administrator.passwordHash, currentPassword))) {
		return { ok: false, message: 'Current password is incorrect.' };
	}

	const passwordHash = await hashPassword(newPassword);
	await db.administrator.update({
		where: { id: administratorId },
		data: {
			passwordHash,
			mustChangePassword: false,
			passwordChangedAt: new Date()
		}
	});

	// Invalidate all other sessions, then rotate the current one.
	const currentToken = cookies.get(SESSION_COOKIE);
	const currentSessionId = currentToken ? sha256(currentToken) : null;
	if (currentSessionId) {
		await destroyOtherSessions(administratorId, currentSessionId);
		await db.session.delete({ where: { id: currentSessionId } }).catch(() => {});
	}
	await createSession(administratorId, cookies, secure);

	await logAdminEvent({
		type: 'password_changed',
		actor: administrator.username,
		detail: 'other sessions invalidated'
	});
	return { ok: true };
}
