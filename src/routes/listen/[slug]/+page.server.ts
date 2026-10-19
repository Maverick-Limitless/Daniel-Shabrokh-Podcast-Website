import { error } from '@sveltejs/kit';
import { getAudioBySlug, getLatestEpisodes } from '#lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	// Only published episodes are reachable publicly.
	const episode = await getAudioBySlug(params.slug);
	if (!episode) error(404, 'Episode not found');

	const all = await getLatestEpisodes(50);
	const related = all.filter((e) => e.id !== episode.id).slice(0, 3);
	return { episode, related };
};
