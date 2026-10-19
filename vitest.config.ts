import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// Unit tests are pure-logic (no Svelte rendering): validation, Markdown
		// sanitization, and design-token contrast verification. Browser-level
		// behavior is covered by the Playwright suite (pnpm test:e2e).
		include: ['tests/unit/**/*.test.ts'],
		environment: 'node'
	}
});
