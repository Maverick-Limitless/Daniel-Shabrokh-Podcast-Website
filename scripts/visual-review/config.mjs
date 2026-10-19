// Visual-QA workflow configuration (DSMP-VISION-WORKFLOW-1.0.0 §3).
// Secrets are read ONLY from the environment / .env and are never logged,
// committed, sent to the browser, or included in artifacts.

import { existsSync, readFileSync } from 'node:fs';

export const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';

/**
 * The model originally requested by the mandate. Verified against the hosted
 * API on 2026-10-19: the ID is real but the model is END-OF-LIFE —
 *   POST https://integrate.api.nvidia.com/v1/chat/completions
 *   → 410 "The model 'nvidia/nemotron-nano-12b-v2-vl' has reached its end of
 *     life on 2026-08-26T09:00:00Z and is no longer available."
 * It is kept here for documentation; do not use it as a default.
 */
export const REQUESTED_MODEL_ID = 'nvidia/nemotron-nano-12b-v2-vl';

/**
 * Documented replacement decision (mandate §2): verified live in the public
 * catalog (GET /v1/models) and reachable (unauthenticated POST returns 401
 * "authorization missing" — not a 410). Same NVIDIA Nemotron vision-language
 * ("‑vl") lineage as the requested model.
 */
export const DEFAULT_VISION_MODEL = 'nvidia/nemotron-3.5-super-vl-120b-a12b';

export const EXIT_CODES = {
	OK: 0,
	MISSING_CONFIG: 2,
	API_FAILURE: 3,
	REVIEW_INVALID: 4,
	ENV_FAILURE: 5
};

/** Minimal .env loader (same convention as prisma.config.ts / other scripts). */
export function loadDotEnv(path = '.env') {
	if (!existsSync(path)) return;
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
		if (match && !(match[1] in process.env)) {
			process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
		}
	}
}

export class VisualReviewConfigError extends Error {
	constructor(message) {
		super(message);
		this.name = 'VisualReviewConfigError';
	}
}

/**
 * Loads and validates the visual-review configuration.
 * Returns { apiKey, model, baseUrl, valid, missing, errors }.
 */
export function loadVisualReviewConfig(env = process.env) {
	const apiKey = (env.NVIDIA_API_KEY ?? '').trim();
	const model = (env.NVIDIA_VISION_MODEL ?? DEFAULT_VISION_MODEL).trim();
	const baseUrl = (env.NVIDIA_VISION_BASE_URL ?? DEFAULT_BASE_URL).trim().replace(/\/+$/, '');

	const missing = [];
	if (!apiKey) missing.push('NVIDIA_API_KEY');
	if (!model) missing.push('NVIDIA_VISION_MODEL');
	if (!/^https:\/\/.+/.test(baseUrl)) {
		missing.push('NVIDIA_VISION_BASE_URL (must be an https:// URL)');
	}

	if (model === REQUESTED_MODEL_ID) {
		// Explicitly refuse the EOL model with the evidence, instead of failing
		// opaquely at request time (mandate §2: report the precise distinction).
		return {
			apiKey,
			model,
			baseUrl,
			valid: false,
			missing,
			errors: [
				`NVIDIA_VISION_MODEL is set to ${REQUESTED_MODEL_ID}, which reached end-of-life on ` +
					'the hosted API on 2026-08-26 (HTTP 410: "has reached its end of life... and is ' +
					'no longer available"). Set NVIDIA_VISION_MODEL to a live vision-language model, ' +
					`e.g. the verified default ${DEFAULT_VISION_MODEL}.`
			]
		};
	}

	return {
		apiKey,
		model,
		baseUrl,
		valid: missing.length === 0,
		missing,
		errors: missing.length
			? [
					`Missing or invalid configuration: ${missing.join(', ')}. ` +
						'Create an API key at https://build.nvidia.com (Setup guide), then set it in the ' +
						'environment or .env — e.g. export NVIDIA_API_KEY="nvapi-...". ' +
						'The key is read only from the environment and is never logged or committed.'
				]
			: []
	};
}

/**
 * Redacts secret values from text before printing or persisting (§3).
 * `secrets` should contain the raw values to scrub.
 */
export function redact(text, secrets = []) {
	let out = String(text);
	for (const secret of secrets) {
		if (secret && secret.length > 4) {
			out = out.split(secret).join('[REDACTED]');
		}
	}
	return out;
}
