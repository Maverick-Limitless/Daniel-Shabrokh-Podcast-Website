import { expect, test } from '@playwright/test';
import { login, timeToSeconds } from './helpers';

// PRD §5.3 / §4.2 Journey B: one shared player, real playback with a valid
// test source, persistence across client-side navigation, deliberate error
// state for broken sources.

test('player: playback starts from the listen archive and persists across navigation', async ({ page }) => {
	await page.goto('/listen');

	await page.getByRole('button', { name: /Play \[DEV\] Fixture episode/ }).click();

	const bar = page.locator('.player-bar');
	await expect(bar).toBeVisible();
	// Exactly one audio element — no competing instances (PRD §5.3).
	expect(await page.locator('audio').count()).toBe(1);

	// Real playback with the generated 30s fixture advances the position.
	// Poll: decoding the 1.3MB fixture can take longer than a fixed wait.
	let position = '0:00';
	await expect
		.poll(async () => {
			position = (await bar.locator('.pb-time').nth(0).textContent()) ?? '0:00';
			return timeToSeconds(position);
		})
		.toBeGreaterThan(0);

	// Navigation must not reset playback (PRD §4.2 Journey B).
	await page.getByRole('link', { name: 'About' }).first().click();
	await expect(page).toHaveURL(/\/about$/);
	await expect(bar).toBeVisible();
	expect(await page.locator('audio').count()).toBe(1);
	const positionAfter = (await bar.locator('.pb-time').nth(0).textContent()) ?? '0:00';
	expect(timeToSeconds(positionAfter)).toBeGreaterThanOrEqual(timeToSeconds(position));

	// Pause and resume via the shared control.
	await page.getByRole('button', { name: 'Pause', exact: true }).click();
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

	// Closing the player removes it and stops playback.
	await page.getByRole('button', { name: 'Close player' }).click();
	await expect(bar).toHaveCount(0);
});

test('player: episode page play button drives the same single instance', async ({ page }) => {
	await page.goto('/listen/dev-fixture-episode');
	await page.getByRole('button', { name: /Play episode/ }).click();
	await expect(page.locator('.player-bar')).toBeVisible();
	expect(await page.locator('audio').count()).toBe(1);
});

test('player: a broken source shows a deliberate error state', async ({ page }) => {
	await login(page);

	await page.goto('/admin/audio/new');
	await page.getByLabel('Title').fill('Broken source episode');
	await page.getByLabel('Slug').fill('broken-source-episode');
	await page.getByLabel('Audio source URL').fill('/fixtures/does-not-exist.wav');
	await page.getByRole('button', { name: 'Save draft' }).click();
	await expect(page).toHaveURL(/\/admin\/audio\/.+\/edit$/);
	await page.getByRole('button', { name: 'Publish', exact: true }).click();
	await expect(page.getByText('Published.')).toBeVisible();

	await page.goto('/listen/broken-source-episode');
	await page.getByRole('button', { name: /Play episode/ }).click();
	await expect(page.locator('.pb-error')).toBeVisible();
	await expect(page.getByText('This audio source could not be played.', { exact: false })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});
