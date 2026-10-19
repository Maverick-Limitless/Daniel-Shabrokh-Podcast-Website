import { describe, expect, test } from 'vitest';
import {
	DEFAULT_BASE_URL,
	DEFAULT_VISION_MODEL,
	EXIT_CODES,
	REQUESTED_MODEL_ID,
	loadVisualReviewConfig,
	redact
} from '../../scripts/visual-review/config.mjs';
import {
	buildReviewRequest,
	classifyApiError,
	parseReviewResponse,
	withRetries
} from '../../scripts/visual-review/nvidia-client.mjs';
import { SEVERITIES, validateReview } from '../../scripts/visual-review/review-schema.mjs';

// Deterministic, network-free tests for the NVIDIA visual-review integration
// (DSMP-VISION-WORKFLOW-1.0.0 §10). No test contacts a live API.

// ---------- fixtures ----------

const validReview = {
	model_id: 'test-model',
	route: '/should-be-overridden',
	viewport: 'should-be-overridden',
	overall_score: 8,
	findings: [
		{
			id: 'F1',
			severity: 'medium',
			category: 'spacing',
			description: 'Inconsistent spacing between archive cards.',
			visual_evidence: 'Second row of the /watch grid.',
			recommended_fix: 'Align the gap with the --space-l token.',
			confidence: 'high'
		}
	],
	strengths: ['Strong typographic hierarchy.'],
	release_blockers: []
};

const envelope = (content: string, finishReason = 'stop') =>
	JSON.stringify({ choices: [{ message: { content }, finish_reason: finishReason }] });

// ---------- configuration ----------

describe('visual-review configuration', () => {
	test('missing API key is reported with an actionable message', () => {
		const config = loadVisualReviewConfig({});
		expect(config.valid).toBe(false);
		expect(config.missing).toContain('NVIDIA_API_KEY');
		expect(config.errors.join(' ')).toContain('build.nvidia.com');
	});

	test('the end-of-life requested model is refused explicitly, with evidence', () => {
		const config = loadVisualReviewConfig({
			NVIDIA_API_KEY: 'nvapi-test-key-1234567890',
			NVIDIA_VISION_MODEL: REQUESTED_MODEL_ID
		});
		expect(config.valid).toBe(false);
		expect(config.errors.join(' ')).toContain('end-of-life');
		expect(config.errors.join(' ')).toContain(REQUESTED_MODEL_ID);
		expect(config.errors.join(' ')).toContain(DEFAULT_VISION_MODEL);
	});

	test('defaults: verified live model and official endpoint', () => {
		const config = loadVisualReviewConfig({ NVIDIA_API_KEY: 'nvapi-test-key-1234567890' });
		expect(config.valid).toBe(true);
		expect(config.model).toBe(DEFAULT_VISION_MODEL);
		expect(config.baseUrl).toBe(DEFAULT_BASE_URL);
	});

	test('explicit override of model, endpoint, and trailing-slash normalization', () => {
		const config = loadVisualReviewConfig({
			NVIDIA_API_KEY: 'nvapi-test-key-1234567890',
			NVIDIA_VISION_MODEL: 'some/other-vl-model',
			NVIDIA_VISION_BASE_URL: 'https://example.internal/v1/'
		});
		expect(config.valid).toBe(true);
		expect(config.model).toBe('some/other-vl-model');
		expect(config.baseUrl).toBe('https://example.internal/v1');
	});

	test('non-https endpoint is rejected', () => {
		const config = loadVisualReviewConfig({
			NVIDIA_API_KEY: 'nvapi-test-key-1234567890',
			NVIDIA_VISION_BASE_URL: 'http://insecure.example/v1'
		});
		expect(config.valid).toBe(false);
		expect(config.missing.join(' ')).toContain('https');
	});

	test('redact scrubs secret values from any text', () => {
		const key = 'nvapi-super-secret-value-42';
		const text = `Request failed with Authorization: Bearer ${key}`;
		expect(redact(text, [key])).not.toContain(key);
		expect(redact(text, [key])).toContain('[REDACTED]');
		expect(redact('no secrets here', [key])).toBe('no secrets here');
	});
});

// ---------- request construction ----------

describe('request construction', () => {
	test('requires an API key and image payload', () => {
		expect(() =>
			buildReviewRequest({ baseUrl: DEFAULT_BASE_URL, apiKey: '', model: 'm', imageBase64: 'x', route: '/', viewport: 'v' })
		).toThrow();
		expect(() =>
			buildReviewRequest({ baseUrl: DEFAULT_BASE_URL, apiKey: 'k', model: 'm', imageBase64: '', route: '/', viewport: 'v' })
		).toThrow();
	});

	test('builds the verified chat/completions contract', () => {
		const request = buildReviewRequest({
			baseUrl: 'https://integrate.api.nvidia.com/v1',
			apiKey: 'nvapi-test-key',
			model: DEFAULT_VISION_MODEL,
			imageBase64: 'aGVsbG8=',
			route: '/watch',
			viewport: '1440x900',
			context: 'Test context.'
		});
		expect(request.url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
		expect(request.headers.authorization).toBe('Bearer nvapi-test-key');
		expect(request.headers['content-type']).toBe('application/json');
		expect(request.body.model).toBe(DEFAULT_VISION_MODEL);
		expect(request.body.stream).toBe(false);
		expect(request.body.max_tokens).toBe(2048);

		const content = request.body.messages[0].content;
		expect(content[0].type).toBe('text');
		expect(content[0].text).toContain('machine-readable JSON');
		expect(content[1].text).toContain('route: /watch');
		expect(content[1].text).toContain('viewport: 1440x900');
		expect(content[2].type).toBe('image_url');
		expect(content[2].image_url.url).toBe('data:image/png;base64,aGVsbG8=');
	});
});

// ---------- response parsing and validation ----------

describe('response parsing', () => {
	test('parses a well-formed review and grounds route/viewport in the capture', () => {
		const result = parseReviewResponse(envelope(JSON.stringify(validReview)), {
			expectedRoute: '/watch',
			expectedViewport: '1440x900'
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.route).toBe('/watch');
		expect(result.data.viewport).toBe('1440x900');
		expect(result.data.overall_score).toBe(8);
		expect(result.data.findings[0].severity).toBe('medium');
	});

	test('extracts JSON from prose and markdown fences', () => {
		const wrapped =
			'Here is my review:\n\n```json\n' + JSON.stringify(validReview) + '\n```\n\nOverall, solid work.';
		const result = parseReviewResponse(envelope(wrapped), {
			expectedRoute: '/',
			expectedViewport: '390x844'
		});
		expect(result.ok).toBe(true);
		expect(result.extraction).toBe('lenient');
	});

	test('coerces a numeric-string overall_score', () => {
		const result = parseReviewResponse(
			envelope(JSON.stringify({ ...validReview, overall_score: '9' })),
			{ expectedRoute: '/', expectedViewport: 'v' }
		);
		expect(result.ok && result.data.overall_score).toBe(9);
	});

	test('malformed body and missing content are reported as malformed', () => {
		expect(parseReviewResponse('not json at all', {}).reason).toBe('malformed');
		expect(parseReviewResponse(JSON.stringify({ choices: [] }), {}).reason).toBe('malformed');
	});

	test('truncated responses (finish_reason=length) are detected', () => {
		const result = parseReviewResponse(envelope('{"model_id": "x", "find', 'length'), {});
		expect(result.reason).toBe('truncated');
	});

	test('model refusals are detected as refusals, not reviews', () => {
		const result = parseReviewResponse(envelope("I can't assist with evaluating this image."), {});
		expect(result.reason).toBe('refusal');
	});

	test('schema violations are rejected with precise errors', () => {
		const bad = { ...validReview, findings: [{ ...validReview.findings[0], severity: 'major' }] };
		const result = parseReviewResponse(envelope(JSON.stringify(bad)), {
			expectedRoute: '/',
			expectedViewport: 'v'
		});
		expect(result.ok).toBe(false);
		expect(result.reason).toBe('invalid');
		expect(result.message).toContain('severity');
	});

	test('out-of-range scores are rejected', () => {
		const result = parseReviewResponse(envelope(JSON.stringify({ ...validReview, overall_score: 42 })), {});
		expect(result.ok).toBe(false);
		expect(result.reason).toBe('invalid');
	});

	test('validateReview exposes the severity enum', () => {
		expect(SEVERITIES).toEqual(['critical', 'high', 'medium', 'low', 'observation']);
		expect(validateReview(validReview).ok).toBe(true);
	});
});

// ---------- error classification ----------

describe('error classification (mandate §3)', () => {
	test('401 → authentication, not retryable', () => {
		const c = classifyApiError({ status: 401, body: 'Header of type authorization was missing' });
		expect(c.kind).toBe('authentication');
		expect(c.retryable).toBe(false);
	});

	test('403 → authorization, not retryable', () => {
		expect(classifyApiError({ status: 403, body: 'forbidden' }).kind).toBe('authorization');
	});

	test('429 → rate limit, retryable', () => {
		const c = classifyApiError({ status: 429, body: 'too many requests' });
		expect(c.kind).toBe('rate_limit');
		expect(c.retryable).toBe(true);
	});

	test('410 → model unavailable (end-of-life), not retryable', () => {
		const c = classifyApiError({ status: 410, body: 'has reached its end of life' });
		expect(c.kind).toBe('model_unavailable');
		expect(c.retryable).toBe(false);
	});

	test('400 → invalid request, not retryable', () => {
		expect(classifyApiError({ status: 400, body: 'bad image' }).kind).toBe('invalid_request');
	});

	test('5xx → model-side failure, retryable', () => {
		expect(classifyApiError({ status: 502, body: 'bad gateway' }).kind).toBe('model_error');
		expect(classifyApiError({ status: 502, body: '' }).retryable).toBe(true);
	});

	test('AbortError → timeout, retryable; statusless → network, retryable', () => {
		const abort = new Error('The operation was aborted');
		abort.name = 'AbortError';
		expect(classifyApiError(abort).kind).toBe('timeout');
		expect(classifyApiError(new TypeError('fetch failed')).kind).toBe('network');
	});
});

// ---------- bounded retries ----------

describe('withRetries', () => {
	const noSleep = { sleep: async () => {} };

	test('succeeds on the first attempt', async () => {
		const { result, attempts } = await withRetries(async () => 'ok', noSleep);
		expect(result).toBe('ok');
		expect(attempts).toBe(1);
	});

	test('retries retryable failures and succeeds later', async () => {
		let calls = 0;
		const retries: unknown[] = [];
		const { result, attempts } = await withRetries(
			async () => {
				calls++;
				if (calls < 3) throw Object.assign(new Error('x'), { classified: classifyApiError({ status: 429, body: '' }) });
				return 'ok';
			},
			{ ...noSleep, onRetry: (n: number) => retries.push(n) }
		);
		expect(result).toBe('ok');
		expect(attempts).toBe(3);
		expect(retries).toEqual([1, 2]);
	});

	test('does not retry non-retryable failures', async () => {
		let calls = 0;
		await expect(
			withRetries(
				async () => {
					calls++;
					throw Object.assign(new Error('x'), { classified: classifyApiError({ status: 401, body: '' }) });
				},
				noSleep
			)
		).rejects.toThrow();
		expect(calls).toBe(1);
	});

	test('gives up after the retry budget', async () => {
		let calls = 0;
		await expect(
			withRetries(
				async () => {
					calls++;
					throw Object.assign(new Error('x'), { classified: classifyApiError({ status: 502, body: '' }) });
				},
				{ ...noSleep, retries: 2 }
			)
		).rejects.toMatchObject({ attempts: 3 });
		expect(calls).toBe(3);
	});
});

// ---------- exit codes ----------

describe('exit codes', () => {
	test('distinct, documented exit codes', () => {
		expect(EXIT_CODES).toEqual({ OK: 0, MISSING_CONFIG: 2, API_FAILURE: 3, REVIEW_INVALID: 4, ENV_FAILURE: 5 });
	});
});
