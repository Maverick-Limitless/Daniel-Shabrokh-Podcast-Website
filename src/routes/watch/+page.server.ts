import { getPublishedVideos } from '#lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { videos: await getPublishedVideos() };
};
