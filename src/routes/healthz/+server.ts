import { db } from '#lib/server/db';
import type { RequestHandler } from './$types';

// Liveness/readiness probe.
// Returns ok only when the process is serving AND the database answers.
export const GET: RequestHandler = async () => {
	try {
		await db.$queryRaw`SELECT 1`;
	} catch {
		return Response.json({ ok: false }, { status: 503 });
	}
	return Response.json(
		{ ok: true },
		{ headers: { 'cache-control': 'no-store' } }
	);
};
