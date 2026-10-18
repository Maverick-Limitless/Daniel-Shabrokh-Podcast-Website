<script lang="ts">
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';

	let menuOpen = $state(false);

	const links = [
		{ href: '/watch', label: 'Watch' },
		{ href: '/listen', label: 'Listen' },
		{ href: '/insights', label: 'Insights' },
		{ href: '/about', label: 'About' }
	];

	const isActive = (href: string) =>
		page.url.pathname === href || page.url.pathname.startsWith(href + '/');

	// Close the mobile menu whenever navigation happens.
	$effect(() => {
		void page.url.pathname;
		menuOpen = false;
	});
</script>

<header class="header">
	<div class="container header-inner">
		<a class="wordmark" href="/">Daniel Shabrokh</a>

		<nav class="nav-desktop" aria-label="Primary">
			{#each links as link (link.href)}
				<a
					href={link.href}
					class="nav-link"
					aria-current={isActive(link.href) ? 'page' : undefined}
				>
					{link.label}
				</a>
			{/each}
		</nav>

		<div class="nav-actions">
			<a class="nav-search" href="/search">
				<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8">
					<circle cx="9" cy="9" r="6" />
					<path d="m14 14 4 4" stroke-linecap="round" />
				</svg>
				<span class="search-word">Search</span>
			</a>

			<button
				class="menu-button"
				type="button"
				aria-expanded={menuOpen}
				aria-controls="mobile-nav"
				onclick={() => (menuOpen = !menuOpen)}
			>
				<span class="visually-hidden">{menuOpen ? 'Close menu' : 'Open menu'}</span>
				{#if menuOpen}
					<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" stroke="currentColor" stroke-width="1.8">
						<path d="m4 4 12 12M16 4 4 16" stroke-linecap="round" />
					</svg>
				{:else}
					<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" stroke="currentColor" stroke-width="1.8">
						<path d="M3 6h14M3 13h14" stroke-linecap="round" />
					</svg>
				{/if}
			</button>
		</div>
	</div>

	{#if menuOpen}
		<nav id="mobile-nav" class="nav-mobile liquid-glass" aria-label="Primary" transition:fly={{ y: -8, duration: 180 }}>
			{#each [...links, { href: '/search', label: 'Search' }] as link (link.href)}
				<a
					href={link.href}
					aria-current={isActive(link.href) ? 'page' : undefined}
				>
					{link.label}
				</a>
			{/each}
		</nav>
	{/if}
</header>

<style>
	.header {
		position: sticky;
		top: 0;
		z-index: var(--z-header);
		background: var(--color-ivory);
		border-bottom: 1px solid var(--color-ivory-line);
	}

	.header-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-l);
		min-height: var(--header-h);
	}

	.wordmark {
		font-family: var(--font-display);
		font-weight: 640;
		font-size: 1.2rem;
		letter-spacing: -0.01em;
		text-decoration: none;
		white-space: nowrap;
	}

	.nav-desktop {
		display: flex;
		gap: var(--space-l);
	}

	.nav-link {
		font-size: var(--text-small);
		font-weight: 500;
		text-decoration: none;
		padding-block: 0.35rem;
		border-bottom: 2px solid transparent;
		transition: border-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
	}

	.nav-link:hover {
		color: var(--color-brass-strong);
	}

	/* Active state is never color-only: the underline carries it too (PRD §8.8). */
	.nav-link[aria-current='page'] {
		color: var(--color-brass-strong);
		border-bottom-color: var(--color-brass);
	}

	.nav-actions {
		display: flex;
		align-items: center;
		gap: var(--space-m);
	}

	.nav-search {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: var(--text-small);
		font-weight: 500;
		text-decoration: none;
		padding: 0.35rem 0.6rem;
		border-radius: var(--radius-full);
		border: 1px solid transparent;
		transition: border-color var(--dur-fast) var(--ease-out);
	}

	.nav-search:hover {
		border-color: var(--color-ivory-line);
	}

	.menu-button {
		display: none;
		background: none;
		border: 1px solid var(--color-ivory-line);
		border-radius: var(--radius-s);
		padding: 0.45rem 0.55rem;
		line-height: 0;
	}

	.nav-mobile {
		display: grid;
		gap: 0.25rem;
		padding: var(--space-s) var(--space-m) var(--space-m);
		border-bottom: 1px solid var(--color-ivory-line);
	}

	.nav-mobile a {
		font-size: var(--text-body);
		font-weight: 500;
		text-decoration: none;
		padding: 0.6rem 0.5rem;
		border-radius: var(--radius-s);
	}

	.nav-mobile a:hover {
		background: color-mix(in srgb, var(--color-ink) 6%, transparent);
	}

	.nav-mobile a[aria-current='page'] {
		color: var(--color-brass-strong);
		font-weight: 600;
	}

	@media (max-width: 767px) {
		.nav-desktop {
			display: none;
		}
		.menu-button {
			display: inline-flex;
		}
		.search-word {
			display: none;
		}
	}
</style>
