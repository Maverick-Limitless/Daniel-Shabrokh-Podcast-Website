import { SITE_BASE_URL } from '$app/env/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const base = SITE_BASE_URL?.replace(/\/$/, '') || url.origin;
	const body = [
		'# Non-administrative areas may be crawled.',
		'# Administrative and draft-preview areas must never be indexed (PRD §11).',
		'User-agent: *',
		'Allow: /',
		'Disallow: /admin',
		'Disallow: /preview',
		'',
		`Sitemap: ${base}/sitemap.xml`,
		''
	].join('\n');

	return new Response(body, {
		headers: { 'content-type': 'text/plain; charset=utf-8' }
	});
};
