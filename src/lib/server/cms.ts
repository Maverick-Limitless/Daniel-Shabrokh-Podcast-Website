import { db } from './db';
import { logAdminEvent } from './audit';
import type { ArticleInput, AudioInput, VideoInput } from './validation';

/**
 * CMS write operations (PRD §6.7). All callers are authenticated server
 * actions; these functions perform the actual validation outcomes, unique-slug
 * handling, status transitions, and audit logging.
 */

export type ContentType = 'article' | 'video' | 'audio';
export type ContentStatus = 'draft' | 'published' | 'archived';

export const CONTENT_STATUS_ORDER: ContentStatus[] = ['draft', 'published', 'archived'];

const tagsToJson = (tags: string[]) => JSON.stringify(tags ?? []);

export function parseTags(raw: string | null | undefined): string[] {
	try {
		const parsed = JSON.parse(raw ?? '[]');
		return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string') : [];
	} catch {
		return [];
	}
}

function isUniqueViolation(error: unknown): boolean {
	const err = error as { code?: string; message?: string; clientVersion?: unknown };
	return (
		err?.code === 'P2002' ||
		(typeof err?.message === 'string' && /unique constraint/i.test(err.message))
	);
}

export type MutationResult = { ok: true; id: string } | { ok: false; fieldErrors?: Record<string, string>; message?: string };

// ---------- articles ----------

export async function createArticle(input: ArticleInput, actor: string, publish: boolean): Promise<MutationResult> {
	try {
		const article = await db.article.create({
			data: {
				title: input.title,
				slug: input.slug,
				excerpt: input.excerpt,
				body: input.body,
				coverImage: input.coverImage || null,
				authorLabel: input.authorLabel ?? null,
				category: input.category ?? null,
				tags: tagsToJson(input.tags),
				featured: input.featured,
				seoTitle: input.seoTitle ?? null,
				seoDescription: input.seoDescription ?? null,
				status: publish ? 'published' : 'draft',
				publishedAt: publish ? new Date() : null
			}
		});
		await logAdminEvent({ type: publish ? 'content_published' : 'content_created', actor, detail: `article:${article.slug}` });
		return { ok: true, id: article.id };
	} catch (error) {
		if (isUniqueViolation(error)) {
			return { ok: false, fieldErrors: { slug: 'This slug is already in use' } };
		}
		throw error;
	}
}

export async function updateArticle(id: string, input: ArticleInput, actor: string): Promise<MutationResult> {
	const existing = await db.article.findUnique({ where: { id } });
	if (!existing) return { ok: false, message: 'Article not found' };
	try {
		await db.article.update({
			where: { id },
			data: {
				title: input.title,
				slug: input.slug,
				excerpt: input.excerpt,
				body: input.body,
				coverImage: input.coverImage || null,
				authorLabel: input.authorLabel ?? null,
				category: input.category ?? null,
				tags: tagsToJson(input.tags),
				featured: input.featured,
				seoTitle: input.seoTitle ?? null,
				seoDescription: input.seoDescription ?? null
			}
		});
		await logAdminEvent({ type: 'content_updated', actor, detail: `article:${input.slug}` });
		return { ok: true, id };
	} catch (error) {
		if (isUniqueViolation(error)) {
			return { ok: false, fieldErrors: { slug: 'This slug is already in use' } };
		}
		throw error;
	}
}

// ---------- videos ----------

export async function createVideo(input: VideoInput, actor: string, publish: boolean): Promise<MutationResult> {
	try {
		const video = await db.video.create({
			data: {
				title: input.title,
				slug: input.slug,
				description: input.description,
				provider: 'youtube',
				providerVideoId: input.providerVideoId,
				thumbnailUrl: input.thumbnailUrl || null,
				category: input.category ?? null,
				tags: tagsToJson(input.tags),
				featured: input.featured,
				status: publish ? 'published' : 'draft',
				publishedAt: publish ? new Date() : null
			}
		});
		await logAdminEvent({ type: publish ? 'content_published' : 'content_created', actor, detail: `video:${video.slug}` });
		return { ok: true, id: video.id };
	} catch (error) {
		if (isUniqueViolation(error)) {
			return { ok: false, fieldErrors: { slug: 'This slug is already in use' } };
		}
		throw error;
	}
}

export async function updateVideo(id: string, input: VideoInput, actor: string): Promise<MutationResult> {
	const existing = await db.video.findUnique({ where: { id } });
	if (!existing) return { ok: false, message: 'Video not found' };
	try {
		await db.video.update({
			where: { id },
			data: {
				title: input.title,
				slug: input.slug,
				description: input.description,
				providerVideoId: input.providerVideoId,
				thumbnailUrl: input.thumbnailUrl || null,
				category: input.category ?? null,
				tags: tagsToJson(input.tags),
				featured: input.featured
			}
		});
		await logAdminEvent({ type: 'content_updated', actor, detail: `video:${input.slug}` });
		return { ok: true, id };
	} catch (error) {
		if (isUniqueViolation(error)) {
			return { ok: false, fieldErrors: { slug: 'This slug is already in use' } };
		}
		throw error;
	}
}

// ---------- audio ----------

export async function createAudio(input: AudioInput, actor: string, publish: boolean): Promise<MutationResult> {
	try {
		const episode = await db.audioEpisode.create({
			data: {
				title: input.title,
				slug: input.slug,
				description: input.description,
				audioSourceUrl: input.audioSourceUrl,
				coverImage: input.coverImage || null,
				durationSeconds: input.durationSeconds ?? null,
				episodeNumber: input.episodeNumber ?? null,
				category: input.category ?? null,
				tags: tagsToJson(input.tags),
				featured: input.featured,
				status: publish ? 'published' : 'draft',
				publishedAt: publish ? new Date() : null
			}
		});
		await logAdminEvent({ type: publish ? 'content_published' : 'content_created', actor, detail: `audio:${episode.slug}` });
		return { ok: true, id: episode.id };
	} catch (error) {
		if (isUniqueViolation(error)) {
			return { ok: false, fieldErrors: { slug: 'This slug is already in use' } };
		}
		throw error;
	}
}

export async function updateAudio(id: string, input: AudioInput, actor: string): Promise<MutationResult> {
	const existing = await db.audioEpisode.findUnique({ where: { id } });
	if (!existing) return { ok: false, message: 'Episode not found' };
	try {
		await db.audioEpisode.update({
			where: { id },
			data: {
				title: input.title,
				slug: input.slug,
				description: input.description,
				audioSourceUrl: input.audioSourceUrl,
				coverImage: input.coverImage || null,
				durationSeconds: input.durationSeconds ?? null,
				episodeNumber: input.episodeNumber ?? null,
				category: input.category ?? null,
				tags: tagsToJson(input.tags),
				featured: input.featured
			}
		});
		await logAdminEvent({ type: 'content_updated', actor, detail: `audio:${input.slug}` });
		return { ok: true, id };
	} catch (error) {
		if (isUniqueViolation(error)) {
			return { ok: false, fieldErrors: { slug: 'This slug is already in use' } };
		}
		throw error;
	}
}

// ---------- status transitions ----------

export async function setContentStatus(
	type: ContentType,
	id: string,
	status: ContentStatus,
	actor: string
): Promise<MutationResult> {
	const existing =
		type === 'article'
			? await db.article.findUnique({ where: { id } })
			: type === 'video'
				? await db.video.findUnique({ where: { id } })
				: await db.audioEpisode.findUnique({ where: { id } });
	if (!existing) return { ok: false, message: 'Record not found' };

	const now = new Date();
	const data: { status: ContentStatus; publishedAt?: Date | null } = { status };
	if (status === 'published' && !existing.publishedAt) data.publishedAt = now;

	if (type === 'article') await db.article.update({ where: { id }, data });
	else if (type === 'video') await db.video.update({ where: { id }, data });
	else await db.audioEpisode.update({ where: { id }, data });

	const eventType =
		status === 'published' ? 'content_published' : status === 'archived' ? 'content_archived' : 'content_unpublished';
	await logAdminEvent({ type: eventType, actor, detail: `${type}:${existing.slug}` });
	return { ok: true, id };
}

export async function deleteContent(type: ContentType, id: string, actor: string): Promise<MutationResult> {
	const existing =
		type === 'article'
			? await db.article.findUnique({ where: { id } })
			: type === 'video'
				? await db.video.findUnique({ where: { id } })
				: await db.audioEpisode.findUnique({ where: { id } });
	if (!existing) return { ok: false, message: 'Record not found' };

	if (type === 'article') await db.article.delete({ where: { id } });
	else if (type === 'video') await db.video.delete({ where: { id } });
	else await db.audioEpisode.delete({ where: { id } });

	await logAdminEvent({ type: 'content_deleted', actor, detail: `${type}:${existing.slug}` });
	return { ok: true, id };
}

// ---------- admin lists / dashboard ----------

export async function listContent(
	type: ContentType,
	opts: { q?: string; status?: ContentStatus | 'all' }
) {
	const where = {
		...(opts.status && opts.status !== 'all' ? { status: opts.status } : {}),
		...(opts.q ? { title: { contains: opts.q } } : {})
	};
	if (type === 'article') {
		return db.article.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 100 });
	}
	if (type === 'video') {
		return db.video.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 100 });
	}
	return db.audioEpisode.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 100 });
}

export async function getDashboard() {
	const [articlesPublished, articlesDraft, videosPublished, videosDraft, audioPublished, audioDraft] =
		await Promise.all([
			db.article.count({ where: { status: 'published' } }),
			db.article.count({ where: { status: 'draft' } }),
			db.video.count({ where: { status: 'published' } }),
			db.video.count({ where: { status: 'draft' } }),
			db.audioEpisode.count({ where: { status: 'published' } }),
			db.audioEpisode.count({ where: { status: 'draft' } })
		]);

	const [recentArticles, recentVideos, recentAudio, recentEvents] = await Promise.all([
		db.article.findMany({ orderBy: { updatedAt: 'desc' }, take: 5, select: { id: true, title: true, slug: true, status: true, updatedAt: true } }),
		db.video.findMany({ orderBy: { updatedAt: 'desc' }, take: 5, select: { id: true, title: true, slug: true, status: true, updatedAt: true } }),
		db.audioEpisode.findMany({ orderBy: { updatedAt: 'desc' }, take: 5, select: { id: true, title: true, slug: true, status: true, updatedAt: true } }),
		db.adminEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 6 })
	]);

	const recent = [
		...recentArticles.map((r) => ({ ...r, type: 'article' as const })),
		...recentVideos.map((r) => ({ ...r, type: 'video' as const })),
		...recentAudio.map((r) => ({ ...r, type: 'audio' as const }))
	]
		.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
		.slice(0, 6);

	return {
		counts: {
			articles: { published: articlesPublished, draft: articlesDraft },
			videos: { published: videosPublished, draft: videosDraft },
			audio: { published: audioPublished, draft: audioDraft }
		},
		recent,
		recentEvents
	};
}
