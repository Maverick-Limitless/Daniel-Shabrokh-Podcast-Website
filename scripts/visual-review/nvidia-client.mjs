// NVIDIA Vision-Language Model client for the visual-QA workflow
// (DSMP-VISION-WORKFLOW-1.0.0 §6).
//
// API contract (verified against the official hosted endpoint):
//   POST {base}/chat/completions   (OpenAI-compatible)
//   Authorization: Bearer <NVIDIA_API_KEY>
//   body: { model, messages: [{ role: 'user', content: [
//     { type: 'text', text }, { type: 'image_url',
//       image_url: { url: 'data:image/png;base64,…' } } ] }],
//     max_tokens, temperature, stream: false }
//   response: { choices: [{ message: { content }, finish_reason }], … }
// The base default (https://integrate.api.nvidia.com/v1) was confirmed live;
// exact image-size and rate limits are not published in the static catalog
// (the page states "Rate limits may vary by model"), so the client guards
// payload size and handles 429s with bounded retries.

import { reviewSchema } from './review-schema.mjs';

export const REVIEW_PROMPT = `You are acting as a demanding senior product designer, visual QA engineer, responsive-design reviewer, and accessibility-aware interface critic.

Inspect the supplied screenshot as a rendered production interface. Evaluate visual hierarchy, typography, alignment, spacing, grid consistency, editorial composition, responsive behavior, component consistency, media presentation, interaction affordances, visible accessibility issues, clipping, overflow, overlap, and unnecessary visual complexity.

Assess the interface against a premium editorial podcast platform: disciplined ink/navy tones, warm ivory, restrained gold accents, strong typography, deliberate asymmetry, clear content hierarchy, and purposeful motion.

Do not invent defects that cannot reasonably be inferred from the image. Distinguish confirmed visible defects from uncertain observations. Do not claim to have tested functionality that a screenshot cannot establish.

Return ONLY machine-readable JSON (no prose, no markdown fences) with exactly this shape:
{
  "model_id": "<your model id>",
  "route": "<route provided in the context>",
  "viewport": "<viewport provided in the context>",
  "overall_score": <1-10>,
  "findings": [
    { "id": "<stable id>", "severity": "critical|high|medium|low|observation",
      "category": "<e.g. typography|spacing|alignment|responsive|contrast|media|composition>",
      "description": "<what is wrong and why it matters>",
      "visual_evidence": "<where in the screenshot this is visible>",
      "recommended_fix": "<concrete correction>",
      "confidence": "high|medium|low" }
  ],
  "strengths": ["<what works well>"],
  "release_blockers": ["<findings that block release, if any>"]
}`;

/** Image payload guard: the hosted API's exact image-size limit is not
 *  published in the static catalog; keep requests conservative. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

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
 * (mandate §3): authentication, authorization, rate limit, model
 * availability, invalid request, model-side failure, timeout, or network.
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
	if (status === 404 || status === 410) return { kind: 'model_unavailable', retryable: false, message: `Model unavailable (${status}): the model ID does not exist or has been retired on this endpoint. ${bodyText}`.trim() };
	if (status === 400 || status === 422) return { kind: 'invalid_request', retryable: false, message: `Invalid request (${status}): check image encoding/size and request schema. ${bodyText}`.trim() };
	if (status >= 500) return { kind: 'model_error', retryable: true, message: `Model-side failure (${status}). ${bodyText}`.trim() };
	return { kind: 'unknown', retryable: false, message: `Unexpected API response (${status}). ${bodyText}`.trim() };
}

/** Extracts the first balanced JSON object from arbitrary text. */
function extractJson(text) {
	const start = text.indexOf('{');
	if (start === -1) return null;
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let i = start; i < text.length; i++) {
		const ch = text[i];
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
			if (depth === 0) return text.slice(start, i + 1);
		}
	}
	return null;
}

const REFUSAL_MARKERS = ["I can't", 'I cannot', 'I am unable', 'not able to assist'];

/**
 * Parses and validates a raw chat/completions response body.
 * Returns one of:
 *   { ok: true, data }                      — schema-valid review
 *   { ok: false, reason, message }           — refusal | truncated | malformed | invalid
 * `extraction` reports how the JSON was obtained ('direct' or 'lenient').
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

	const direct = extractJson(content);
	if (!direct) {
		const refusal = REFUSAL_MARKERS.some((marker) => content.toLowerCase().includes(marker.toLowerCase()));
		return refusal
			? { ok: false, reason: 'refusal', message: `Model refused to review: ${content.slice(0, 160)}`, extraction: 'none' }
			: { ok: false, reason: 'malformed', message: `No JSON object found in response: ${content.slice(0, 160)}`, extraction: 'none' };
	}

	let candidate;
	try {
		candidate = JSON.parse(direct);
	} catch {
		return { ok: false, reason: 'malformed', message: 'Embedded JSON could not be parsed (possibly truncated)', extraction: 'lenient' };
	}

	const validated = reviewSchema.safeParse(candidate);
	if (!validated.success) {
		return {
			ok: false,
			reason: 'invalid',
			message: `Schema validation failed: ${validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
			extraction: 'lenient'
		};
	}

	const data = validated.data;
	// Ground the review in the actual capture metadata rather than trusting
	// the model's self-report of route/viewport.
	data.route = expectedRoute ?? data.route;
	data.viewport = expectedViewport ?? data.viewport;

	return { ok: true, data, extraction: 'lenient' };
}

/**
 * Bounded retry wrapper (mandate §3): retries only errors classified as
 * retryable (rate limits, model-side 5xx, timeouts, network), with linear
 * backoff. Returns { result } or throws the last error after N attempts.
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
