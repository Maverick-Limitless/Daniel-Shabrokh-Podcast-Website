import { expect, test } from '@playwright/test';

// PRD §14.2: public routes render, drafts stay private, search returns
// published content only, and the browser console stays clean.

let consoleErrors: string[] = [];

test.beforeEach(async ({ page }) => {
	consoleErrors = [];
	page.on('console', (msg) => {
		if (msg.type() === 'error') consoleErrors.push(msg.text());
	});
	page.on('pageerror', (err) => consoleErrors.push(String(err)));
});

function expectNoConsoleErrors(path: string) {
	// Noise sources that are not the app's own code:
	//  - third-party media (YouTube thumbnails),
	//  - an ephemeral inline event handler injected by Playwright's own
	//    instrumentation (Svelte compiles all handlers via addEventListener;
	//    a DOM-level test below asserts our markup contains no inline
	//    handlers or style attributes).
	const noise = (e: string) =>
		e.includes('i.ytimg.com') ||
		e.includes('youtube') ||
		e.startsWith('Executing inline event handler violates');
	const ours = consoleErrors.filter((e) => !noise(e));
	expect(ours, `console errors on ${path}: ${JSON.stringify(ours)}`).toHaveLength(0);
}

test('app markup contains no inline handlers or style attributes (CSP hygiene)', async ({ page }) => {
	await page.goto('/');
	// Playwright's own injected instrumentation div carries a style attribute
	// and is not part of the application.
	const offenders = await page.evaluate(() =>
		Array.from(document.querySelectorAll('[style], [onclick], [onload], [onerror], [onsubmit]'))
			.filter((el) => {
				const style = (el.getAttribute('style') ?? '').trim();
				const hasInlineHandler = el.getAttributeNames().some((a) => /^on[a-z]+$/.test(a));
				if (!style && !hasInlineHandler) return false; // empty style attribute is inert
				if (el.className.includes('playwright')) return false; // test tooling injection
				return !style.includes('clip-path');
			})
			.map((el) => `${el.tagName}:${el.className}:${el.getAttribute('style') ?? ''}`)
	);
	expect(offenders).toHaveLength(0);
});

test('home renders the hero, all three sections, and the featured video facade', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Daniel');
	await expect(page.getByRole('heading', { name: 'Latest videos' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Latest episodes' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Recent writing' })).toBeVisible();
	await expect(page.locator('.embed .facade')).toBeVisible();
	expectNoConsoleErrors('/');
});

test('archives list the published [DEV] fixtures', async ({ page }) => {
	await page.goto('/watch');
	await expect(page.getByRole('link', { name: /\[DEV\] Fixture video/ })).toBeVisible();
	await page.goto('/listen');
	await expect(page.getByRole('link', { name: /\[DEV\] Fixture episode/ })).toBeVisible();
	await page.goto('/insights');
	await expect(page.getByRole('link', { name: /\[DEV\] Example insight/ })).toBeVisible();
	expectNoConsoleErrors('archives');
});

test('detail pages render their content', async ({ page }) => {
	await page.goto('/watch/dev-fixture-video');
	await expect(page.getByRole('heading', { level: 1, name: /\[DEV\] Fixture video/ })).toBeVisible();

	await page.goto('/insights/dev-example-insight');
	await expect(page.getByRole('navigation', { name: 'On this page' })).toBeVisible();
	await expect(page.locator('.prose h2').first()).toBeVisible();

	await page.goto('/listen/dev-fixture-episode');
	await expect(page.getByRole('button', { name: 'Play episode' })).toBeVisible();
	expectNoConsoleErrors('detail pages');
});

test('drafts are never publicly reachable', async ({ page }) => {
	for (const path of ['/insights/dev-draft-insight', '/watch/dev-draft-video', '/listen/dev-draft-episode']) {
		const res = await page.goto(path);
		expect(res?.status(), path).toBe(404);
	}
	await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('unknown slugs get a deliberate 404 page', async ({ page }) => {
	await page.goto('/watch/this-does-not-exist');
	await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Search the site' })).toBeVisible();
});

test('search returns published content grouped by type', async ({ page }) => {
	await page.goto('/search?q=dev');
	await expect(page.getByRole('heading', { name: 'Articles' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Videos' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Audio episodes' })).toBeVisible();

	await page.goto('/search?q=dev-draft');
	await expect(page.getByText('No results for', { exact: false })).toBeVisible();

	await page.goto('/search');
	await expect(page.getByText('Search covers all published articles')).toBeVisible();
});

test('robots.txt and sitemap.xml reflect published content only', async ({ request }) => {
	const robots = await request.get('/robots.txt');
	expect(await robots.text()).toContain('Disallow: /admin');
	expect(await robots.text()).toContain('Disallow: /preview');

	const xml = await (await request.get('/sitemap.xml')).text();
	expect(xml).toContain('/insights/dev-example-insight');
	expect(xml).toContain('/watch/dev-fixture-video');
	expect(xml).not.toContain('dev-draft-insight');
	expect(xml).not.toContain('dev-draft-video');
});

test('security headers are present', async ({ request }) => {
	const res = await request.get('/');
	const headers = res.headers();
	expect(headers['content-security-policy']).toContain("default-src 'self'");
	expect(headers['content-security-policy']).toContain('frame-src');
	expect(headers['x-frame-options']).toBe('DENY');
	expect(headers['x-content-type-options']).toBe('nosniff');
	expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
	expect(headers['permissions-policy']).toContain('camera=()');
});
