#!/usr/bin/env node
// Visual-QA workflow orchestrator (DSHPODCAST-GLM-NVIDIA-VISION-WORKFLOW-2.0.0 §5).
//
//   pnpm visual:review          full workflow: capture → live NVIDIA VLM review
//   pnpm visual:review:dry      capture + build requests, send nothing
//
// Steps: load .env → validate configuration and port → prepare disposable
// [DEV] fixture DB → production build → launch on a verified-free port →
// capture inventory (with per-route skip reasons) → (dry-run: build + record
// requests | live: submit to the configured model with retries) → structured
// artifacts → severity summary → meaningful exit code.
//
// The live fix/review loop (review → GLM triage → fix → recapture → re-review)
// is agent-driven; VISUAL_REVIEW_ITERATIONS caps the documented rounds.
// This script performs one capture+review pass per invocation.

import { mkdirSync, readFileSync } from 'node:fs';
import {
	loadDotEnv,
	loadVisualReviewConfig,
	redact,
	validatePort,
	EXIT_CODES
} from './config.mjs';
import {
	REVIEW_PROMPT,
	requestReview,
	validateImagePayload,
	withRetries
} from './nvidia-client.mjs';
import {
	buildApp,
	captureInventory,
	ensureFreePort,
	prepareFixtureDb,
	startServer,
	writeJson
} from './capture.mjs';

// .env is loaded BEFORE any env var is read (VISUAL_REVIEW_PORT lives there).
loadDotEnv();

const dryRun = process.argv.includes('--dry-run');
const portCheck = validatePort(process.env.VISUAL_REVIEW_PORT ?? 43940);
const PORT = portCheck.ok ? portCheck.port : null;
const DB_PATH = `${process.cwd()}/data/visual-review.db`;

const config = loadVisualReviewConfig();
const OUT_DIR = config.reportDir;
const REVIEWS_DIR = `${OUT_DIR}/artifacts/reviews`;
mkdirSync(REVIEWS_DIR, { recursive: true });

/** Live server handle for cleanup on failure paths and signals. */
let activeServer = null;
let stopping = false;

function stopServer() {
	if (activeServer && !stopping) {
		stopping = true;
		activeServer.stop();
		activeServer = null;
	}
}

process.on('SIGINT', () => {
	stopServer();
	process.exit(130);
});
process.on('SIGTERM', () => {
	stopServer();
	process.exit(143);
});

function exit(code, message) {
	stopServer();
	if (message) console.error(message);
	process.exit(code);
}

if (dryRun) {
	console.log('[visual-review] DRY RUN — requests will be built but not sent.');
} else {
	// Configuration is validated up front, with an actionable message and a
	// distinct exit code — never a stack trace (mandate §5A).
	if (!config.valid) {
		for (const error of config.errors) console.error(`[visual-review] ${error}`);
		exit(EXIT_CODES.MISSING_CONFIG);
	}
	console.log(`[visual-review] model: ${config.model}`);
	console.log(`[visual-review] endpoint: ${config.baseUrl} (key redacted from all output)`);
	console.log(
		`[visual-review] knobs: timeout=${config.timeoutMs}ms retries=${config.retries} maxImage=${config.maxImageBytes}B iterations<=${config.iterations}`
	);
}

if (!PORT) {
	exit(EXIT_CODES.ENV_FAILURE, `[visual-review] ${portCheck.message}`);
}

const run = async () => {
	try {
		await ensureFreePort(PORT);
	} catch (error) {
		exit(EXIT_CODES.ENV_FAILURE, `[visual-review] ${error.message}`);
	}

	console.log('[visual-review] preparing disposable [DEV] fixture database…');
	let fixture;
	try {
		fixture = await prepareFixtureDb(DB_PATH);
	} catch (error) {
		exit(EXIT_CODES.ENV_FAILURE, `[visual-review] fixture preparation failed: ${error.message}`);
	}

	console.log('[visual-review] building production bundle…');
	try {
		buildApp(PORT);
	} catch (error) {
		exit(EXIT_CODES.ENV_FAILURE, `[visual-review] ${error.message}`);
	}

	console.log(`[visual-review] launching production server on port ${PORT}…`);
	let server;
	try {
		server = await startServer({ port: PORT, dbPath: DB_PATH });
		activeServer = server;
	} catch (error) {
		exit(EXIT_CODES.ENV_FAILURE, `[visual-review] ${error.message}`);
	}

	let captured;
	try {
		console.log('[visual-review] capturing screenshot inventory…');
		captured = await captureInventory({
			base: server.base,
			outDir: OUT_DIR,
			adminUsername: fixture.adminUsername,
			adminPassword: fixture.adminPassword,
			articleId: fixture.articleId,
			maxImageBytes: config.maxImageBytes
		});
	} catch (error) {
		exit(EXIT_CODES.ENV_FAILURE, `[visual-review] capture failed: ${redact(error.message, [config.apiKey])}`);
	}
	stopServer();

	const { items: inventory, skipped, meta } = captured;

	writeJson(`${OUT_DIR}/artifacts/inventory.json`, {
		...meta,
		count: inventory.length,
		skipped,
		items: inventory.map(({ payloadForReview, ...item }) => ({
			...item,
			payloadForReview: payloadForReview.replace(`${process.cwd()}/`, '')
		}))
	});
	console.log(`[visual-review] captured ${inventory.length} screenshots → ${OUT_DIR}/captures/`);
	for (const skip of skipped) {
		console.log(`[visual-review] SKIPPED ${skip.id || skip.route}: ${skip.reason}`);
	}

	if (dryRun) {
		// Build every request exactly as it would be sent, record its metadata
		// (never the key, never the base64 blob), and stop before sending.
		// The hash and byte size are of the payload that WOULD be sent.
		const requests = [];
		for (const item of inventory) {
			const payloadCheck = validateImagePayload({
				bytes: item.payloadBytes,
				mimeType: 'image/png',
				maxImageBytes: config.maxImageBytes
			});
			requests.push({
				id: item.id,
				model: config.model,
				route: item.route,
				viewport: item.viewport,
				imageBytes: item.payloadBytes,
				imageSha256: item.payloadSha256,
				payloadCheckOk: payloadCheck.ok,
				payloadCheckMessage: payloadCheck.ok ? null : payloadCheck.message,
				endpoint: `${config.baseUrl}/chat/completions`,
				promptChars: REVIEW_PROMPT.length,
				note: 'dry run: request built, not sent'
			});
		}
		writeJson(`${OUT_DIR}/artifacts/dry-run-summary.json`, {
			mode: 'dry-run',
			timestamp: new Date().toISOString(),
			model: config.model,
			endpoint: `${config.baseUrl}/chat/completions`,
			apiKeyPresent: Boolean(config.apiKey),
			requests
		});
		console.log(`[visual-review] dry run complete: ${requests.length} requests built, none sent.`);
		console.log(`[visual-review] artifacts: ${OUT_DIR}/artifacts/dry-run-summary.json`);
		exit(EXIT_CODES.OK);
	}

	// ---- live review ----
	const results = [];
	let apiFailures = 0;
	let invalidReviews = 0;

	for (const [index, item] of inventory.entries()) {
		const payloadCheck = validateImagePayload({
			bytes: item.payloadBytes,
			mimeType: 'image/png',
			maxImageBytes: config.maxImageBytes
		});
		if (!payloadCheck.ok) {
			apiFailures++;
			results.push({ id: item.id, ok: false, kind: 'image_too_large', message: payloadCheck.message });
			continue;
		}
		const imageBase64 = readFileSync(item.payloadForReview).toString('base64');
		process.stdout.write(`[visual-review] (${index + 1}/${inventory.length}) ${item.id} … `);
		try {
			const attempt = await withRetries(
				() =>
					requestReview({
						baseUrl: config.baseUrl,
						apiKey: config.apiKey,
						model: config.model,
						imageBase64,
						route: item.route,
						viewport: item.viewport,
						timeoutMs: config.timeoutMs
					}),
				{
					retries: config.retries,
					onRetry: (n, classified) => console.log(`retry ${n} (${classified.kind})`)
				}
			);
			results.push({ id: item.id, ok: true, data: attempt.result.data, attempts: attempt.attempts });
			console.log(`score ${attempt.result.data.overall_score}/10, ${attempt.result.data.findings.length} finding(s)`);
		} catch (error) {
			const classified = error.classified ?? { kind: 'unknown', message: String(error) };
			if (classified.kind.startsWith('review_')) invalidReviews++;
			else apiFailures++;
			results.push({
				id: item.id,
				ok: false,
				kind: classified.kind,
				message: redact(classified.message, [config.apiKey])
			});
			console.log(`FAILED (${classified.kind})`);
		}
		// Be polite to unpublished per-model rate limits.
		await new Promise((r) => setTimeout(r, 500));
	}

	for (const result of results) {
		writeJson(`${REVIEWS_DIR}/${result.id}.json`, result);
	}

	const findings = results.filter((r) => r.ok).flatMap((r) => r.data.findings);
	const bySeverity = {};
	for (const finding of findings) {
		bySeverity[finding.severity] = (bySeverity[finding.severity] ?? 0) + 1;
	}

	const summary = {
		timestamp: new Date().toISOString(),
		schemaVersion: 2,
		model: config.model,
		endpoint: `${config.baseUrl}/chat/completions`,
		screenshots: inventory.length,
		reviewed: results.filter((r) => r.ok).length,
		apiFailures,
		invalidReviews,
		totalFindings: findings.length,
		findingsBySeverity: bySeverity,
		releaseBlockers: results
			.filter((r) => r.ok)
			.flatMap((r) => r.data.release_blockers.map((b) => `${r.id}: ${b}`)),
		overallScores: Object.fromEntries(results.filter((r) => r.ok).map((r) => [r.id, r.data.overall_score]))
	};
	writeJson(`${OUT_DIR}/artifacts/summary.json`, summary);

	console.log('\n[visual-review] ===== severity-ranked summary =====');
	console.log(`screenshots reviewed: ${summary.reviewed}/${summary.screenshots}`);
	console.log(`findings: ${summary.totalFindings}`, JSON.stringify(bySeverity));
	if (summary.releaseBlockers.length) {
		console.log('RELEASE BLOCKERS:');
		for (const blocker of summary.releaseBlockers) console.log(`  - ${blocker}`);
	} else {
		console.log('release blockers: none reported');
	}

	if (apiFailures) exit(EXIT_CODES.API_FAILURE, `[visual-review] ${apiFailures} API failure(s) — see artifacts/reviews/`);
	if (invalidReviews) exit(EXIT_CODES.REVIEW_INVALID, `[visual-review] ${invalidReviews} response(s) failed schema validation — see artifacts/reviews/`);
	exit(EXIT_CODES.OK);
};

run().catch((error) => {
	exit(EXIT_CODES.ENV_FAILURE, `[visual-review] unexpected failure: ${redact(String(error), [config.apiKey])}`);
});
