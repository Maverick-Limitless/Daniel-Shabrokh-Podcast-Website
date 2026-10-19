import { defineEnvVars } from '@sveltejs/kit/env';

/**
 * Typed environment variables. Values are read at runtime from
 * the process environment and exposed as named exports of
 * `$app/env/private`. Copy .env.example to .env and fill in real values;
 * never commit secrets.
 */
export const variables = defineEnvVars({
	DATABASE_URL: {
		description:
			'SQLite database URL (file: path). Use an absolute path in production so the Prisma CLI and the app runtime resolve the same file.'
	},
	SITE_BASE_URL: {
		description:
			'Canonical public origin without trailing slash, used for canonical URLs, OG tags, robots.txt and the sitemap. Empty falls back to the request origin.',
		// Optional: an empty value falls back to the request origin.
		schema: (value) => value ?? ''
	}
});
