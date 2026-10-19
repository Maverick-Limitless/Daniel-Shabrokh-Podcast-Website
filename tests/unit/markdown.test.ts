import { describe, expect, test } from 'vitest';
import { renderMarkdown } from '../../src/lib/server/markdown';

describe('renderMarkdown (sanitized rendering)', () => {
	test('renders basic Markdown and strips h1 (title owns h1)', () => {
		const { html } = renderMarkdown('# Heading One\n\n## Section A\n\nHello **world**.');
		expect(html).toContain('Section A');
		expect(html).toContain('<strong>world</strong>');
		expect(html).not.toContain('<h1');
	});

	test('adds heading ids and builds a TOC for h2/h3 (not h4)', () => {
		const { html, toc } = renderMarkdown(
			'## Alpha Section\n\n## Beta Section\n\n### Sub Of Beta\n\n#### Deep'
		);
		expect(html).toContain('id="alpha-section"');
		expect(html).toContain('id="beta-section"');
		expect(html).toContain('id="sub-of-beta"');
		expect(toc.map((t) => t.text)).toEqual(['Alpha Section', 'Beta Section', 'Sub Of Beta']);
		expect(toc.every((t) => t.level <= 3)).toBe(true);
	});

	test('deduplicates repeated heading ids', () => {
		const { html } = renderMarkdown('## Same\n\n## Same');
		expect(html).toContain('id="same"');
		expect(html).toContain('id="same-2"');
	});

	test('removes scripts and event handlers', () => {
		const { html } = renderMarkdown('<script>alert(1)</script>\n\n## Clean\n\n<script>alert(2)</script>');
		expect(html).not.toContain('alert(1)');
		expect(html).not.toContain('alert(2)');
		expect(html).not.toContain('<script');
	});

	test('strips javascript: and http:// links/images (https only)', () => {
		const { html } = renderMarkdown(
			'[bad](javascript:alert(1)) [good](https://svelte.dev) ![img](http://insecure.example/x.png) ![ok](https://secure.example/x.png)'
		);
		expect(html).not.toContain('javascript:');
		expect(html).not.toContain('http://insecure');
		expect(html).toContain('href="https://svelte.dev"');
		expect(html).toContain('src="https://secure.example/x.png"');
	});

	test('adds rel="noopener noreferrer" to links', () => {
		const { html } = renderMarkdown('[link](https://svelte.dev)');
		expect(html).toContain('rel="noopener noreferrer"');
	});

	test('supports lists, quotes, code, and inline code', () => {
		const { html } = renderMarkdown('- one\n- two\n\n> quoted\n\n`inline`');
		expect(html).toContain('<ul>');
		expect(html).toContain('<li>one</li>');
		expect(html).toContain('<blockquote>');
		expect(html).toContain('<code>inline</code>');
	});

	test('computes reading time from actual content', () => {
		const short = renderMarkdown('one two three');
		expect(short.readingMinutes).toBe(1);
		const words = Array.from({ length: 1100 }, (_, i) => `w${i}`).join(' ');
		const long = renderMarkdown(words);
		expect(long.readingMinutes).toBeGreaterThanOrEqual(5);
	});
});
