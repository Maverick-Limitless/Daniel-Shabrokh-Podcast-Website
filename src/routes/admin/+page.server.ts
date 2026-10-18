import { getDashboard } from '#lib/server/cms';
import { requireAdmin } from '#lib/server/guard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	return { dashboard: await getDashboard() };
};
