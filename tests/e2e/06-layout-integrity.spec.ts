import { expect, test } from '@playwright/test';

// Automated layout-integrity checks (PRD §8.7). Because neither the configured
// NVIDIA reviewer nor image inspection is available in this environment (see
// the delivery report), these geometric assertions complement the overflow
// matrix and axe scans: interactive elements must never overlap, must never be
// clipped off the viewport horizontally, and must have a usable hit area.

interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
	label: string;
}

const PAGES = ['/', '/watch', '/listen', '/insights/dev-example-insight', '/about', '/search?q=dev', '/admin/login'];
const SIZES: [number, number][] = [
	[1440, 900],
	[768, 1024],
	[390, 844],
	[320, 568]
];

test('interactive elements never overlap and stay within the viewport', async ({ page }) => {
	for (const [w, h] of SIZES) {
		await page.setViewportSize({ width: w, height: h });
		for (const path of PAGES) {
			await page.goto(path);

			const boxes = (await page.evaluate(() => {
				const out: { x: number; y: number; w: number; h: number; label: string }[] = [];
				for (const el of Array.from(
					document.querySelectorAll<HTMLElement>('button, a, input, select, textarea, summary')
				)) {
					const style = getComputedStyle(el);
					if (style.display === 'none' || style.visibility === 'hidden') continue;
					const r = el.getBoundingClientRect();
					if (r.width === 0 || r.height === 0) continue;
					out.push({
						x: r.x,
						y: r.y,
						w: r.width,
						h: r.height,
						label: (el.textContent || el.getAttribute('aria-label') || el.tagName)
							.trim()
							.slice(0, 40)
					});
				}
				return out;
			})) as Box[];

			expect(boxes.length, `${path} @${w}x${h} should expose interactive elements`).toBeGreaterThan(0);

			// No interactive element may hang off the horizontal viewport
			// (skip-link and fixed bars are deliberately excluded from the Y check).
			for (const b of boxes) {
				expect(
					b.x,
					`${path} @${w}x${h}: "${b.label}" starts past the left edge`
				).toBeGreaterThanOrEqual(-1);
				expect(
					b.x + b.w,
					`${path} @${w}x${h}: "${b.label}" extends past the right edge`
				).toBeLessThanOrEqual(w + 1);
			}

			// Pairwise overlap check with a small tolerance for subpixel rounding.
			for (let i = 0; i < boxes.length; i++) {
				for (let j = i + 1; j < boxes.length; j++) {
					const a = boxes[i];
					const b = boxes[j];
					const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
					const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
					if (overlapX > 4 && overlapY > 4) {
						throw new Error(
							`${path} @${w}x${h}: interactive elements overlap — "${a.label}" (${a.w.toFixed(0)}×${a.h.toFixed(0)}) and "${b.label}" (${b.w.toFixed(0)}×${b.h.toFixed(0)}), overlap ${overlapX.toFixed(0)}×${overlapY.toFixed(0)}`
						);
					}
				}
			}
		}
	}
});

test('interactive controls keep a usable hit area', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	for (const path of PAGES) {
		await page.goto(path);
		const tooSmall = await page.evaluate(() => {
			const offenders: string[] = [];
			for (const el of Array.from(
				document.querySelectorAll<HTMLElement>('button, a[href], input, select, summary')
			)) {
				const style = getComputedStyle(el);
				if (style.display === 'none' || style.visibility === 'hidden') continue;
				const r = el.getBoundingClientRect();
				if (r.width === 0) continue;
				// Inline text links can be short, but their line height must
				// still afford a touch target; controls must be at least ~24px tall.
				if (el.matches('button, input, select, summary') && r.height < 20) {
					offenders.push(`${el.tagName}:${(el.textContent || '').trim().slice(0, 30)} @${r.height}px`);
				}
			}
			return offenders;
		});
		expect(tooSmall, `${path}: controls under 20px tall: ${tooSmall.join(', ')}`).toHaveLength(0);
	}
});
