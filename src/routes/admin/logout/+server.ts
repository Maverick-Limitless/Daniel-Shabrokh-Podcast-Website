import { redirect } from '@sveltejs/kit';
import { logAdminEvent } from '#lib/server/audit';
import { destroySession } from '#lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, locals }) => {
	const username = locals.administrator?.username ?? null;
	await destroySession(cookies);
	if (username) {
		await logAdminEvent({ type: 'logout', actor: username });
	}
	redirect(303, '/admin/login');
};
