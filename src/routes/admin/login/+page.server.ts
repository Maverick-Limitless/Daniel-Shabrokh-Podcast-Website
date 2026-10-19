import { fail, redirect } from '@sveltejs/kit';
import { attemptLogin } from '#lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.administrator) redirect(303, '/admin');
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress, url }) => {
		const data = await request.formData();
		const username = String(data.get('username') ?? '')
			.trim()
			.slice(0, 200);
		const password = String(data.get('password') ?? '').slice(0, 200);

		if (!username || !password) {
			return fail(400, { message: 'Enter your username and password.', values: { username } });
		}

		// Rate limiting, generic errors, and timing equalization all live in
		// attemptLogin.
		const result = await attemptLogin(
			username,
			password,
			getClientAddress(),
			cookies,
			url.protocol === 'https:'
		);
		if (!result.ok) {
			return fail(401, { message: result.message, values: { username } });
		}

		redirect(303, '/admin');
	}
};
