import type { Handle } from '@sveltejs/kit/hooks';
import { getSessionFromCookie } from '#lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	const secure = event.url.protocol === 'https:';
	const auth = await getSessionFromCookie(event.cookies, secure).catch(() => null);
	if (auth) {
		event.locals.administrator = {
			id: auth.administrator.id,
			username: auth.administrator.username,
			mustChangePassword: auth.administrator.mustChangePassword
		};
		event.locals.sessionId = auth.sessionId;
	} else {
		event.locals.administrator = null;
		event.locals.sessionId = null;
	}

	const response = await resolve(event);

	// Security headers. HSTS is left to the HTTPS reverse proxy
	// (documented in README) because it must only be sent over TLS.
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	if (event.url.pathname.startsWith('/admin') || event.url.pathname.startsWith('/preview')) {
		response.headers.set('Cache-Control', 'no-store');
	}

	return response;
};
