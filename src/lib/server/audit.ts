import { db } from '#lib/server/db';

export type AdminEventType =
	| 'login_success'
	| 'login_failed'
	| 'login_rate_limited'
	| 'logout'
	| 'password_changed'
	| 'admin_initialized'
	| 'content_created'
	| 'content_updated'
	| 'content_published'
	| 'content_unpublished'
	| 'content_archived'
	| 'content_deleted';

/**
 * Record an administrative event (PRD §6.9). Never pass passwords, raw
 * recovery/session tokens, or other secrets as values here.
 */
export async function logAdminEvent(event: {
	type: AdminEventType;
	actor?: string | null;
	detail?: string | null;
	identifierHash?: string | null;
}): Promise<void> {
	try {
		await db.adminEvent.create({
			data: {
				type: event.type,
				actor: event.actor ?? null,
				detail: event.detail ?? null,
				identifierHash: event.identifierHash ?? null
			}
		});
	} catch (err) {
		// Audit must not take the request down, but the failure is surfaced in logs (PRD §9.5).
		console.error('[audit] failed to record event of type', event.type, err);
	}
}
