// Prepares the isolated E2E database: fresh schema, [DEV] fixtures, and a
// test administrator whose credentials come from the environment (never
// committed). Run automatically by the Playwright webServer command.
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { hash } from '@node-rs/argon2';

const root = process.cwd();
const dbUrl = process.env.E2E_DATABASE_URL ?? `file:${root}/data/e2e.db`;
const dbFile = dbUrl.replace(/^file:/, '');

try {
	rmSync(dbFile);
} catch {
	// first run: file doesn't exist
}

const migrate = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
	stdio: 'inherit',
	env: { ...process.env, DATABASE_URL: dbUrl }
});
if (migrate.status !== 0) process.exit(1);

const seed = spawnSync('node', ['prisma/seed-dev.mjs'], {
	stdio: 'inherit',
	env: { ...process.env, DATABASE_URL: dbUrl }
});
if (seed.status !== 0) process.exit(1);

const tempPassword = process.env.TEST_ADMIN_TEMP_PASSWORD;
if (!tempPassword || tempPassword.length < 10) {
	console.error('[e2e-prepare] TEST_ADMIN_TEMP_PASSWORD is missing or too short.');
	process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: dbUrl }) });
try {
	const passwordHash = await hash(tempPassword, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
	await prisma.administrator.create({
		data: { username: 'admin', passwordHash, mustChangePassword: true }
	});
	console.log('[e2e-prepare] ready: migrations applied, [DEV] fixtures seeded, test admin created');
} finally {
	await prisma.$disconnect();
}
