import { error } from '@sveltejs/kit';
import { getRelatedVideos, getVideoBySlug } from '#lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	// Only published videos are reachable publicly (PRD §5.2); anything else
	// is a deliberate 404.
	const video = await getVideoBySlug(params.slug);
	if (!video) error(404, 'Video not found');

	const related = await getRelatedVideos(video);
	return { video, related };
};
