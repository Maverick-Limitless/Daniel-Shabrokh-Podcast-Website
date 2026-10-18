import { fail, redirect } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/guard';
import { createArticle } from '#lib/server/cms';
import { articleInputSchema, fieldErrors } from '#lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	return {};
};

function parse(data: FormData) {
	return articleInputSchema.safeParse({
		title: data.get('title'),
		slug: data.get('slug'),
		excerpt: data.get('excerpt'),
		body: data.get('body'),
		coverImage: data.get('coverImage'),
		authorLabel: data.get('authorLabel'),
		category: data.get('category'),
		tags: data.get('tags'),
		featured: data.get('featured'),
		seoTitle: data.get('seoTitle'),
		seoDescription: data.get('seoDescription')
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
		const result = await createArticle(parsed.data, admin.username, false);
		if (!result.ok) {
			return fail(400, { errors: result.fieldErrors ?? {}, values: Object.fromEntries(data) });
		}
		redirect(303, `/admin/insights/${result.id}/edit`);
	},
	publish: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const data = await request.formData();
		const parsed = parse(data);
		if (!parsed.success) {
			return fail(400, { errors: fieldErrors(parsed.error), values: Object.fromEntries(data) });
		}
		const result = await createArticle(parsed.data, admin.username, true);
		if (!result.ok) {
			return fail(400, { errors: result.fieldErrors ?? {}, values: Object.fromEntries(data) });
		}
		redirect(303, `/admin/insights/${result.id}/edit`);
	}
};
