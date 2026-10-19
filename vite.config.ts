import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Optional build-time origin (kit paths.origin). Leave unset in production
// when running behind a reverse proxy that sets PROTOCOL_HEADER/HOST_HEADER;
// set it for direct-to-node deployments and local production-style testing
// (e.g. KIT_ORIGIN=http://localhost:4173 for the E2E suite).
const kitOrigin = process.env.KIT_ORIGIN;

export default defineConfig(({ mode }) => ({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// PRD §9.6: single-instance Node deployment.
			adapter: adapter(),

			...(kitOrigin ? { paths: { origin: kitOrigin } } : {}),

			// PRD §6.6 / §10: Content-Security-Policy. 'hash' mode lets SvelteKit
			// hash its own inline bootstrap scripts. Dev allows inline styles for
			// Vite HMR; production does not.
			csp: {
				mode: 'hash',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': mode === 'development' ? ['self', 'unsafe-inline'] : ['self'],
					// Inline style ATTRIBUTES only (framework runtime + testing
					// tooling); injected <style> elements stay blocked.
					'style-src-attr': ['unsafe-inline'],
					'img-src': ['self', 'data:', 'https:'],
					'media-src': ['self', 'https:'],
					'font-src': ['self'],
					'connect-src': ['self'],
					'frame-src': ['https://www.youtube-nocookie.com', 'https://www.youtube.com'],
					'object-src': ['none'],
					'base-uri': ['self'],
					'form-action': ['self'],
					'frame-ancestors': ['none']
				}
			}
		})
	]
}));
