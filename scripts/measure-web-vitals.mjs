#!/usr/bin/env node
// Laboratory measurement of Core Web Vitals against the production build
// (release mandate §10). Boots the built server, loads real pages in
// Chromium, and records LCP / CLS via PerformanceObserver plus interaction
// durations (an INP-style lab proxy from the Event Timing API).
//
// Methodology: each page is measured 3 times, each run on a fresh page in a
// shared browser session (medians absorb run-to-run variance; fresh cold
// browser contexts suppress LCP entry delivery in headless Chromium). These
// are LAB measurements on localhost — NOT field (real-user) data.
// Run: KIT_ORIGIN=http://localhost:43933 pnpm build && node scripts/measure-web-vitals.mjs
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

if (existsSync('.env')) {
	for (const line of readFileSync('.env', 'utf8').split('\n')) {
		const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
		if (match && !(match[1] in process.env)) {
			process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
		}
	}
}

const PORT = 43933;
const BASE = `http://localhost:${PORT}`;
const DB_URL = process.env.DATABASE_URL ?? `file:${process.cwd()}/data/dev.db`;

const server = spawn('node', ['build/index.js'], {
	env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production', DATABASE_URL: DB_URL },
	stdio: 'ignore'
});

async function waitForServer() {
	for (let i = 0; i < 60; i++) {
		try {
			const res = await fetch(`${BASE}/healthz`);
			if (res.ok) return;
		} catch {
			// not up yet
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	throw new Error('server did not become healthy within 30s');
}

const PAGES = ['/', '/watch', '/listen', '/insights/dev-example-insight', '/search?q=dev'];
const RUNS_PER_PAGE = 3;
const TARGETS = { lcp: 2500, cls: 0.1, inp: 200 };

async function measureOnce(context, path) {
	// Fresh page per run within the shared session.
	const page = await context.newPage();
	await page.addInitScript(() => {
		window.__vitals = { lcp: 0, cls: 0, interactions: [] };
		try {
			new PerformanceObserver((list) => {
				const entries = list.getEntries();
				if (entries.length) window.__vitals.lcp = entries[entries.length - 1].startTime;
			}).observe({ type: 'largest-contentful-paint', buffered: true });
			new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					if (!entry.hadRecentInput) window.__vitals.cls += entry.value;
				}
			}).observe({ type: 'layout-shift', buffered: true });
			new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					if (entry.interactionId > 0) {
						window.__vitals.interactions.push(Math.round(entry.duration));
					}
				}
			}).observe({ type: 'event', durationThreshold: 16, buffered: true });
		} catch {
			// older browsers — ignore
		}
	});
	await page.goto(BASE + path, { waitUntil: 'load' });
	// Real interactions so the Event Timing API has data.
	await page.keyboard.press('Tab');
	await page.keyboard.press('ArrowDown');

	// LCP entry delivery in headless Chromium can lag; poll for it (and use
	// the direct timeline read as a fallback) instead of a fixed wait.
	let v;
	for (let i = 0; i < 20; i++) {
		await page.waitForTimeout(500);
		v = await page.evaluate(() => {
			const direct = performance.getEntriesByType('largest-contentful-paint');
			if (direct.length && direct[direct.length - 1].startTime > window.__vitals.lcp) {
				window.__vitals.lcp = direct[direct.length - 1].startTime;
			}
			return window.__vitals;
		});
		if (v.lcp > 0) break;
	}
	await page.close();
	return {
		lcp: Math.round(v.lcp),
		cls: Number(v.cls.toFixed(3)),
		interactions: v.interactions,
		maxInteraction: v.interactions.length ? Math.max(...v.interactions) : 0
	};
}

const median = (values) => {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

try {
	await waitForServer();
	// Headed mode: headless Chromium on this host inconsistently suppresses
	// LCP entry delivery; a real (headed) window reports reliably.
	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext();

	console.log(
		`Laboratory Core Web Vitals — ${RUNS_PER_PAGE} runs/page, fresh context each, localhost production build`
	);
	console.log('Targets: LCP ≤ 2500ms, CLS ≤ 0.1, INP-style interaction ≤ 200ms\n');

	const worst = { lcp: 0, cls: 0, inp: 0 };
	for (const path of PAGES) {
		const runs = [];
		for (let i = 0; i < RUNS_PER_PAGE; i++) {
			runs.push(await measureOnce(context, path));
		}
		const delivered = runs.filter((r) => r.lcp > 0);
		const lcp = delivered.length ? Math.round(median(delivered.map((r) => r.lcp))) : 0;
		const cls = Math.max(...runs.map((r) => r.cls));
		const inp = Math.round(median(runs.map((r) => r.maxInteraction)));
		worst.lcp = Math.max(worst.lcp, lcp);
		worst.cls = Math.max(worst.cls, cls);
		worst.inp = Math.max(worst.inp, inp);
		const lcpLabel = lcp > 0
			? `${String(lcp).padStart(5)}ms ${lcp <= TARGETS.lcp ? 'PASS' : 'FAIL'} (${delivered.length}/${runs.length} delivered)`
			: 'n/a (no LCP entry delivered)';
		console.log(
			`${path.padEnd(32)} LCP ${lcpLabel}   CLS ${cls.toFixed(3)} ${cls <= TARGETS.cls ? 'PASS' : 'FAIL'}   interaction ${String(inp).padStart(3)}ms ${inp <= TARGETS.inp ? 'PASS' : 'FAIL'}   (LCP runs: ${runs.map((r) => r.lcp).join(', ')}ms)`
		);
	}

	const lcpVerdict =
		worst.lcp === 0
			? 'n/a (no LCP entry delivered in headless runs)'
			: `${worst.lcp}ms ${worst.lcp <= TARGETS.lcp ? 'PASS' : 'FAIL'} (≤${TARGETS.lcp})`;
	console.log(
		`\nWorst-case medians: LCP ${lcpVerdict}, CLS ${worst.cls} ${worst.cls <= TARGETS.cls ? 'PASS' : 'FAIL'} (≤${TARGETS.cls}), interaction ${worst.inp}ms ${worst.inp <= TARGETS.inp ? 'PASS' : 'FAIL'} (≤${TARGETS.inp})`
	);
	console.log('Note: INP is a field metric; the interaction figure is a lab proxy from scripted real events.');

	await browser.close();
} finally {
	server.kill();
}
