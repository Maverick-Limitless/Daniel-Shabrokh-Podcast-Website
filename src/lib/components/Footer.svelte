<script lang="ts">
	const year = new Date().getFullYear();

	const links = [
		{ href: '/watch', label: 'Watch' },
		{ href: '/listen', label: 'Listen' },
		{ href: '/insights', label: 'Insights' },
		{ href: '/about', label: 'About' },
		{ href: '/search', label: 'Search' },
		{ href: '/privacy', label: 'Privacy' }
	];
</script>

<footer class="footer on-ink">
	<div class="container footer-inner">
		<div class="footer-brand">
			<p class="footer-wordmark">Daniel Shabrokh</p>
			<p class="footer-tagline">An independent editorial, video & audio platform.</p>
		</div>

		<nav class="footer-nav" aria-label="Footer">
			{#each links as link (link.href)}
				<a href={link.href}>{link.label}</a>
			{/each}
		</nav>

		<div class="footer-legal">
			<p>
				This platform is independently published. It is not presented as an official
				publication without the owner's authorization.
			</p>
			<p class="footer-copy">© {year} — All media remains the property of its respective owners.</p>
		</div>
	</div>
</footer>

<style>
	.footer {
		margin-top: var(--space-3xl);
		padding-block: var(--space-2xl) var(--space-xl);
	}

	.footer-inner {
		display: grid;
		gap: var(--space-xl);
	}

	.footer-wordmark {
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-weight: 640;
	}

	.footer-tagline {
		color: var(--color-text-muted-on-ink);
		font-size: var(--text-small);
		max-width: 26rem;
	}

	.footer-nav {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-s) var(--space-l);
	}

	.footer-nav a {
		font-size: var(--text-small);
		font-weight: 500;
		text-decoration: none;
		color: var(--color-text-muted-on-ink);
		transition: color var(--dur-fast) var(--ease-out);
	}

	.footer-nav a:hover {
		color: var(--color-text-on-ink);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.footer-legal {
		border-top: 1px solid var(--color-ink-line);
		padding-top: var(--space-l);
		display: grid;
		gap: var(--space-xs);
	}

	.footer-legal p {
		font-size: var(--text-meta);
		color: var(--color-text-muted-on-ink);
		max-width: 48rem;
	}

	.footer-copy {
		color: var(--color-text-muted-on-ink);
	}
</style>
