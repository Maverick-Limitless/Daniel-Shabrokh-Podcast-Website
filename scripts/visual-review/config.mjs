// Visual-QA workflow configuration (DSHPODCAST-GLM-NVIDIA-VISION-WORKFLOW-2.0.0 §5A).
// Secrets are read ONLY from the environment / .env and are never logged,
// committed, sent to the browser, or included in artifacts.

import { existsSync, readFileSync } from 'node:fs';
import { MAX_IMAGE_BYTES } from './nvidia-client.mjs';

export const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';

/**
 * The model originally requested by the earlier mandate. Verified against the
// hosted API on 2026-10-19T10:43:01Z: the ID is real but the model is
 * END-OF-LIFE — POST /v1/chat/completions returns 410 "The model
 * 'nvidia/nemotron-nano-12b-v2-vl' has reached its end of life on
 * 2026-08-26T09:00:00Z and is no longer available." It is kept here for
 * documentation; the workflow refuses it with this evidence.
 */
export const REQUESTED_MODEL_ID = 'nvidia/nemotron-nano-12b-v2-vl';

/**
 * Documented replacement decision: verified live in the public catalog
 * (GET /v1/models, 2026-10-19) and reachable (unauthenticated POST returns
 * 401 "authorization missing" — not a 410). Same NVIDIA Nemotron
 * vision-language ("‑vl") lineage as the requested model.
 */
export const DEFAULT_VISION_MODEL = 'nvidia/nemotron-3.5-super-vl-120b-a12b';

export const EXIT_CODES = {
	OK: 0,
	MISSING_CONFIG: 2,
	API_FAILURE: 3,
	REVIEW_INVALID: 4,
	ENV_FAILURE: 5
};

/**
 * Minimal .env loader (same convention as prisma.config.ts / other scripts).
 * Quotes are stripped only when they wrap the entire value, so values like
 * `don't` or inline `#` characters survive untouched. Shell env always wins.
 */
export function loadDotEnv(path = '.env') {
	if (!existsSync(path)) return;
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
		if (match && !(match[1] in process.env)) {
			let value = match[2];
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}
			process.env[match[1]] = value;
		}
	}
}

export class VisualReviewConfigError extends Error {
	constructor(message) {
		super(message);
		this.name = 'VisualReviewConfigError';
	}
}

function intKnob(env, name, fallback, min, max, errors) {
	const raw = (env[name] ?? '').trim();
	if (raw === '') return fallback;
	const value = Number(raw);
	if (!Number.isInteger(value) || value < min || value > max) {
		errors.push(`${name} must be an integer between ${min} and ${max} (got "${raw}")`);
		return fallback;
	}
	return value;
}

/**
 * Loads and validates the visual-review configuration, including the
 * tunable knobs (timeout, retries, max image size, iteration cap, output dir).
 * Returns { apiKey, model, baseUrl, timeoutMs, retries, maxImageBytes,
 *           iterations, reportDir, valid, missing, errors }.
 */
export function loadVisualReviewConfig(env = process.env) {
	const apiKey = (env.NVIDIA_API_KEY ?? '').trim();
	const model = (env.NVIDIA_VISION_MODEL ?? DEFAULT_VISION_MODEL).trim();
	const baseUrl = (env.NVIDIA_VISION_BASE_URL ?? DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
	const reportDir = (env.VISUAL_REVIEW_REPORT_DIR ?? 'tests/visual-review').trim() || 'tests/visual-review';

	const missing = [];
	const errors = [];
	if (!apiKey) missing.push('NVIDIA_API_KEY');
	if (!model) missing.push('NVIDIA_VISION_MODEL');
	if (!/^https:\/\/.+/.test(baseUrl)) {
		missing.push('NVIDIA_VISION_BASE_URL (must be an https:// URL)');
	}
	if (missing.length) {
		errors.push(
			`Missing or invalid configuration: ${missing.join(', ')}. ` +
				'Create an API key at https://build.nvidia.com (Setup guide), then set it in the ' +
				'environment or .env — e.g. export NVIDIA_API_KEY="nvapi-...". ' +
				'The key is read only from the environment and is never logged or committed.'
		);
	}

	// Tunable knobs, validated up front so a typo fails fast and safely.
	const timeoutMs = intKnob(env, 'NVIDIA_VISION_TIMEOUT_MS', 90_000, 1_000, 600_000, errors);
	const retries = intKnob(env, 'NVIDIA_VISION_RETRIES', 2, 0, 5, errors);
	const maxImageBytes = intKnob(env, 'VISUAL_REVIEW_MAX_IMAGE_BYTES', MAX_IMAGE_BYTES, 1024, 20 * 1024 * 1024, errors);
	const iterations = intKnob(env, 'VISUAL_REVIEW_ITERATIONS', 3, 1, 3, errors);

	if (model === REQUESTED_MODEL_ID) {
		// Explicitly refuse the retired model with the evidence, instead of
		// failing opaquely at request time (mandate §5A: no silent switching).
		errors.push(
			`NVIDIA_VISION_MODEL is set to ${REQUESTED_MODEL_ID}, which reached end-of-life on ` +
				'the hosted API on 2026-08-26 (HTTP 410: "has reached its end of life... and is ' +
				'no longer available"). Set NVIDIA_VISION_MODEL to a live vision-language model, ' +
				`e.g. the verified default ${DEFAULT_VISION_MODEL}.`
		);
	}

	return {
		apiKey,
		model,
		baseUrl,
		timeoutMs,
		retries,
		maxImageBytes,
		iterations,
		reportDir,
		valid: missing.length === 0 && errors.length === 0,
		missing,
		errors
	};
}

/**
 * Validates the review-server port (mandate §5A: fail fast, never with a
 * confusing "Port NaN" message).
 */
export function validatePort(raw) {
	const port = Number(raw);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		return { ok: false, message: `VISUAL_REVIEW_PORT must be an integer between 1 and 65535 (got "${raw}")` };
	}
	return { ok: true, port };
}

/**
 * Redacts secret values from text before printing or persisting (§5A).
 * Exact-value scrubbing plus pattern-based fallbacks so partially logged
 * keys (e.g. truncated bodies) are still removed.
 */
export function redact(text, secrets = []) {
	let out = String(text);
	for (const secret of secrets) {
		if (secret && secret.length > 4) {
			out = out.split(secret).join('[REDACTED]');
		}
	}
	// Pattern fallbacks: NVIDIA key format and bearer tokens, even truncated.
	out = out.replace(/nvapi-[A-Za-z0-9_-]+/g, 'nvapi-[REDACTED]');
	out = out.replace(/Bearer\s+[A-Za-z0-9._-]{8,}/g, 'Bearer [REDACTED]');
	return out;
}
