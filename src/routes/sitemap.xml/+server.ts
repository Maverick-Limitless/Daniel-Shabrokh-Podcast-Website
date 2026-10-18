import { SITE_BASE_URL } from '$app/env/private';
import { db } from '#lib/server/db';
import type { RequestHandler } from './$types';

const STATIC_PATHS = ['', '/watch', '/listen', '/insights', '/about', '/search', '/privacy'];

/** Sitemap generated from published content only (PRD §11). */
export const GET: RequestHandler = async ({ url }) => {
	const base = SITE_BASE_URL?.replace(/\/$/, '') || url.origin;

	const [articles, videos, episodes] = await Promise.all([
		db.article.findMany({ where: { status: 'published' }, select: { slug: true, updatedAt: true } }),
		db.video.findMany({ where: { status: 'published' }, select: { slug: true, updatedAt: true } }),
		db.audioEpisode.findMany({ where: { status: 'published' }, select: { slug: true, updatedAt: true } })
	]);

	const urls: string[] = [];
	for (const path of STATIC_PATHS) {
		urls.push(`  <url><loc>${base}${path}</loc></url>`);
	}
	for (const a of articles) {
		urls.push(`  <url><loc>${base}/insights/${a.slug}</loc><lastmod>${a.updatedAt.toISOString()}</lastmod></url>`);
	}
	for (const v of videos) {
		urls.push(`  <url><loc>${base}/watch/${v.slug}</loc><lastmod>${v.updatedAt.toISOString()}</lastmod></url>`);
	}
	for (const e of episodes) {
		urls.push(`  <url><loc>${base}/listen/${e.slug}</loc><lastmod>${e.updatedAt.toISOString()}</lastmod></url>`);
	}

	const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;

	return new Response(xml, {
		headers: { 'content-type': 'application/xml; charset=utf-8' }
	});
};
