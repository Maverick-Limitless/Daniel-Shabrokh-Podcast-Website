import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

/**
 * Product-boundary guard (DSHPODCAST-GLM-NVIDIA-VISION-WORKFLOW-2.0.0 §0/§8):
 * NVIDIA visual review is a development-time reviewer and must NEVER be part
 * of the website's runtime. These tests fail if any NVIDIA workflow code,
 * reference, or dependency leaks into the application.
 */

function walk(dir: string, files: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			walk(full, files);
		} else {
			files.push(full);
		}
	}
	return files;
}

describe('NVIDIA reviewer stays outside the product runtime', () => {
	test('no NVIDIA/visual-review references exist anywhere under src/', () => {
		const offenders: string[] = [];
		for (const file of walk('src')) {
			const content = readFileSync(file, 'utf8');
			if (/nvidia|nemotron|NVIDIA_API_KEY|visual-review|nvapi-/i.test(content)) {
				offenders.push(file);
			}
		}
		expect(offenders, `runtime boundary violated in: ${offenders.join(', ')}`).toHaveLength(0);
	});

	test('no NVIDIA packages exist in either dependency graph', () => {
		const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
			dependencies: Record<string, string>;
			devDependencies: Record<string, string>;
		};
		const all = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
		const offenders = all.filter((dep) => /nvidia|nemotron/i.test(dep));
		expect(offenders).toHaveLength(0);
	});

	test('the workflow is dependency-free (uses only the runtime fetch API)', () => {
		const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies: Record<string, string> };
		expect(Object.keys(pkg.dependencies)).not.toContain('@azure/ai-inference');
		// The reviewer tooling lives under scripts/ and tests/, outside src/.
		expect(walk('scripts/visual-review').length).toBeGreaterThan(0);
	});

	test('.env.example contains placeholders only — no realistic secrets', () => {
		const example = readFileSync('.env.example', 'utf8');
		expect(example).not.toMatch(/nvapi-[A-Za-z0-9]{10,}/);
		expect(example).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{15,}/);
		// NVIDIA key entry must exist but be empty/placeholder.
		expect(example).toMatch(/NVIDIA_API_KEY=""/);
	});

	test('tracked files contain no real-looking API keys', () => {
		// Focused scan of the files most likely to leak a key: workflow code,
		// docs, and env examples. Fake test fixtures use 'nvapi-test-key'
		// literals, which are asserted against the real key format.
		const candidates = [
			...walk('scripts/visual-review'),
			'.env.example',
			'README.md'
		];
		for (const file of candidates) {
			const content = readFileSync(file, 'utf8');
			expect(content, `${file} contains a realistic nvapi- key`).not.toMatch(/nvapi-[A-Za-z0-9_-]{25,}/);
			expect(content, `${file} contains a realistic bearer token`).not.toMatch(
				/Bearer\s+[A-Za-z0-9._-]{30,}/
			);
		}
	});
});
