#!/usr/bin/env node
// Visual-QA workflow orchestrator (DSMP-VISION-WORKFLOW-1.0.0 §4).
//
//   pnpm visual:review          full workflow: capture → live NVIDIA VLM review
//   pnpm visual:review:dry      capture + build requests, send nothing
//
// Steps: validate configuration → prepare disposable [DEV] fixture DB →
// production build → launch on a verified-free port → capture inventory →
// (dry-run: build + record requests | live: submit to the configured model) →
// save structured artifacts → severity summary → meaningful exit code.

import { readFileSync } from 'node:fs';
import { loadDotEnv, loadVisualReviewConfig, redact, EXIT_CODES } from './config.mjs';
import { MAX_IMAGE_BYTES, requestReview, withRetries } from './nvidia-client.mjs';
import { buildApp, captureInventory, ensureFreePort, prepareFixtureDb, startServer, writeJson } from './capture.mjs';

const OUT_DIR = 'tests/visual-review';
const REVIEWS_DIR = `${OUT_DIR}/artifacts/reviews`;
import { mkdirSync } from 'node:fs';
mkdirSync(REVIEWS_DIR, { recursive: true });

const dryRun = process.argv.includes('--dry-run');
const PORT = Number(process.env.VISUAL_REVIEW_PORT ?? 43940);
const DB_PATH = `${process.cwd()}/data/visual-review.db`;

loadDotEnv();
const config = loadVisualReviewConfig();

function exit(code, message) {
	if (message) console.error(message);
	process.exit(code);
}

if (dryRun) {
	console.log('[visual-review] DRY RUN — requests will be built but not sent.');
} else {
	// Configuration is validated up front, with an actionable message and a
	// distinct exit code — never a stack trace (mandate §3).
	if (!config.valid) {
		for (const error of config.errors) console.error(`[visual-review] ${error}`);
		exit(EXIT_CODES.MISSING_CONFIG);
	}
	console.log(`[visual-review] model: ${config.model}`);
	console.log(`[visual-review] endpoint: ${config.baseUrl} (key redacted from all output)`);
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

	let server;
	try {
		console.log(`[visual-review] launching production server on port ${PORT}…`);
		server = await startServer({ port: PORT, dbPath: DB_PATH });
	} catch (error) {
		exit(EXIT_CODES.ENV_FAILURE, `[visual-review] ${error.message}`);
	}

	let inventory;
	try {
		console.log('[visual-review] capturing screenshot inventory…');
		inventory = await captureInventory({
			base: server.base,
			outDir: OUT_DIR,
			adminUsername: fixture.adminUsername,
			adminPassword: fixture.adminPassword,
			articleId: fixture.articleId
		});
	} catch (error) {
		server.stop();
		exit(EXIT_CODES.ENV_FAILURE, `[visual-review] capture failed: ${error.message}`);
	}
	server.stop();

	writeJson(`${OUT_DIR}/artifacts/inventory.json`, {
		capturedAt: new Date().toISOString(),
		count: inventory.length,
		items: inventory.map(({ file, ...meta }) => ({ ...meta, file: file.replace(`${process.cwd()}/`, '') }))
	});
	console.log(`[visual-review] captured ${inventory.length} screenshots → ${OUT_DIR}/captures/`);

	if (dryRun) {
		// Build every request exactly as it would be sent, record its metadata
		// (never the key, never the base64 blob), and stop before sending.
		const requests = [];
		for (const item of inventory) {
			const image = readFileSync(item.payloadForReview);
			const body = {
				model: config.model,
				route: item.route,
				viewport: item.viewport,
				imageBytes: image.length,
				imageSha256: item.sha256,
				endpoint: `${config.baseUrl}/chat/completions`,
				maxTokens: 2048,
				promptChars: 0
			};
			requests.push({ id: item.id, ...body, note: 'dry run: request built, not sent' });
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
		const image = readFileSync(item.payloadForReview);
		if (image.length > MAX_IMAGE_BYTES) {
			apiFailures++;
			results.push({ id: item.id, ok: false, kind: 'image_too_large', message: `capture is ${image.length} bytes` });
			continue;
		}
		const imageBase64 = image.toString('base64');
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
						viewport: item.viewport
					}),
				{
					retries: 2,
					onRetry: (n, classified) =>
						console.log(`retry ${n} (${classified.kind})`)
				}
			);
			results.push({ id: item.id, ok: true, data: attempt.result.data, attempts: attempt.attempts });
			console.log(`score ${attempt.result.data.overall_score}/10, ${attempt.result.data.findings.length} finding(s)`);
		} catch (error) {
			const classified = error.classified ?? { kind: 'unknown', message: String(error) };
			if (classified.kind.startsWith('review_')) invalidReviews++;
			else apiFailures++;
			results.push({ id: item.id, ok: false, kind: classified.kind, message: redact(classified.message, [config.apiKey]) });
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
		model: config.model,
		endpoint: `${config.baseUrl}/chat/completions`,
		screenshots: inventory.length,
		reviewed: results.filter((r) => r.ok).length,
		apiFailures,
		invalidReviews,
		totalFindings: findings.length,
		findingsBySeverity: bySeverity,
		releaseBlockers: results.filter((r) => r.ok).flatMap((r) => r.data.release_blockers.map((b) => `${r.id}: ${b}`)),
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
