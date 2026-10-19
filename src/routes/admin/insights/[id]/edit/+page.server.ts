import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db';
import {
	deleteContent,
	parseTags,
	setContentStatus,
	updateArticle
} from '#lib/server/cms';
import { requireAdmin } from '#lib/server/guard';
import { articleInputSchema, fieldErrors } from '#lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requireAdmin(locals);
	const article = await db.article.findUnique({ where: { id: params.id } });
	if (!article) error(404, 'Article not found');
	return {
		article: { ...article, tags: parseTags(article.tags).join(', ') }
	};
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
	save: async ({ request, locals, params }) => {
		const admin = requireAdmin(locals);
		const data = await request.formData();
		const parsed = parse(data);
		if (!parsed.success) {
			return fail(400, { errors: fieldErrors(parsed.error), values: Object.fromEntries(data) });
		}
		const result = await updateArticle(params.id, parsed.data, admin.username);
		if (!result.ok) {
			return fail(400, { errors: result.fieldErrors ?? {}, message: result.message, values: Object.fromEntries(data) });
		}
		return { message: 'Draft saved.' };
	},
	publish: async ({ request, locals, params }) => {
		const admin = requireAdmin(locals);
		const data = await request.formData();
		const parsed = parse(data);
		if (!parsed.success) {
			return fail(400, { errors: fieldErrors(parsed.error), values: Object.fromEntries(data) });
		}
		// Publishing validates and stores the submitted fields first, so an
		// invalid record can never become publicly visible.
		const updated = await updateArticle(params.id, parsed.data, admin.username);
		if (!updated.ok) {
			return fail(400, { errors: updated.fieldErrors ?? {}, values: Object.fromEntries(data) });
		}
		const result = await setContentStatus('article', params.id, 'published', admin.username);
		if (!result.ok) {
			return fail(400, { message: result.message });
		}
		return { message: 'Published.' };
	},
	unpublish: async ({ locals, params }) => {
		const admin = requireAdmin(locals);
		const result = await setContentStatus('article', params.id, 'draft', admin.username);
		if (!result.ok) return fail(400, { message: result.message });
		return { message: 'Unpublished. The article is no longer publicly visible.' };
	},
	archive: async ({ locals, params }) => {
		const admin = requireAdmin(locals);
		const result = await setContentStatus('article', params.id, 'archived', admin.username);
		if (!result.ok) return fail(400, { message: result.message });
		return { message: 'Archived.' };
	},
	restore: async ({ locals, params }) => {
		const admin = requireAdmin(locals);
		const result = await setContentStatus('article', params.id, 'draft', admin.username);
		if (!result.ok) return fail(400, { message: result.message });
		return { message: 'Restored to draft.' };
	},
	delete: async ({ locals, params }) => {
		const admin = requireAdmin(locals);
		const result = await deleteContent('article', params.id, admin.username);
		if (!result.ok) return fail(400, { message: result.message });
		redirect(303, '/admin/insights');
	}
};
