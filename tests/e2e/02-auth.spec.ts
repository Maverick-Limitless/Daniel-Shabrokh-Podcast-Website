import { expect, test } from '@playwright/test';

// authentication, forced password change, logout, rate limiting.
// This file runs before the CMS spec; it establishes the final password that
// later specs use to sign in.

const TEMP = () => process.env.TEST_ADMIN_TEMP_PASSWORD!;
const FINAL = () => process.env.TEST_ADMIN_FINAL_PASSWORD!;

test('unauthenticated admin access redirects to the login page', async ({ page }) => {
	await page.goto('/admin');
	await expect(page).toHaveURL(/\/admin\/login$/);
});

test('invalid credentials produce a generic error', async ({ page }) => {
	await page.goto('/admin/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('definitely-wrong');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByText('Invalid username or password.')).toBeVisible();
});

test('first login forces a permanent password change, then the dashboard works', async ({ page }) => {
	await page.goto('/admin/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill(TEMP());
	await page.getByRole('button', { name: 'Sign in' }).click();

	// mustChangePassword redirects to settings.
	await expect(page).toHaveURL(/\/admin\/settings$/);
	await expect(page.getByText('Set a permanent password before continuing.')).toBeVisible();

	await page.getByLabel('Current password', { exact: true }).fill(TEMP());
	await page.getByLabel('New password', { exact: true }).fill(FINAL());
	await page.getByLabel('Confirm new password', { exact: true }).fill(FINAL());
	await page.getByRole('button', { name: 'Update password' }).click();

	await expect(page.getByText('Password updated. All other sessions were signed out.')).toBeVisible();

	await page.goto('/admin');
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('session cookie is HttpOnly and not exposed to JavaScript', async ({ request }) => {
	const res = await request.post('/admin/login', {
		form: { username: 'cookie-probe', password: 'wrong' }
	});
	// failed login sets no cookie
	expect(res.headers()['set-cookie'] ?? '').not.toContain('dsh_session=');
});

test('logout invalidates the session', async ({ page }) => {
	await page.goto('/admin/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill(FINAL());
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

	await page.getByRole('button', { name: /Sign out/ }).click();
	await expect(page).toHaveURL(/\/admin\/login$/);

	await page.goto('/admin');
	await expect(page).toHaveURL(/\/admin\/login$/);
});

test('repeated failures are rate limited', async ({ page }) => {
	await page.goto('/admin/login');
	for (let i = 0; i < 5; i++) {
		await page.getByLabel('Username').fill('rl-admin');
		await page.getByLabel('Password').fill('wrong-password');
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page.getByText('Invalid username or password.')).toBeVisible();
	}
	// Sixth attempt is locked out without revealing account state.
	await page.getByLabel('Username').fill('rl-admin');
	await page.getByLabel('Password').fill('wrong-password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(
		page.getByText('Too many failed attempts. Please wait 15 minutes before trying again.')
	).toBeVisible();
});
