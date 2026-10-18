import { fail, redirect } from '@sveltejs/kit';
import { createAudio } from '#lib/server/cms';
import { requireAdmin } from '#lib/server/guard';
import { audioInputSchema, fieldErrors } from '#lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	return {};
};

function parse(data: FormData) {
	return audioInputSchema.safeParse({
		title: data.get('title'),
		slug: data.get('slug'),
		description: data.get('description'),
		audioSourceUrl: data.get('audioSourceUrl'),
		coverImage: data.get('coverImage'),
		durationSeconds: data.get('durationSeconds'),
		episodeNumber: data.get('episodeNumber'),
		category: data.get('category'),
		tags: data.get('tags'),
		featured: data.get('featured')
	});
}

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const data = await request.formData();
		const parsed = parse(data);
		if (!parsed.success) {
			return fail(400, { errors: fieldErrors(parsed.error), values: Object.fromEntries(data) });
		}
		const result = await createAudio(parsed.data, admin.username, false);
		if (!result.ok) {
			return fail(400, { errors: result.fieldErrors ?? {}, values: Object.fromEntries(data) });
		}
		redirect(303, `/admin/audio/${result.id}/edit`);
	},
	publish: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const data = await request.formData();
		const parsed = parse(data);
		if (!parsed.success) {
			return fail(400, { errors: fieldErrors(parsed.error), values: Object.fromEntries(data) });
		}
		const result = await createAudio(parsed.data, admin.username, true);
		if (!result.ok) {
			return fail(400, { errors: result.fieldErrors ?? {}, values: Object.fromEntries(data) });
		}
		redirect(303, `/admin/audio/${result.id}/edit`);
	}
};
