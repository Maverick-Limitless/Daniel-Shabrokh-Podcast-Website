import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Minimal .env loader so the CLI sees DATABASE_URL without an extra
// dependency. Shell-provided environment variables always win.
if (existsSync('.env')) {
	for (const line of readFileSync('.env', 'utf8').split('\n')) {
		const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
		if (match && !(match[1] in process.env)) {
			process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
		}
	}
}

export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrations: {
		path: 'prisma/migrations'
	},
	datasource: {
		url: process.env.DATABASE_URL ?? 'file:./dev.db'
	}
});
