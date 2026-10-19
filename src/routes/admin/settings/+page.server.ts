import { fail } from '@sveltejs/kit';
import { changePassword } from '#lib/server/auth';
import { requireAdmin } from '#lib/server/guard';
import { passwordSchema } from '#lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const admin = requireAdmin(locals);
	return {
		username: admin.username,
		mustChangePassword: admin.mustChangePassword
	};
};

export const actions: Actions = {
	default: async ({ request, locals, cookies, url }) => {
		const admin = requireAdmin(locals);
		const data = await request.formData();
		const current = String(data.get('current') ?? '');
		const password = String(data.get('password') ?? '');
		const confirm = String(data.get('confirm') ?? '');

		if (password !== confirm) {
			return fail(400, { message: 'The new passwords do not match.' });
		}

		const parsed = passwordSchema.safeParse(password);
		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'Invalid password.' });
		}

		if (password.toLowerCase().includes(admin.username.toLowerCase())) {
			return fail(400, { message: 'The password must not contain your username.' });
		}

		// Requires the current password, invalidates other sessions, rotates the
		// current one, and records the event.
		const result = await changePassword(admin.id, current, password, cookies, url.protocol === 'https:');
		if (!result.ok) {
			return fail(400, { message: result.message });
		}

		return { message: 'Password updated. All other sessions were signed out.' };
	}
};
