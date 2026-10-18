import { listContent } from '#lib/server/cms';
import { requireAdmin } from '#lib/server/guard';
import type { PageServerLoad } from './$types';

const STATUSES = ['all', 'draft', 'published', 'archived'] as const;

export const load: PageServerLoad = async ({ locals, url }) => {
	requireAdmin(locals);
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
	const statusParam = url.searchParams.get('status') ?? 'all';
	const status = (STATUSES as readonly string[]).includes(statusParam)
		? (statusParam as (typeof STATUSES)[number])
		: 'all';

	const articles = await listContent('article', { q: q || undefined, status });
	return { articles, q, status };
};
