import { db } from './db';
import { escapeLike } from './validation';

/**
 * Public-content queries. Every function here only ever returns rows with
 * status = 'published' — drafts and archived content must never be visible to
 * public visitors or to search (PRD §2.2, §5.6, §6.7).
 */

const PUBLISHED = 'published' as const;

// ---------- videos ----------

export function getPublishedVideos(limit = 50) {
	return db.video.findMany({
		where: { status: PUBLISHED },
		orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
		take: limit
	});
}

export function getVideoBySlug(slug: string) {
	return db.video.findFirst({ where: { slug, status: PUBLISHED } });
}

export async function getRelatedVideos(video: { id: string; category: string | null }, limit = 3) {
	const sameCategory = await db.video.findMany({
		where: { status: PUBLISHED, id: { not: video.id }, ...(video.category ? { category: video.category } : {}) },
		orderBy: { publishedAt: 'desc' },
		take: limit
	});
	if (sameCategory.length >= limit || !video.category) return sameCategory;
	const filler = await db.video.findMany({
		where: { status: PUBLISHED, id: { not: video.id } },
		orderBy: { publishedAt: 'desc' },
		take: limit - sameCategory.length
	});
	return [...sameCategory, ...filler.filter((v) => !sameCategory.some((s) => s.id === v.id))];
}

// ---------- audio ----------

export function getPublishedEpisodes(limit = 50) {
	return db.audioEpisode.findMany({
		where: { status: PUBLISHED },
		orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
		take: limit
	});
}

export function getAudioBySlug(slug: string) {
	return db.audioEpisode.findFirst({ where: { slug, status: PUBLISHED } });
}

export function getLatestEpisodes(limit = 3) {
	return db.audioEpisode.findMany({
		where: { status: PUBLISHED },
		orderBy: { publishedAt: 'desc' },
		take: limit
	});
}

// ---------- articles ----------

export function getPublishedArticles(limit = 50) {
	return db.article.findMany({
		where: { status: PUBLISHED },
		orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
		take: limit
	});
}

export function getArticleBySlug(slug: string) {
	return db.article.findFirst({ where: { slug, status: PUBLISHED } });
}

export function getLatestArticles(limit = 3) {
	return db.article.findMany({
		where: { status: PUBLISHED },
		orderBy: { publishedAt: 'desc' },
		take: limit
	});
}

export async function getRelatedArticles(article: { id: string; category: string | null }, limit = 3) {
	const sameCategory = await db.article.findMany({
		where: { status: PUBLISHED, id: { not: article.id }, ...(article.category ? { category: article.category } : {}) },
		orderBy: { publishedAt: 'desc' },
		take: limit
	});
	if (sameCategory.length >= limit || !article.category) return sameCategory;
	const filler = await db.article.findMany({
		where: { status: PUBLISHED, id: { not: article.id } },
		orderBy: { publishedAt: 'desc' },
		take: limit - sameCategory.length
	});
	return [...sameCategory, ...filler.filter((v) => !sameCategory.some((s) => s.id === v.id))];
}

// ---------- home ----------

export async function getHomeData() {
	const [featuredVideo, latestVideos, episodes, articles] = await Promise.all([
		// Featured flag first, else the most recent published video.
		db.video.findFirst({ where: { status: PUBLISHED, featured: true }, orderBy: { publishedAt: 'desc' } }),
		db.video.findMany({ where: { status: PUBLISHED }, orderBy: { publishedAt: 'desc' }, take: 3 }),
		getLatestEpisodes(3),
		getLatestArticles(3)
	]);
	return {
		featuredVideo: featuredVideo ?? latestVideos[0] ?? null,
		latestVideos,
		episodes,
		articles
	};
}

// ---------- search ----------

export interface SearchHit {
	id: string;
	title: string;
	slug: string;
	excerpt: string;
	category: string | null;
	publishedAt: Date | null;
}

/**
 * Server-side search over published content only (PRD §5.6). Parameterized
 * LIKE queries — user input is never concatenated into SQL (PRD §6.6).
 * SQLite LIKE is ASCII-case-insensitive; non-ASCII case folding is a
 * documented limitation acceptable for the initial release.
 */
export async function searchPublished(query: string, limitPerType = 10) {
	const like = `%${escapeLike(query)}%`;
	const esc = '\\';

	const articles = await db.$queryRaw<SearchHit[]>`
		SELECT id, title, slug, excerpt, category, publishedAt
		FROM Article
		WHERE status = 'published'
			AND (title LIKE ${like} ESCAPE ${esc} OR excerpt LIKE ${like} ESCAPE ${esc})
		ORDER BY publishedAt DESC
		LIMIT ${limitPerType}`;

	const videos = await db.$queryRaw<(SearchHit & { providerVideoId: string })[]>`
		SELECT id, title, slug, description AS excerpt, category, publishedAt, providerVideoId
		FROM Video
		WHERE status = 'published'
			AND (title LIKE ${like} ESCAPE ${esc} OR description LIKE ${like} ESCAPE ${esc})
		ORDER BY publishedAt DESC
		LIMIT ${limitPerType}`;

	const episodes = await db.$queryRaw<SearchHit[]>`
		SELECT id, title, slug, description AS excerpt, category, publishedAt
		FROM AudioEpisode
		WHERE status = 'published'
			AND (title LIKE ${like} ESCAPE ${esc} OR description LIKE ${like} ESCAPE ${esc})
		ORDER BY publishedAt DESC
		LIMIT ${limitPerType}`;

	return { articles, videos, episodes };
}
