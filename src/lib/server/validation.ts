import { z } from 'zod';

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Slugs that collide with top-level routes; content must not use them. */
export const RESERVED_SLUGS = new Set([
	'admin',
	'login',
	'logout',
	'search',
	'watch',
	'listen',
	'insights',
	'about',
	'privacy',
	'preview',
	'sitemap',
	'robots',
	'api',
	'favicon'
]);

export const slugSchema = z
	.string()
	.trim()
	.toLowerCase()
	.min(3, 'Slug must be at least 3 characters')
	.max(80, 'Slug must be at most 80 characters')
	.regex(SLUG_RE, 'Use only lowercase letters, digits, and single hyphens')
	.refine((s) => !RESERVED_SLUGS.has(s), 'This slug is reserved');

export const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
export const youtubeIdSchema = z
	.string()
	.trim()
	.regex(YOUTUBE_ID_RE, 'Expected an 11-character YouTube video ID');

const httpsUrlSchema = z
	.string()
	.trim()
	.max(2048)
	.refine((v) => {
		try {
			return new URL(v).protocol === 'https:';
		} catch {
			return false;
		}
	}, 'Must be a valid https:// URL');

const rootRelativePathSchema = z
	.string()
	.trim()
	.max(2048)
	.refine((v) => v.startsWith('/') && !v.startsWith('//'), 'Must start with a single /');

/** Audio source: an approved https URL or a root-relative path (dev fixture). */
export const mediaSourceSchema = z.union([httpsUrlSchema, rootRelativePathSchema]);

/** Optional https URL or empty string (checkbox-like optional fields send ''). */
export const optionalHttpsUrl = z
	.string()
	.trim()
	.max(2048)
	.refine((v) => {
		if (v === '') return true;
		try {
			return new URL(v).protocol === 'https:';
		} catch {
			return false;
		}
	}, 'Must be a valid https:// URL or empty');

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.transform((v) => (v === '' ? undefined : v));

/** Comma-separated tag input → bounded string array. */
export const tagsField = z
	.string()
		.max(400)
		.transform((s) =>
			s
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean)
				.slice(0, 8)
				.map((t) => t.slice(0, 40))
		);

const optionalInt = (min: number, max: number, label: string) =>
	z.preprocess(
		(v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
		z
			.number({ message: `${label} must be a number` })
			.int(`${label} must be a whole number`)
			.min(min, `${label} must be at least ${min}`)
			.max(max, `${label} must be at most ${max}`)
			.optional()
	);

const featuredField = z.preprocess((v) => v === 'on' || v === true, z.boolean());

export const passwordSchema = z
	.string()
	.min(10, 'Use at least 10 characters')
	.max(200, 'Password is too long');

export const articleInputSchema = z.object({
	title: z.string().trim().min(3, 'Title must be at least 3 characters').max(160),
	slug: slugSchema,
	excerpt: z.string().trim().max(400).default(''),
	body: z.string().min(1, 'Body is required').max(50000, 'Body is too long'),
	coverImage: optionalHttpsUrl,
	authorLabel: optionalText(80),
	category: optionalText(60),
	tags: tagsField,
	featured: featuredField,
	seoTitle: optionalText(160),
	seoDescription: optionalText(300)
});

export const videoInputSchema = z.object({
	title: z.string().trim().min(3, 'Title must be at least 3 characters').max(160),
	slug: slugSchema,
	description: z.string().trim().max(2000).default(''),
	providerVideoId: youtubeIdSchema,
	thumbnailUrl: optionalHttpsUrl,
	category: optionalText(60),
	tags: tagsField,
	featured: featuredField
});

export const audioInputSchema = z.object({
	title: z.string().trim().min(3, 'Title must be at least 3 characters').max(160),
	slug: slugSchema,
	description: z.string().trim().max(2000).default(''),
	audioSourceUrl: mediaSourceSchema,
	coverImage: optionalHttpsUrl,
	durationSeconds: optionalInt(0, 86400, 'Duration'),
	episodeNumber: optionalInt(1, 9999, 'Episode number'),
	category: optionalText(60),
	tags: tagsField,
	featured: featuredField
});

export const searchQuerySchema = z.string().trim().max(120);

export type ArticleInput = z.infer<typeof articleInputSchema>;
export type VideoInput = z.infer<typeof videoInputSchema>;
export type AudioInput = z.infer<typeof audioInputSchema>;

/** Flattens a zod error into { fieldName: firstMessage } for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
	const out: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = issue.path.join('.') || '_';
		if (!(key in out)) out[key] = issue.message;
	}
	return out;
}

/** Escape % and _ so user input is matched literally inside LIKE (PRD §6.6). */
export function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, (ch: string) => `\\${ch}`);
}
