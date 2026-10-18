import { getHomeData } from '#lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const { featuredVideo, latestVideos, episodes, articles } = await getHomeData();
	return {
		featuredVideo,
		latestVideos,
		episodes,
		articles
	};
};
