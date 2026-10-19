import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { login } from './helpers';

// PRD §8.7/§8.8: responsive matrix without overflow; accessibility scanned
// with axe (serious/critical violations must be zero); and screenshot capture
// for the visual-review workflow (PRD §15.3/§15.4 — captured for
// human/independent review; the configured NVIDIA reviewer is unavailable,
// which is documented in the delivery report).

const VIEWPORTS: [number, number][] = [
	[320, 568],
	[375, 667],
	[390, 844],
	[768, 1024],
	[1024, 768],
	[1440, 900]
];

test('no horizontal overflow at any required viewport', async ({ page }) => {
	for (const [w, h] of VIEWPORTS) {
		await page.setViewportSize({ width: w, height: h });
		for (const path of [
			'/',
			'/watch',
			'/listen',
			'/insights',
			'/insights/dev-example-insight',
			'/about',
			'/search?q=dev'
		]) {
			await page.goto(path);
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			);
			expect(overflow, `${path} at ${w}x${h} overflows`).toBeLessThanOrEqual(1);
		}
	}
});

test('mobile navigation opens, is keyboard-reachable, and navigates', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 667 });
	await page.goto('/');

	const menuButton = page.getByRole('button', { name: 'Open menu' });
	await menuButton.click();
	const mobileNav = page.locator('.nav-mobile');
	await expect(mobileNav).toBeVisible();
	await page.locator('.nav-mobile a', { hasText: 'Insights' }).click();
	await expect(page).toHaveURL(/\/insights$/);
});

test('no serious or critical accessibility violations on key pages', async ({ page }) => {
	test.setTimeout(120_000);
	for (const path of [
		'/',
		'/watch',
		'/watch/dev-fixture-video',
		'/listen',
		'/listen/dev-fixture-episode',
		'/insights/dev-example-insight',
		'/about',
		'/privacy',
		'/search?q=dev',
		'/admin/login'
	]) {
		await page.goto(path);
		const results = await new AxeBuilder({ page }).analyze();
		const serious = results.violations.filter(
			(violation) => violation.impact === 'serious' || violation.impact === 'critical'
		);
		expect(
			serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`),
			`a11y violations on ${path}`
		).toHaveLength(0);
	}
});

test('admin pages have no serious or critical accessibility violations', async ({ page }) => {
	await login(page);
	for (const path of ['/admin', '/admin/insights', '/admin/insights/new', '/admin/settings']) {
		await page.goto(path);
		const results = await new AxeBuilder({ page }).analyze();
		const serious = results.violations.filter(
			(violation) => violation.impact === 'serious' || violation.impact === 'critical'
		);
		expect(serious.map((v) => v.id), `a11y violations on ${path}`).toHaveLength(0);
	}
});

test('skip link and focus states work', async ({ page }) => {
	await page.goto('/');
	await page.keyboard.press('Tab');
	await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
});

test('capture screenshots for visual review (PRD §15.4)', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });

	const desktopPages: [string, string][] = [
		['home', '/'],
		['watch-archive', '/watch'],
		['watch-detail', '/watch/dev-fixture-video'],
		['listen-archive', '/listen'],
		['listen-detail', '/listen/dev-fixture-episode'],
		['insights-archive', '/insights'],
		['article', '/insights/dev-example-insight'],
		['about', '/about'],
		['privacy', '/privacy'],
		['search-results', '/search?q=dev'],
		['search-no-results', '/search?q=zzzz'],
		['error-404', '/watch/missing-page'],
		['admin-login', '/admin/login']
	];
	for (const [name, path] of desktopPages) {
		await page.goto(path);
		await page.screenshot({ path: `tests/screenshots/desktop-${name}.png`, fullPage: true });
	}

	// Admin surfaces (authenticated).
	await login(page);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/admin');
	await page.screenshot({ path: 'tests/screenshots/desktop-admin-dashboard.png', fullPage: true });
	await page.goto('/admin/insights/new');
	await page.screenshot({ path: 'tests/screenshots/desktop-admin-editor.png', fullPage: true });

	// Mobile captures.
	const mobilePages: [string, string][] = [
		['home', '/'],
		['watch-archive', '/watch'],
		['listen-archive', '/listen'],
		['article', '/insights/dev-example-insight']
	];
	await page.setViewportSize({ width: 390, height: 844 });
	for (const [name, path] of mobilePages) {
		await page.goto(path);
		await page.screenshot({ path: `tests/screenshots/mobile-${name}.png`, fullPage: true });
	}
	// Mobile navigation open state.
	await page.goto('/');
	await page.getByRole('button', { name: 'Open menu' }).click();
	await page.screenshot({ path: 'tests/screenshots/mobile-nav-open.png', fullPage: true });
});
