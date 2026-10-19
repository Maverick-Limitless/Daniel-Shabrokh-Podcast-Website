// NVIDIA Vision-Language Model client for the visual-QA workflow
// (DSHPODCAST-GLM-NVIDIA-VISION-WORKFLOW-2.0.0 §5C).
//
// API contract (verified against the official hosted endpoint):
//   POST {base}/chat/completions   (OpenAI-compatible)
//   Authorization: Bearer <NVIDIA_API_KEY>
//   body: { model, messages: [{ role: 'user', content: [
//     { type: 'text', text }, { type: 'image_url',
//       image_url: { url: 'data:image/png;base64,…' } } ] }],
//     max_tokens, temperature, stream: false }
//   response: { choices: [{ message: { content }, finish_reason }], … }
// The base default (https://integrate.api.nvidia.com/v1) was confirmed live
// (2026-10-19: catalog answers unauthenticated; retired models return 410
// pre-auth; available models return 401 pre-auth). Exact image-size and rate
// limits are not published in the static catalog, so payloads are validated
// client-side and 413/429s are classified and handled.

import { reviewSchema, SCHEMA_VERSION } from './review-schema.mjs';

/** Default image-payload guard; override via VISUAL_REVIEW_MAX_IMAGE_BYTES. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export const REVIEW_PROMPT = `You are a demanding senior product designer and visual QA engineer reviewing one rendered screenshot of a premium editorial podcast platform (disciplined ink/navy tones, warm ivory, restrained gold accents, strong editorial typography, deliberate asymmetry).

Judge ONLY what is visible in the image: visual hierarchy, layout and grid consistency, spacing, typography, alignment, responsive behavior visible in this frame, clipping, overflow, overlap, contrast as it appears, component consistency, media presentation, interaction affordances, and conspicuous usability defects.

Do NOT infer invisible behavior, functionality, business facts, code-level causes, or accessibility compliance from pixels alone. Do not invent defects you cannot point to in the image. Anything that cannot be grounded in the screenshot must be omitted.

Return ONLY machine-readable JSON (no prose, no markdown fences) with exactly this shape:
{
  "schema_version": ${SCHEMA_VERSION},
  "model_id": "<your model id>",
  "route": "<route provided in the context>",
  "viewport": "<viewport provided in the context>",
  "overall_score": <1-10>,
  "findings": [
    { "id": "<stable id>", "severity": "critical|high|medium|low|nit",
      "category": "<e.g. typography|spacing|alignment|responsive|contrast|media|composition>",
      "description": "<what is wrong and why it matters>",
      "visual_evidence": "<where in the image this is visible>",
      "expected_user_impact": "<the impact on a visitor if left unfixed>",
      "recommended_fix": "<a concrete, testable correction>",
      "confidence": "high|medium|low" }
  ],
  "strengths": ["<what works well>"],
  "release_blockers": ["<findings that block release, if any>"]
}
Severity "nit" is reserved for the most minor cosmetic observations. An empty findings array is a valid answer.`;

/** Allowed screenshot MIME types. */
export const ALLOWED_IMAGE_MIME = ['image/png', 'image/jpeg'];

/**
 * Validates an image payload before any request is built (mandate §5A).
 * Returns { ok: true } or { ok: false, message }.
 */
export function validateImagePayload({ bytes, mimeType, maxImageBytes = MAX_IMAGE_BYTES }) {
	if (!Number.isInteger(bytes) || bytes <= 0) {
		return { ok: false, message: 'Invalid image payload: size must be a positive integer' };
	}
	if (!ALLOWED_IMAGE_MIME.includes(mimeType)) {
		return { ok: false, message: `Unsupported image MIME type ${mimeType}; allowed: ${ALLOWED_IMAGE_MIME.join(', ')}` };
	}
	if (bytes > maxImageBytes) {
		return {
			ok: false,
			message: `Image is ${bytes} bytes, above the ${maxImageBytes}-byte review limit (base64 inflates it ~4/3 at send time). Use a smaller/viewport-only capture or raise VISUAL_REVIEW_MAX_IMAGE_BYTES.`
		};
	}
	return { ok: true };
}

/**
 * Builds the exact request that will be sent. Pure and deterministic — the
 * unit tests assert its shape without any network access.
 */
export function buildReviewRequest({ baseUrl, apiKey, model, imageBase64, route, viewport, context, mimeType = 'image/png', maxTokens = 2048, temperature = 0.2 }) {
	if (!apiKey) throw new Error('buildReviewRequest: apiKey is required');
	if (!imageBase64) throw new Error('buildReviewRequest: imageBase64 is required');

	return {
		url: `${baseUrl.replace(/\/+$/, '')}/chat/completions`,
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${apiKey}`
		},
		body: {
			model,
			messages: [
				{
					role: 'user',
					content: [
						{ type: 'text', text: REVIEW_PROMPT },
						{
							type: 'text',
							text: `Screenshot context — route: ${route}, viewport: ${viewport}. ${context ?? ''} Rendered production build with clearly labeled [DEV] fixture data.`
						},
						{ type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
					]
				}
			],
			max_tokens: maxTokens,
			temperature,
			stream: false
		}
	};
}

/**
 * Classifies an API failure into a distinct kind with an actionable message
 * (mandate §5C): authentication, authorization, rate limit, payload size,
 * unsupported media, model availability, invalid request, model-side
 * failure, timeout, or network.
 */
export function classifyApiError(error) {
	const status = error?.status ?? error?.statusCode;
	const bodyText = typeof error?.body === 'string' ? error.body : JSON.stringify(error?.body ?? '');
	const message = String(error?.message ?? bodyText ?? 'unknown API error');

	if (error?.name === 'AbortError') {
		return { kind: 'timeout', retryable: true, message: `Request timed out: ${message}` };
	}
	if (typeof status !== 'number') {
		return { kind: 'network', retryable: true, message: `Network error: ${message}` };
	}
	if (status === 401) return { kind: 'authentication', retryable: false, message: `Authentication failed (401): the API key is missing, invalid, or expired. ${bodyText}`.trim() };
	if (status === 403) return { kind: 'authorization', retryable: false, message: `Authorization failed (403): the key does not permit this model/endpoint. ${bodyText}`.trim() };
	if (status === 429) return { kind: 'rate_limit', retryable: true, message: `Rate limited (429): backing off before retrying. ${bodyText}`.trim() };
	if (status === 413) return { kind: 'payload_too_large', retryable: false, message: `Payload too large (413): the image exceeds the endpoint's limit. Reduce image bytes — e.g. use a viewport-only capture. ${bodyText}`.trim() };
	if (status === 415) return { kind: 'unsupported_media', retryable: false, message: `Unsupported media type (415): the endpoint rejected the image encoding. ${bodyText}`.trim() };
	if (status === 404 || status === 410) return { kind: 'model_unavailable', retryable: false, message: `Model unavailable (${status}): the model ID does not exist or has been retired on this endpoint. ${bodyText}`.trim() };
	if (status === 400 || status === 422) return { kind: 'invalid_request', retryable: false, message: `Invalid request (${status}): check image encoding/size and request schema. ${bodyText}`.trim() };
	if (status >= 500) return { kind: 'model_error', retryable: true, message: `Model-side failure (${status}). ${bodyText}`.trim() };
	return { kind: 'unknown', retryable: false, message: `Unexpected API response (${status}). ${bodyText}`.trim() };
}

/**
 * Extracts every balanced top-level JSON object embedded in arbitrary text,
 * in order of appearance. String-aware, so braces inside quoted values,
 * escaped quotes, or code fences do not confuse the depth tracking.
 */
export function extractJsonObjects(text) {
	const objects = [];
	let i = 0;
	while (i < text.length) {
		const start = text.indexOf('{', i);
		if (start === -1) break;
		let depth = 0;
		let inString = false;
		let escaped = false;
		let closed = false;
		for (let j = start; j < text.length; j++) {
			const ch = text[j];
			if (escaped) {
				escaped = false;
				continue;
			}
			if (ch === '\\') {
				escaped = true;
				continue;
			}
			if (ch === '"') inString = !inString;
			if (inString) continue;
			if (ch === '{') depth++;
			if (ch === '}') {
				depth--;
				if (depth === 0) {
					objects.push(text.slice(start, j + 1));
					i = j + 1;
					closed = true;
					break;
				}
			}
		}
		if (!closed) break; // unterminated object: stop scanning
	}
	return objects;
}

const REFUSAL_MARKERS = ["I can't", 'I cannot', 'I am unable', 'not able to assist'];

/** Grounds a validated review in the actual capture metadata. */
function finishReview(data, { expectedRoute, expectedViewport }) {
	// Ground the review in the actual capture metadata rather than trusting
	// the model's self-report of route/viewport.
	data.route = expectedRoute ?? data.route;
	data.viewport = expectedViewport ?? data.viewport;
	return { ok: true, data, extraction: 'lenient' };
}

/**
 * Parses and validates a raw chat/completions response body.
 * Returns one of:
 *   { ok: true, data, extraction }             — schema-valid review
 *   { ok: false, reason, message, extraction }  — refusal | truncated | malformed | invalid
 */
export function parseReviewResponse(rawBody, { expectedRoute, expectedViewport } = {}) {
	let parsed;
	try {
		parsed = JSON.parse(rawBody);
	} catch {
		return { ok: false, reason: 'malformed', message: 'Response body is not valid JSON', extraction: 'none' };
	}

	const choice = parsed?.choices?.[0];
	const content = choice?.message?.content;
	const finishReason = choice?.finish_reason;

	if (typeof content !== 'string' || !content.trim()) {
		return { ok: false, reason: 'malformed', message: 'Response has no message content', extraction: 'none' };
	}
	if (finishReason === 'length') {
		return { ok: false, reason: 'truncated', message: 'Model response was truncated (finish_reason=length); raise max_tokens or reduce the prompt', extraction: 'none' };
	}

	const candidates = extractJsonObjects(content);
	if (candidates.length === 0) {
		const refusal = REFUSAL_MARKERS.some((marker) => content.toLowerCase().includes(marker.toLowerCase()));
		return refusal
			? { ok: false, reason: 'refusal', message: `Model refused to review: ${content.slice(0, 160)}`, extraction: 'none' }
			: { ok: false, reason: 'malformed', message: `No JSON object found in response: ${content.slice(0, 160)}`, extraction: 'none' };
	}

	// Try each embedded object in order and keep the first that parses AND
	// passes the review schema, so leading junk JSON (stray metadata, prose
	// examples) cannot break extraction of the actual review.
	let lastError = null;
	for (const candidateText of candidates) {
		let candidate;
		try {
			candidate = JSON.parse(candidateText);
		} catch {
			lastError = { reason: 'malformed', message: 'Embedded JSON could not be parsed (possibly truncated)' };
			continue;
		}
		const validated = reviewSchema.safeParse(candidate);
		if (validated.success) {
			return finishReview(validated.data, { expectedRoute, expectedViewport });
		}
		lastError = {
			reason: 'invalid',
			message: `Schema validation failed: ${validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`
		};
	}

	return {
		ok: false,
		reason: lastError?.reason ?? 'malformed',
		message: lastError?.message ?? 'No valid review object in response',
		extraction: 'lenient'
	};
}

/**
 * Bounded retry wrapper (mandate §5C): retries only errors classified as
 * retryable (rate limits, model-side 5xx, timeouts, network), with linear
 * backoff. Never retries permanent authentication/authorization/model errors.
 */
export async function withRetries(fn, { retries = 2, delayMs = 2000, onRetry, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
	let lastError;
	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			const result = await fn(attempt);
			return { result, attempts: attempt + 1 };
		} catch (error) {
			lastError = error;
			const classified = error?.classified ?? classifyApiError(error);
			if (!classified.retryable || attempt === retries) {
				throw Object.assign(error, { classified, attempts: attempt + 1 });
			}
			if (onRetry) onRetry(attempt + 1, classified);
			await sleep(delayMs * (attempt + 1));
		}
	}
	throw Object.assign(lastError, { attempts: retries + 1 });
}

/**
 * Sends one review request with a timeout. Returns a parsed review result.
 * Throws an error with `.classified` (see classifyApiError) on failure.
 */
export async function requestReview({ baseUrl, apiKey, model, imageBase64, route, viewport, context, fetchImpl = fetch, timeoutMs = 90_000, maxTokens }) {
	const request = buildReviewRequest({ baseUrl, apiKey, model, imageBase64, route, viewport, context, maxTokens });

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	let response;
	try {
		response = await fetchImpl(request.url, {
			method: 'POST',
			headers: request.headers,
			body: JSON.stringify(request.body),
			signal: controller.signal
		});
	} catch (error) {
		clearTimeout(timer);
		throw Object.assign(error, { classified: classifyApiError(error) });
	}
	clearTimeout(timer);

	const bodyText = await response.text().catch(() => '');
	if (!response.ok) {
		throw Object.assign(new Error(`HTTP ${response.status}`), {
			status: response.status,
			body: bodyText.slice(0, 400),
			classified: classifyApiError({ status: response.status, body: bodyText.slice(0, 400) })
		});
	}

	const parsed = parseReviewResponse(bodyText, { expectedRoute: route, expectedViewport: viewport });
	if (!parsed.ok) {
		const error = new Error(parsed.message);
		error.classified = { kind: `review_${parsed.reason}`, retryable: false, message: parsed.message };
		throw error;
	}
	return parsed;
}
