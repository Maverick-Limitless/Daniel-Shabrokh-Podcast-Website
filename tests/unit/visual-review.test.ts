import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import {
	DEFAULT_BASE_URL,
	DEFAULT_VISION_MODEL,
	EXIT_CODES,
	REQUESTED_MODEL_ID,
	loadDotEnv,
	loadVisualReviewConfig,
	redact,
	validatePort
} from '../../scripts/visual-review/config.mjs';
import {
	buildReviewRequest,
	classifyApiError,
	parseReviewResponse,
	validateImagePayload,
	withRetries,
	REVIEW_PROMPT
} from '../../scripts/visual-review/nvidia-client.mjs';
import { SCHEMA_VERSION, SEVERITIES, validateReview } from '../../scripts/visual-review/review-schema.mjs';

// Deterministic, network-free tests for the NVIDIA visual-review integration
// (DSHPODCAST-GLM-NVIDIA-VISION-WORKFLOW-2.0.0 §6). No test contacts a live API.

// ---------- fixtures ----------

const validReview = {
	schema_version: SCHEMA_VERSION,
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
			expected_user_impact: 'Archives feel unpolished; scanning between cards is effortful.',
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

	test('defaults: verified live model, official endpoint, and tuning knobs', () => {
		const config = loadVisualReviewConfig({ NVIDIA_API_KEY: 'nvapi-test-key-1234567890' });
		expect(config.valid).toBe(true);
		expect(config.model).toBe(DEFAULT_VISION_MODEL);
		expect(config.baseUrl).toBe(DEFAULT_BASE_URL);
		expect(config.timeoutMs).toBe(90_000);
		expect(config.retries).toBe(2);
		expect(config.maxImageBytes).toBe(4 * 1024 * 1024);
		expect(config.iterations).toBe(3);
		expect(config.reportDir).toBe('tests/visual-review');
	});

	test('explicit overrides of model, endpoint, and knob values', () => {
		const config = loadVisualReviewConfig({
			NVIDIA_API_KEY: 'nvapi-test-key-1234567890',
			NVIDIA_VISION_MODEL: 'some/other-vl-model',
			NVIDIA_VISION_BASE_URL: 'https://example.internal/v1/',
			NVIDIA_VISION_TIMEOUT_MS: '45000',
			NVIDIA_VISION_RETRIES: '4',
			VISUAL_REVIEW_MAX_IMAGE_BYTES: '1048576',
			VISUAL_REVIEW_ITERATIONS: '2',
			VISUAL_REVIEW_REPORT_DIR: 'tests/other-review'
		});
		expect(config.valid).toBe(true);
		expect(config.model).toBe('some/other-vl-model');
		expect(config.baseUrl).toBe('https://example.internal/v1');
		expect(config.timeoutMs).toBe(45_000);
		expect(config.retries).toBe(4);
		expect(config.maxImageBytes).toBe(1_048_576);
		expect(config.iterations).toBe(2);
		expect(config.reportDir).toBe('tests/other-review');
	});

	test('out-of-range or non-integer knobs make the configuration invalid', () => {
		const config = loadVisualReviewConfig({
			NVIDIA_API_KEY: 'nvapi-test-key-1234567890',
			NVIDIA_VISION_RETRIES: '99',
			'NVIDIA_VISION_TIMEOUT_MS': 'fast'
		});
		expect(config.valid).toBe(false);
		expect(config.errors.join(' ')).toContain('NVIDIA_VISION_RETRIES');
		expect(config.errors.join(' ')).toContain('NVIDIA_VISION_TIMEOUT_MS');
	});

	test('non-https endpoint is rejected', () => {
		const config = loadVisualReviewConfig({
			NVIDIA_API_KEY: 'nvapi-test-key-1234567890',
			NVIDIA_VISION_BASE_URL: 'http://insecure.example/v1'
		});
		expect(config.valid).toBe(false);
		expect(config.missing.join(' ')).toContain('https');
	});

	test('redact scrubs exact secrets and truncated/pattern key material', () => {
		const key = 'nvapi-super-secret-value-42';
		expect(redact(`Authorization: Bearer ${key}`, [key])).toBe('Authorization: Bearer [REDACTED]');
		// Pattern fallback: a truncated key fragment is still scrubbed.
		expect(redact('error body mentions nvapi-super-secret-val', [])).not.toContain('nvapi-super-secret-val');
		expect(redact('token: Bearer abcdefgh12345678', [])).toBe('token: Bearer [REDACTED]');
	});

	test('validatePort accepts integers in range and rejects junk', () => {
		expect(validatePort('43940')).toEqual({ ok: true, port: 43940 });
		expect(validatePort(3000)).toEqual({ ok: true, port: 3000 });
		const bad = validatePort('not-a-number');
		expect(bad.ok).toBe(false);
		expect(bad.message).toContain('1 and 65535');
		expect(validatePort('0').ok).toBe(false);
		expect(validatePort('70000').ok).toBe(false);
	});
});

describe('loadDotEnv', () => {
	const dir = mkdtempSync(join(tmpdir(), 'dsmp-env-'));
	const path = join(dir, '.env');
	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	test('parses values, strips only wrapping quotes, and never overrides shell env', () => {
		writeFileSync(
			path,
			[
				'SIMPLE=value123',
				'QUOTED="wrapped value"',
				'APOSTROPHE=don\'t',
				'HASH_IN=value#with-hash',
				'SHELL_WINS=from-file'
			].join('\n')
		);
		const saved = { ...process.env };
		try {
			// A shell-provided variable must win over the file value.
			process.env.SHELL_WINS = 'from-shell';
			loadDotEnv(path);
			expect(process.env.SIMPLE).toBe('value123');
			expect(process.env.QUOTED).toBe('wrapped value');
			expect(process.env.APOSTROPHE).toBe("don't");
			expect(process.env.HASH_IN).toBe('value#with-hash');
			expect(process.env.SHELL_WINS).toBe('from-shell');
		} finally {
			for (const key of ['SIMPLE', 'QUOTED', 'APOSTROPHE', 'HASH_IN', 'SHELL_WINS']) delete process.env[key];
			process.env.SHELL_WINS = saved.SHELL_WINS;
		}
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
		expect(content[0].text).toContain(`"schema_version": ${SCHEMA_VERSION}`);
		expect(content[0].text).toContain('"nit"');
		expect(content[0].text).toContain('expected_user_impact');
		expect(content[1].text).toContain('route: /watch');
		expect(content[1].text).toContain('viewport: 1440x900');
		expect(content[2].type).toBe('image_url');
		expect(content[2].image_url.url).toBe('data:image/png;base64,aGVsbG8=');
	});
});

// ---------- image payload validation ----------

describe('image payload validation (mandate §5A)', () => {
	test('accepts allowed MIME types within the size limit', () => {
		expect(validateImagePayload({ bytes: 1000, mimeType: 'image/png' }).ok).toBe(true);
		expect(validateImagePayload({ bytes: 1000, mimeType: 'image/jpeg' }).ok).toBe(true);
	});

	test('rejects unsupported MIME types', () => {
		const result = validateImagePayload({ bytes: 1000, mimeType: 'text/html' });
		expect(result.ok).toBe(false);
		expect(result.message).toContain('image/png');
	});

	test('rejects payloads over the configured limit with an actionable message', () => {
		const result = validateImagePayload({ bytes: 5 * 1024 * 1024, mimeType: 'image/png', maxImageBytes: 4 * 1024 * 1024 });
		expect(result.ok).toBe(false);
		expect(result.message).toContain('viewport-only');
	});

	test('rejects non-positive sizes', () => {
		expect(validateImagePayload({ bytes: 0, mimeType: 'image/png' }).ok).toBe(false);
		expect(validateImagePayload({ bytes: -5, mimeType: 'image/png' }).ok).toBe(false);
	});
});

// ---------- response parsing and validation ----------

describe('response parsing (schema v2)', () => {
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
		expect(result.data.findings[0].expected_user_impact).toContain('Archives');
		expect(result.data.schema_version).toBe(SCHEMA_VERSION);
	});

	test('extracts JSON from prose, fences, escaped quotes, and stray braces', () => {
		const tricky = JSON.stringify({ ...validReview, findings: [{ ...validReview.findings[0], description: 'a "quoted" {brace} problem' }] });
		for (const wrapped of [
			`prefix { "junk": true } text\n\`\`\`json\n${tricky}\n\`\`\`\nsuffix`,
			`analysis before ${tricky} analysis after`
		]) {
			const result = parseReviewResponse(envelope(wrapped), { expectedRoute: '/', expectedViewport: 'v' });
			expect(result.ok).toBe(true);
		}
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
		const result = parseReviewResponse(envelope('{"schema_version": 2, "find', 'length'), {});
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

	test('the v1 severity vocabulary ("observation") is rejected by schema v2', () => {
		const legacy = {
			...validReview,
			findings: [{ ...validReview.findings[0], severity: 'observation' }]
		};
		const result = parseReviewResponse(envelope(JSON.stringify(legacy)), {});
		expect(result.ok).toBe(false);
		expect(result.reason).toBe('invalid');
	});

	test('missing expected_user_impact is rejected', () => {
		const { expected_user_impact, ...findingWithoutImpact } = validReview.findings[0];
		const result = parseReviewResponse(
			envelope(JSON.stringify({ ...validReview, findings: [findingWithoutImpact] })),
			{}
		);
		expect(result.ok).toBe(false);
	});

	test('out-of-range scores are rejected', () => {
		const result = parseReviewResponse(envelope(JSON.stringify({ ...validReview, overall_score: 42 })), {});
		expect(result.ok).toBe(false);
		expect(result.reason).toBe('invalid');
	});

	test('validateReview exposes the v2 severity vocabulary and schema version', () => {
		expect(SEVERITIES).toEqual(['critical', 'high', 'medium', 'low', 'nit']);
		expect(SCHEMA_VERSION).toBe(2);
		expect(validateReview(validReview).ok).toBe(true);
	});

	test('the review prompt forbids inferring invisible behavior and demands grounded evidence', () => {
		expect(REVIEW_PROMPT).toContain('Do NOT infer invisible behavior');
		expect(REVIEW_PROMPT).toContain('accessibility compliance');
		expect(REVIEW_PROMPT).toContain('An empty findings array is a valid answer');
	});
});

// ---------- error classification ----------

describe('error classification (mandate §5C)', () => {
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

	test('413 → payload too large, not retryable, with actionable advice', () => {
		const c = classifyApiError({ status: 413, body: 'request entity too large' });
		expect(c.kind).toBe('payload_too_large');
		expect(c.retryable).toBe(false);
		expect(c.message).toContain('viewport-only');
	});

	test('415 → unsupported media type, not retryable', () => {
		const c = classifyApiError({ status: 415, body: 'unsupported media' });
		expect(c.kind).toBe('unsupported_media');
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

	test('uses linear backoff spacing between attempts', async () => {
		const delays: number[] = [];
		const sleep = async (ms: number) => delays.push(ms);
		await expect(
			withRetries(
				async () => {
					throw Object.assign(new Error('x'), { classified: classifyApiError({ status: 429, body: '' }) });
				},
				{ sleep, retries: 2, delayMs: 2000 }
			)
		).rejects.toThrow();
		expect(delays).toEqual([2000, 4000]);
	});
});

// ---------- exit codes ----------

describe('exit codes', () => {
	test('distinct, documented exit codes', () => {
		expect(EXIT_CODES).toEqual({ OK: 0, MISSING_CONFIG: 2, API_FAILURE: 3, REVIEW_INVALID: 4, ENV_FAILURE: 5 });
	});
});
