import { error, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db';
import { renderMarkdown } from '#lib/server/markdown';
import type { PageServerLoad } from './$types';

const TYPE_MAP = { insights: 'article', videos: 'video', audio: 'audio' } as const;
type PreviewKind = (typeof TYPE_MAP)[keyof typeof TYPE_MAP];

/**
 * Draft preview for the administrator only. Renders with the public
 * page structure but is auth-gated server-side and never public.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.administrator) redirect(303, '/admin/login');

	const kind: PreviewKind | undefined = TYPE_MAP[params.type as keyof typeof TYPE_MAP];
	if (!kind) error(404, 'Unknown preview type');

	if (kind === 'article') {
		const article = await db.article.findUnique({ where: { id: params.id } });
		if (!article) error(404, 'Article not found');
		const { html, toc, readingMinutes } = renderMarkdown(article.body);
		return { kind, article, html, toc, readingMinutes };
	}

	if (kind === 'video') {
		const video = await db.video.findUnique({ where: { id: params.id } });
		if (!video) error(404, 'Video not found');
		return { kind, video };
	}

	const episode = await db.audioEpisode.findUnique({ where: { id: params.id } });
	if (!episode) error(404, 'Episode not found');
	return { kind, episode };
};
