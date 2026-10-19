import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db';
import { deleteContent, parseTags, setContentStatus, updateVideo } from '#lib/server/cms';
import { requireAdmin } from '#lib/server/guard';
import { fieldErrors, videoInputSchema } from '#lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requireAdmin(locals);
	const video = await db.video.findUnique({ where: { id: params.id } });
	if (!video) error(404, 'Video not found');
	return {
		video: { ...video, tags: parseTags(video.tags).join(', ') }
	};
};

function parse(data: FormData) {
	return videoInputSchema.safeParse({
		title: data.get('title'),
		slug: data.get('slug'),
		description: data.get('description'),
		providerVideoId: data.get('providerVideoId'),
		thumbnailUrl: data.get('thumbnailUrl'),
		category: data.get('category'),
		tags: data.get('tags'),
		featured: data.get('featured')
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
		const result = await updateVideo(params.id, parsed.data, admin.username);
		if (!result.ok) {
			return fail(400, { errors: result.fieldErrors ?? {}, message: result.message, values: Object.fromEntries(data) });
		}
		return { message: 'Saved.' };
	},
	publish: async ({ request, locals, params }) => {
		const admin = requireAdmin(locals);
		const data = await request.formData();
		const parsed = parse(data);
		if (!parsed.success) {
			return fail(400, { errors: fieldErrors(parsed.error), values: Object.fromEntries(data) });
		}
		// Publishing validates and stores the submitted fields first.
		const updated = await updateVideo(params.id, parsed.data, admin.username);
		if (!updated.ok) {
			return fail(400, { errors: updated.fieldErrors ?? {}, values: Object.fromEntries(data) });
		}
		const result = await setContentStatus('video', params.id, 'published', admin.username);
		if (!result.ok) return fail(400, { message: result.message });
		return { message: 'Published.' };
	},
	unpublish: async ({ locals, params }) => {
		const admin = requireAdmin(locals);
		const result = await setContentStatus('video', params.id, 'draft', admin.username);
		if (!result.ok) return fail(400, { message: result.message });
		return { message: 'Unpublished. The video is no longer publicly visible.' };
	},
	archive: async ({ locals, params }) => {
		const admin = requireAdmin(locals);
		const result = await setContentStatus('video', params.id, 'archived', admin.username);
		if (!result.ok) return fail(400, { message: result.message });
		return { message: 'Archived.' };
	},
	restore: async ({ locals, params }) => {
		const admin = requireAdmin(locals);
		const result = await setContentStatus('video', params.id, 'draft', admin.username);
		if (!result.ok) return fail(400, { message: result.message });
		return { message: 'Restored to draft.' };
	},
	delete: async ({ locals, params }) => {
		const admin = requireAdmin(locals);
		const result = await deleteContent('video', params.id, admin.username);
		if (!result.ok) return fail(400, { message: result.message });
		redirect(303, '/admin/videos');
	}
};
