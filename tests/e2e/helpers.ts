import { expect, test, type Page } from '@playwright/test';

/** Signs in with the password the auth spec established. */
export async function login(page: Page) {
	await page.goto('/admin/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill(process.env.TEST_ADMIN_FINAL_PASSWORD!);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

/** Parses an "m:ss" time label into seconds. */
export function timeToSeconds(label: string): number {
	const [m, s] = label.split(':').map(Number);
	return (m || 0) * 60 + (s || 0);
}
