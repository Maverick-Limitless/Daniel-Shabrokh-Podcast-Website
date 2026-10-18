import { error } from '@sveltejs/kit';

/**
 * Server-side authorization for every admin load and action (PRD §6.6, §10).
 * The route layout redirects unauthenticated visitors, but actions and loads
 * never trust that — they verify independently.
 */
export function requireAdmin(locals: App.Locals) {
	if (!locals.administrator) {
		error(401, 'Not authorized');
	}
	return locals.administrator;
}
