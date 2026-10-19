import { expect, test } from '@playwright/test';
import { login } from './helpers';

// Release-readiness coverage: health checks, SEO metadata, YouTube
// click-to-load privacy behavior, keyboard-operable media controls, and an
// end-to-end malicious-input probe against real page rendering.

test('GET /healthz reports ok with a live database', async ({ request }) => {
	const res = await request.get('/healthz');
	expect(res.status()).toBe(200);
	expect(await res.json()).toEqual({ ok: true });
});

test('SEO metadata renders per page type', async ({ page }) => {
	await page.goto('/');
	expect(await page.title()).toContain('Daniel Shabrokh');
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/$/);
	await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);

	await page.goto('/insights/dev-example-insight');
	await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
		'href',
		/\/insights\/dev-example-insight$/
	);

	await page.goto('/admin/login');
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
});

test('YouTube third-party frame loads only after an explicit click', async ({ page }) => {
	await page.goto('/watch/dev-fixture-video');

	// No iframe and no third-party request before the visitor consents to load.
	expect(await page.locator('iframe').count()).toBe(0);
	const facade = page.locator('.embed .facade');
	await expect(facade).toBeVisible();

	await facade.click();
	const iframe = page.locator('.embed iframe');
	await expect(iframe).toBeVisible();
	await expect(iframe).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/aqz-KE-bpKQ/);
});

test('audio player controls are fully keyboard-operable', async ({ page }) => {
	await page.goto('/listen/dev-fixture-episode');
	await page.getByRole('button', { name: 'Play episode' }).click();
	await expect(page.locator('.player-bar')).toBeVisible();

	// The shared toggle must be reachable by keyboard alone.
	let onToggle = false;
	for (let i = 0; i < 30 && !onToggle; i++) {
		await page.keyboard.press('Tab');
		onToggle = await page.evaluate(() =>
			document.activeElement?.classList.contains('pb-toggle') ?? false
		);
	}
	expect(onToggle, 'player toggle should be reachable via Tab').toBe(true);

	// While playing, the toggle is labeled "Pause" (the action it offers);
	// Enter pauses it and the label flips to "Play". Scoped to the player bar —
	// the episode page's own play button also flips to "Pause" while playing.
	const barToggle = (name: string) =>
		page.locator('.player-bar').getByRole('button', { name, exact: true });
	await expect(barToggle('Pause')).toBeVisible();
	await page.keyboard.press('Enter');
	await expect(barToggle('Play')).toBeVisible();
	await page.keyboard.press('Enter');
	await expect(barToggle('Pause')).toBeVisible();

	// The seek slider responds to arrow keys once metadata is loaded.
	const slider = page.locator('.pb-seek input[type="range"]');
	await expect(slider).toBeEnabled();
	await slider.focus();
	const before = Number(await slider.inputValue());
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	const after = Number(await slider.inputValue());
	expect(after).toBeGreaterThan(before);
});

test('published Markdown cannot inject scripts, handlers, or javascript: URLs', async ({ page }) => {
	await login(page);
	await page.goto('/admin/insights/new');
	await page.getByLabel('Title', { exact: true }).fill('XSS probe article');
	await page.getByLabel('Slug').fill('xss-probe-article');
	await page
		.getByLabel('Body (Markdown)')
		.fill(
			'<script>window.__xss = "script"</script>\n\n<img src="broken" onerror="window.__xss = \'img-onerror\'">\n\n<a href="javascript:window.__xss=\'js-url\'">bad link</a>\n\nSafe paragraph.'
		);
	await page.getByRole('button', { name: 'Publish', exact: true }).click();
	await expect(page.getByText('Published.')).toBeVisible();

	await page.goto('/insights/xss-probe-article');
	await expect(page.getByText('Safe paragraph.')).toBeVisible();
	expect(
		await page.locator('.prose script, .prose [onerror], .prose a[href^="javascript:"]').count()
	).toBe(0);
	const fired = await page.evaluate(() =>
		(window as unknown as Record<string, unknown>).__xss ?? null
	);
	expect(fired, 'no payload must execute').toBeNull();
});
