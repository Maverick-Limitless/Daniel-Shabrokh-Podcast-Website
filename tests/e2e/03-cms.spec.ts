import { expect, test } from '@playwright/test';
import { login } from './helpers';

// PRD §14.4: CMS lifecycle — create draft, preview, publish, public
// visibility, unpublish, deletion; validation and duplicate-slug rejection.

test.beforeEach(async ({ page }) => {
	await login(page);
});

test('article lifecycle: draft → preview → publish → public → unpublish → delete', async ({ page }) => {
	await page.goto('/admin/insights/new');
	await page.getByLabel('Title', { exact: true }).fill('Lifecycle test article');
	await page.getByLabel('Slug').fill('lifecycle-test-article');
	await page.getByLabel('Excerpt').fill('An article created by the automated CMS test.');
	await page
		.getByLabel('Body (Markdown)')
		.fill('## First section\n\nSome **content** for the test.\n\n## Second section\n\nMore content.\n\n## Third section\n\nEnd.');
	await page.getByRole('button', { name: 'Save draft' }).click();

	await expect(page).toHaveURL(/\/admin\/insights\/.+\/edit$/);
	await expect(page.locator('.badge-draft').first()).toBeVisible();
	const editUrl = page.url();

	// Preview shows the draft with the public layout but is explicitly flagged.
	await page.getByRole('link', { name: /Preview/ }).click();
	await expect(page.getByText('Preview — not publicly visible.')).toBeVisible();
	await expect(page.getByRole('heading', { level: 1, name: 'Lifecycle test article' })).toBeVisible();

	// Not public yet.
	const beforePublish = await page.request.get('/insights/lifecycle-test-article');
	expect(beforePublish.status()).toBe(404);

	// Publish.
	await page.goto(editUrl);
	await page.getByRole('button', { name: 'Publish', exact: true }).click();
	await expect(page.getByText('Published.')).toBeVisible();

	// Now publicly visible and searchable.
	const afterPublish = await page.request.get('/insights/lifecycle-test-article');
	expect(afterPublish.status()).toBe(200);
	await page.goto('/search?q=Lifecycle');
	await expect(page.getByRole('link', { name: 'Lifecycle test article' })).toBeVisible();

	// Unpublish removes public visibility immediately.
	await page.goto(editUrl);
	await page.getByRole('button', { name: 'Unpublish' }).click();
	await expect(page.getByText('no longer publicly visible', { exact: false })).toBeVisible();
	const afterUnpublish = await page.request.get('/insights/lifecycle-test-article');
	expect(afterUnpublish.status()).toBe(404);

	// Delete requires the confirmation step (PRD §6.7).
	await page.getByText('Delete article…').click();
	await page.getByRole('button', { name: 'Confirm delete' }).click();
	await expect(page).toHaveURL(/\/admin\/insights$/);
	await expect(page.getByRole('link', { name: 'Lifecycle test article' })).toHaveCount(0);
});

test('video lifecycle: draft → publish → public → delete', async ({ page }) => {
	await page.goto('/admin/videos/new');
	await page.getByLabel('Title', { exact: true }).fill('Lifecycle test video');
	await page.getByLabel('Slug').fill('lifecycle-test-video');
	await page.getByLabel('YouTube video ID').fill('aqz-KE-bpKQ');
	await page.getByLabel('Description').fill('Test video from the automated CMS test.');
	await page.getByRole('button', { name: 'Save draft' }).click();

	await expect(page).toHaveURL(/\/admin\/videos\/.+\/edit$/);
	const editUrl = page.url();

	const draft = await page.request.get('/watch/lifecycle-test-video');
	expect(draft.status()).toBe(404);

	await page.getByRole('button', { name: 'Publish', exact: true }).click();
	await expect(page.getByText('Published.')).toBeVisible();

	const published = await page.request.get('/watch/lifecycle-test-video');
	expect(published.status()).toBe(200);

	await page.getByText('Delete video…').click();
	await page.getByRole('button', { name: 'Confirm delete' }).click();
	await expect(page).toHaveURL(/\/admin\/videos$/);
});

test('episode lifecycle: draft → publish → public', async ({ page }) => {
	await page.goto('/admin/audio/new');
	await page.getByLabel('Title', { exact: true }).fill('Lifecycle test episode');
	await page.getByLabel('Slug').fill('lifecycle-test-episode');
	await page.getByLabel('Audio source URL').fill('/fixtures/dev-tone-30s.wav');
	await page.getByLabel('Description').fill('Test episode from the automated CMS test.');
	await page.getByRole('button', { name: 'Save draft' }).click();

	await expect(page).toHaveURL(/\/admin\/audio\/.+\/edit$/);
	const editUrl = page.url();

	await page.getByRole('button', { name: 'Publish', exact: true }).click();
	await expect(page.getByText('Published.')).toBeVisible();

	const published = await page.request.get('/listen/lifecycle-test-episode');
	expect(published.status()).toBe(200);

	await page.goto(editUrl);
	await page.getByRole('button', { name: 'Unpublish' }).click();
	await expect(page.getByText('no longer publicly visible', { exact: false })).toBeVisible();
});

test('server-side validation rejects an invalid slug', async ({ page }) => {
	await page.goto('/admin/insights/new');
	await page.getByLabel('Title', { exact: true }).fill('Bad input article');
	await page.getByLabel('Slug').fill('INVALID SLUG');
	await page.getByLabel('Body (Markdown)').fill('Some body text.');
	await page.getByRole('button', { name: 'Save draft' }).click();
	await expect(page.getByText('Use only lowercase letters, digits, and single hyphens')).toBeVisible();
	// Values are preserved after the validation failure.
	await expect(page.getByLabel('Slug')).toHaveValue('INVALID SLUG');
});

test('duplicate slugs are rejected with a field error', async ({ page }) => {
	await page.goto('/admin/insights/new');
	await page.getByLabel('Title', { exact: true }).fill('Duplicate slug article');
	await page.getByLabel('Slug').fill('dev-example-insight');
	await page.getByLabel('Body (Markdown)').fill('Body text.');
	await page.getByRole('button', { name: 'Save draft' }).click();
	await expect(page.getByText('This slug is already in use')).toBeVisible();
});

test('invalid YouTube IDs are rejected', async ({ page }) => {
	await page.goto('/admin/videos/new');
	await page.getByLabel('Title', { exact: true }).fill('Bad ID video');
	await page.getByLabel('Slug').fill('bad-id-video');
	await page.getByLabel('YouTube video ID').fill('https://youtu.be/aqz-KE-bpKQ');
	await page.getByRole('button', { name: 'Save draft' }).click();
	await expect(page.getByText('Expected an 11-character YouTube video ID')).toBeVisible();
});

test('dashboard shows real counts from the database', async ({ page }) => {
	await page.goto('/admin');
	await expect(page.locator('.count-card', { hasText: 'Insights' })).toContainText('published');
	await expect(page.locator('.count-card', { hasText: 'Videos' })).toContainText('draft');
	await expect(page.getByRole('heading', { name: 'Recently updated' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible();
});
