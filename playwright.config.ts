import { defineConfig } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// Fixed port for the E2E server; the production build bakes this origin via
// KIT_ORIGIN so CSRF origin checks behave exactly like a deployed site.
const PORT = 43917;
const BASE = `http://localhost:${PORT}`;
const DB_PATH = `${process.cwd()}/data/e2e.db`;

// Test credentials are generated per run (or supplied by the environment);
// nothing real is ever committed.
process.env.TEST_ADMIN_TEMP_PASSWORD ??= 'e2e-temp-' + randomUUID();
process.env.TEST_ADMIN_FINAL_PASSWORD ??= 'e2e-final-' + randomUUID();

export default defineConfig({
	testDir: 'tests/e2e',
	// One worker: the auth, CMS, and player flows are ordered and share state.
	workers: 1,
	fullyParallel: false,
	reporter: [['list']],
	use: {
		baseURL: BASE
	},
	webServer: {
		command: [
			'node scripts/e2e-prepare.mjs',
			`KIT_ORIGIN=${BASE} pnpm build`,
			`DATABASE_URL=file:${DB_PATH} PORT=${PORT} NODE_ENV=production node build/index.js`
		].join(' && '),
		port: PORT,
		timeout: 180_000,
		reuseExistingServer: false,
		env: { ...process.env, E2E_DATABASE_URL: `file:${DB_PATH}` }
	}
});
