// Screenshot capture pipeline for the visual-QA workflow
// (DSMP-VISION-WORKFLOW-1.0.0 §4–§5). Reuses the project's Playwright
// installation. Launches the real production build on a verified-free port,
// against a freshly seeded, disposable [DEV] fixture database — never real
// data, never credentials in captures.

import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { chromium } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { hash } from '@node-rs/argon2';

const ROOT = process.cwd();

/** Refuses to run on an occupied port; never terminates other processes (§4). */
export function ensureFreePort(port) {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.once('error', (err) => {
			server.close();
			reject(
				new Error(
					`Port ${port} is already in use (code ${err.code}). ` +
						`Choose a free port via VISUAL_REVIEW_PORT. This workflow never kills unrelated processes.`
				)
			);
		});
		server.once('listening', () => server.close(() => resolve(true)));
		server.listen(port, '127.0.0.1');
	});
}

function spawnChecked(command, args, env, label) {
	const result = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, ...env } });
	if (result.status !== 0) {
		throw new Error(`${label} failed with exit code ${result.status}`);
	}
}

/**
 * Creates a disposable fixture database: fresh schema, [DEV] content, and a
 * throwaway administrator whose password is generated per run and never
 * logged, persisted, or captured (it exists only inside the capture browser
 * context). mustChangePassword is false for this fixture admin — the forced
 * password-change flow belongs to real credential provisioning and is
 * covered by the E2E suite; here it would only block dashboard captures.
 */
export async function prepareFixtureDb(dbPath) {
	try {
		rmSync(dbPath);
	} catch {
		// first run
	}
	try {
		rmSync(`${dbPath}-journal`);
	} catch {
		// ignore
	}

	spawnChecked('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], { DATABASE_URL: `file:${dbPath}` }, 'prisma migrate deploy');
	spawnChecked('node', ['prisma/seed-dev.mjs'], { DATABASE_URL: `file:${dbPath}` }, '[DEV] fixture seeding');

	const adminPassword = randomBytes(18).toString('base64url');
	const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${dbPath}` }) });
	try {
		const passwordHash = await hash(adminPassword, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
		await prisma.administrator.create({
			data: { username: 'admin', passwordHash, mustChangePassword: false }
		});
		const article = await prisma.article.findUnique({ where: { slug: 'dev-example-insight' } });
		return { adminUsername: 'admin', adminPassword, articleId: article?.id };
	} finally {
		await prisma.$disconnect();
	}
}

/** Production build with the review origin baked in (KIT_ORIGIN). */
export function buildApp(port) {
	spawnChecked('pnpm', ['build'], { KIT_ORIGIN: `http://localhost:${port}` }, 'pnpm build');
}

/** Boots the built server; resolves once /healthz answers. */
export async function startServer({ port, dbPath }) {
	const server = spawn('node', ['build/index.js'], {
		env: {
			...process.env,
			DATABASE_URL: `file:${dbPath}`,
			PORT: String(port),
			NODE_ENV: 'production'
		},
		stdio: 'ignore'
	});
	const base = `http://localhost:${port}`;

	for (let i = 0; i < 60; i++) {
		try {
			const res = await fetch(`${base}/healthz`);
			if (res.ok) {
				return {
					base,
					stop: () => {
						server.kill();
					}
				};
			}
		} catch {
			// not up yet
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	server.kill();
	throw new Error('visual-review server did not become healthy within 30s');
}

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

/**
 * Captures the review inventory (§5): desktop 1440×900, mobile 390×844,
 * tablet 768×1024, plus 320×568 — full-page by default, viewport-focused
 * shots for interaction states. Returns inventory entries with route,
 * viewport, file path, dimensions, and a stable id.
 */
export async function captureInventory({ base, outDir, adminUsername, adminPassword, articleId }) {
	const capturesDir = `${outDir}/captures`;
	mkdirSync(capturesDir, { recursive: true });

	const browser = await chromium.launch();
	const inventory = [];

	async function withContext(viewport, run) {
		const context = await browser.newContext({ viewport });
		const page = await context.newPage();
		try {
			return await run(page, context);
		} finally {
			await context.close();
		}
	}

	async function record(page, item) {
		const file = `${capturesDir}/${item.id}.png`;
		await page.screenshot({ path: file, fullPage: item.fullPage !== false });
		const bytes = statSync(file).size;
		inventory.push({
			id: item.id,
			route: item.route,
			viewport: item.viewport,
			captureType: item.fullPage === false ? 'viewport' : 'fullpage',
			file,
			bytes,
			sha256: sha256(readFileSync(file)),
			// Focused viewport variant for review when the full-page shot is too
			// large to send (exact API image-size limits are not published).
			payloadForReview: file
		});
	}

	async function login(page) {
		await page.goto(`${base}/admin/login`);
		await page.getByLabel('Username').fill(adminUsername);
		await page.getByLabel('Password').fill(adminPassword);
		await page.getByRole('button', { name: 'Sign in' }).click();
		await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
	}

	const D = '1440x900';
	const M = '390x844';
	const T = '768x1024';
	const S = '320x568';

	// ---- public desktop captures (fresh, unauthenticated context) ----
	await withContext({ width: 1440, height: 900 }, async (page) => {
		const publicShots = [
			['home-desktop', '/', true],
			['watch-archive-desktop', '/watch', true],
			['watch-detail-desktop', '/watch/dev-fixture-video', true],
			['listen-archive-desktop', '/listen', true],
			['listen-detail-desktop', '/listen/dev-fixture-episode', true],
			['insights-archive-desktop', '/insights', true],
			['article-desktop', '/insights/dev-example-insight', true],
			['search-results-desktop', '/search?q=dev', true],
			['search-empty-desktop', '/search?q=zzzz', true],
			['about-desktop', '/about', true],
			['privacy-desktop', '/privacy', true],
			['error-404-desktop', '/watch/missing-page', true]
		];
		for (const [id, route, fullPage] of publicShots) {
			await page.goto(`${base}${route}`);
			await record(page, { id, route, viewport: D, fullPage });
		}

		// Interaction state: shared audio player open (viewport-focused shot).
		await page.goto(`${base}/listen`);
		await page.getByRole('button', { name: /Play \[DEV\]/ }).click();
		await page.locator('.player-bar').waitFor();
		await record(page, { id: 'player-interaction-desktop', route: '/listen', viewport: D, fullPage: false });
	});

	// ---- admin login states (no session, no secret content) ----
	await withContext({ width: 1440, height: 900 }, async (page) => {
		await page.goto(`${base}/admin/login`);
		await record(page, { id: 'admin-login-desktop', route: '/admin/login', viewport: D, fullPage: true });

		// Representative validation state: generic wrong-credentials error.
		await page.getByLabel('Username').fill('admin');
		await page.getByLabel('Password').fill('definitely-wrong-password');
		await page.getByRole('button', { name: 'Sign in' }).click();
		await page.getByText('Invalid username or password.').waitFor();
		await record(page, { id: 'admin-login-error-desktop', route: '/admin/login', viewport: D, fullPage: true });
	});

	// ---- authenticated admin captures (throwaway fixture session) ----
	await withContext({ width: 1440, height: 900 }, async (page) => {
		await login(page);
		const adminShots = [
			['admin-dashboard-desktop', '/admin', true],
			['admin-content-list-desktop', '/admin/insights', true],
			['admin-editor-desktop', '/admin/insights/new', true],
			['admin-settings-desktop', '/admin/settings', true]
		];
		for (const [id, route, fullPage] of adminShots) {
			await page.goto(`${base}${route}`);
			await record(page, { id, route, viewport: D, fullPage });
		}
		if (articleId) {
			await page.goto(`${base}/preview/insights/${articleId}`);
			await record(page, { id: 'admin-preview-desktop', route: `/preview/insights/${articleId}`, viewport: D, fullPage: true });
		}
	});

	// ---- tablet ----
	await withContext({ width: 768, height: 1024 }, async (page) => {
		await page.goto(`${base}/`);
		await record(page, { id: 'home-tablet', route: '/', viewport: T, fullPage: true });
	});

	// ---- mobile ----
	await withContext({ width: 390, height: 844 }, async (page) => {
		for (const [id, route] of [
			['home-mobile', '/'],
			['watch-archive-mobile', '/watch'],
			['listen-archive-mobile', '/listen'],
			['article-mobile', '/insights/dev-example-insight']
		]) {
			await page.goto(`${base}${route}`);
			await record(page, { id, route, viewport: M, fullPage: true });
		}

		// Interaction state: mobile navigation open.
		await page.goto(`${base}/`);
		await page.getByRole('button', { name: 'Open menu' }).click();
		await page.locator('.nav-mobile').waitFor();
		await record(page, { id: 'nav-open-mobile', route: '/', viewport: M, fullPage: false });
	});

	// ---- smallest supported width ----
	await withContext({ width: 320, height: 568 }, async (page) => {
		await page.goto(`${base}/`);
		await record(page, { id: 'home-320', route: '/', viewport: S, fullPage: true });
	});

	// Large full-page captures: add viewport-only variants for review payload.
	for (const item of inventory) {
		if (item.captureType === 'fullpage' && item.bytes > 4 * 1024 * 1024) {
			// Re-capture a viewport-only variant for this route; interaction
			// states are captured as viewport shots already.
			const context = await browser.newContext({
				viewport: {
					width: Number(item.viewport.split('x')[0]),
					height: Number(item.viewport.split('x')[1])
				}
			});
			const page = await context.newPage();
			await page.goto(`${base}${item.route}`);
			const file = `${capturesDir}/${item.id}-viewport.png`;
			await page.screenshot({ path: file, fullPage: false });
			item.payloadForReview = file;
			item.reviewBytes = statSync(file).size;
			await context.close();
		} else {
			item.reviewBytes = item.bytes;
		}
	}

	await browser.close();

	return inventory;
}

export function writeJson(path, data) {
	writeFileSync(path, `${JSON.stringify(data, null, '\t')}\n`);
}
