#!/usr/bin/env node
// DSMP administrator initialization and server-side password
// recovery.
//
//   pnpm admin:create -- --username <name>          initial creation
//   pnpm admin:create -- --username <name> --reset  recovery (requires shell access)
//
// The temporary password is printed once to the terminal and never stored
// or logged. The administrator must change it at first sign-in.
import { existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { hash } from '@node-rs/argon2';

// Minimal .env loader; shell-provided variables always win.
if (existsSync('.env')) {
	for (const line of readFileSync('.env', 'utf8').split('\n')) {
		const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
		if (match && !(match[1] in process.env)) {
			process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
		}
	}
}

const args = process.argv.slice(2);
const reset = args.includes('--reset');
const usernameIdx = args.indexOf('--username');
const username = usernameIdx !== -1 ? args[usernameIdx + 1] : undefined;

if (!username || !/^[A-Za-z0-9._-]{3,60}$/.test(username)) {
	console.error('Usage: pnpm admin:create -- --username <name> [--reset]');
	console.error('Username: 3–60 characters, letters/digits/dot/dash/underscore.');
	process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('DATABASE_URL is not set. Copy .env.example to .env and configure it first.');
	process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

try {
	const existing = await prisma.administrator.findFirst();

	if (existing && !reset) {
		// Never overwrite an existing administrator silently.
		console.error(`An administrator (${existing.username}) already exists. Refusing to overwrite.`);
		console.error('For password recovery, run with --reset from the server shell.');
		process.exit(1);
	}

	// Cryptographically secure temporary credential.
	const tempPassword = randomBytes(18).toString('base64url');
	const passwordHash = await hash(tempPassword, { memoryCost: 19456, timeCost: 2, parallelism: 1 });

	if (existing && reset) {
		// Recovery: rotate the credential and invalidate every session.
		await prisma.session.deleteMany({ where: { administratorId: existing.id } });
		await prisma.administrator.update({
			where: { id: existing.id },
			data: {
				username,
				passwordHash,
				mustChangePassword: true,
				passwordChangedAt: new Date()
			}
		});
	} else {
		await prisma.administrator.create({
			data: { username, passwordHash, mustChangePassword: true }
		});
	}

	await prisma.adminEvent.create({
		data: {
			type: 'admin_initialized',
			actor: username,
			detail: reset ? 'credential reset via server-side recovery' : 'initial creation'
		}
	});

	console.log('Administrator ready:', username);
	console.log('Temporary password (shown once, never stored or logged):');
	console.log(' ', tempPassword);
	console.log('Sign in at /admin/login and set a permanent password immediately.');
} finally {
	await prisma.$disconnect();
}
