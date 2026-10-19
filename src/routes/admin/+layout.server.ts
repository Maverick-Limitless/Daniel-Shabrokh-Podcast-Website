import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, route }) => {
	if (!locals.administrator) {
		// No public information leakage: unauthenticated visitors land on the
		// login page, whatever admin route they tried.
		if (route.id !== '/admin/login') redirect(303, '/admin/login');
		return { administrator: null };
	}

	// A freshly initialized administrator must establish a permanent password
	// before doing anything else.
	if (
		locals.administrator.mustChangePassword &&
		route.id !== '/admin/settings' &&
		route.id !== '/admin/login'
	) {
		redirect(303, '/admin/settings');
	}

	return { administrator: locals.administrator };
};
