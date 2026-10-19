import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

/**
 * Verifies actual WCAG contrast ratios for the design tokens * "Verify actual contrast rather than assuming a color combination is
 * accessible"). tokens.css is the single source of truth.
 */

const css = readFileSync(new URL('../../src/lib/styles/tokens.css', import.meta.url), 'utf8');

const tokens: Record<string, string> = {};
for (const match of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)) {
	tokens[match[1]] = match[2];
}

function luminance(hex: string): number {
	const channels = [0, 2, 4]
		.map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255)
		.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
	return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string): number {
	const a = luminance(foreground);
	const b = luminance(background);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// [foreground token, background token, minimum ratio]
const CASES: [string, string, number][] = [
	['color-ink', 'color-ivory', 4.5], // body text on ivory
	['color-text-muted-on-ivory', 'color-ivory', 4.5], // secondary text
	['color-brass-strong', 'color-ivory', 4.5], // small accent text (links)
	['color-text-on-ink', 'color-ink', 4.5], // body text on ink surfaces
	['color-text-muted-on-ink', 'color-ink', 4.5], // secondary text on ink
	['color-brass-bright', 'color-ink', 4.5], // accent text on ink
	['color-error', 'color-ivory', 4.5], // error text on light forms
	['color-ink', 'color-brass-bright', 4.5], // hero CTA: ink text on brass-bright
	['color-brass', 'color-ink', 3], // focus ring (non-text) on ink
	['color-brass', 'color-ivory', 3] // focus ring (non-text) on ivory
];

describe('design token contrast (WCAG)', () => {
	test.each(CASES)('--%s on --%s must reach %s:1', (fg, bg, min) => {
		expect(tokens[fg], `token --${fg} must be defined with a hex value`).toBeTruthy();
		expect(tokens[bg], `token --${bg} must be defined with a hex value`).toBeTruthy();
		const ratio = contrast(tokens[fg], tokens[bg]);
		expect(
			ratio,
			`--${fg} (${tokens[fg]}) on --${bg} (${tokens[bg]}) = ${ratio.toFixed(2)}:1, need ${min}:1`
		).toBeGreaterThanOrEqual(min);
	});
});
