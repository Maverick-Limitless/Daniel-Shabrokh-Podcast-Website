import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { DATABASE_URL } from '$app/env/private';

// Singleton client so SvelteKit dev-mode module reloads don't open a new
// connection on every change.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
	const url = DATABASE_URL;
	if (!url) {
		// Fail clearly when required configuration is missing (PRD §9.4).
		throw new Error(
			'DATABASE_URL is not set. Copy .env.example to .env and configure the database path.'
		);
	}
	const adapter = new PrismaBetterSqlite3({ url });
	return new PrismaClient({
		adapter,
		log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
	});
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
