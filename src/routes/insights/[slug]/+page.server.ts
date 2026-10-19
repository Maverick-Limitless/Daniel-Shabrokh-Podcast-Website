import { error } from '@sveltejs/kit';
import { getArticleBySlug, getRelatedArticles } from '#lib/server/content';
import { renderMarkdown } from '#lib/server/markdown';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	// Only published articles are reachable publicly.
	const article = await getArticleBySlug(params.slug);
	if (!article) error(404, 'Article not found');

	const { html, toc, readingMinutes } = renderMarkdown(article.body);
	const related = await getRelatedArticles(article);

	return {
		article,
		html,
		toc,
		readingMinutes,
		related
	};
};
