// Structured-review contract, version 2 (DSHPODCAST-GLM-NVIDIA-VISION-WORKFLOW-2.0.0 §5C).
// A review only counts as valid when it passes this schema; malformed output
// is reported explicitly, never silently treated as success.

import { z } from 'zod';

/** Version of the review contract; the VLM is instructed to echo it. */
export const SCHEMA_VERSION = 2;

/** Fixed severity vocabulary (mandate §5C). */
export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'nit'];

export const findingSchema = z.object({
	id: z.string().min(1),
	severity: z.enum(SEVERITIES),
	category: z.string().min(1),
	description: z.string().min(1),
	visual_evidence: z.string().min(1),
	expected_user_impact: z.string().min(1),
	recommended_fix: z.string().min(1),
	confidence: z.string().min(1)
});

export const reviewSchema = z.object({
	schema_version: z.coerce.number().default(SCHEMA_VERSION),
	model_id: z.string().min(1),
	route: z.string().min(1),
	viewport: z.string().min(1),
	overall_score: z.coerce.number().min(1).max(10),
	findings: z.array(findingSchema),
	strengths: z.array(z.string()),
	release_blockers: z.array(z.string())
});

/**
 * Validates a parsed review object.
 * Returns { ok: true, data } or { ok: false, errors: string[] }.
 */
export function validateReview(candidate) {
	const result = reviewSchema.safeParse(candidate);
	if (result.success) {
		return { ok: true, data: result.data };
	}
	return {
		ok: false,
		errors: result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
	};
}
