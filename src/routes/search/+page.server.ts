import { searchPublished } from '#lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	// Bounded, trimmed query; searches only published content (PRD §5.6).
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 120);
	if (!q) return { q: '', results: null };

	const results = await searchPublished(q);
	return { q, results };
};
