<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const nav = [
		{ href: '/admin', label: 'Dashboard' },
		{ href: '/admin/insights', label: 'Insights' },
		{ href: '/admin/videos', label: 'Videos' },
		{ href: '/admin/audio', label: 'Audio' },
		{ href: '/admin/settings', label: 'Settings' }
	];

	const isActive = (href: string) =>
		href === '/admin' ? page.url.pathname === '/admin' : page.url.pathname.startsWith(href + '/');
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

{#if data.administrator}
	<div class="admin-shell">
		<header class="admin-top">
			<div class="container admin-top-inner">
				<a class="admin-brand" href="/admin">DSMP Admin</a>
				<nav class="admin-nav" aria-label="Administrative">
					{#each nav as item (item.href)}
						<a href={item.href} aria-current={isActive(item.href) ? 'page' : undefined}>
							{item.label}
						</a>
					{/each}
				</nav>
				<form method="POST" action="/admin/logout">
					<button class="sign-out" type="submit">
						Sign out <span class="who">· {data.administrator.username}</span>
					</button>
				</form>
			</div>
		</header>
		<main class="container admin-main">
			{@render children()}
		</main>
	</div>
{:else}
	<main class="container admin-main admin-main-center">
		{@render children()}
	</main>
{/if}

<style>
	.admin-shell {
		min-height: 100dvh;
		display: grid;
		grid-template-rows: auto 1fr;
	}

	.admin-top {
		background: var(--color-ink);
		color: var(--color-text-on-ink);
		position: sticky;
		top: 0;
		z-index: var(--z-header);
	}

	.admin-top-inner {
		display: flex;
		align-items: center;
		gap: var(--space-l);
		min-height: 3.5rem;
		flex-wrap: wrap;
		padding-block: var(--space-2xs);
	}

	.admin-brand {
		font-family: var(--font-display);
		font-weight: 640;
		font-size: 1.05rem;
		text-decoration: none;
		color: var(--color-text-on-ink);
	}

	.admin-nav {
		display: flex;
		gap: var(--space-s);
		flex-wrap: wrap;
		margin-inline: auto;
	}

	.admin-nav a {
		font-size: var(--text-small);
		font-weight: 500;
		text-decoration: none;
		color: var(--color-text-muted-on-ink);
		padding: 0.35rem 0.7rem;
		border-radius: var(--radius-full);
		transition: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
	}

	.admin-nav a:hover {
		color: var(--color-text-on-ink);
		background: color-mix(in srgb, var(--color-text-on-ink) 12%, transparent);
	}

	.admin-nav a[aria-current='page'] {
		color: var(--color-brass-bright);
		background: color-mix(in srgb, var(--color-brass-bright) 14%, transparent);
		font-weight: 600;
	}

	.sign-out {
		background: none;
		border: 1px solid var(--color-ink-line);
		color: var(--color-text-muted-on-ink);
		font-size: var(--text-meta);
		font-weight: 500;
		padding: 0.35rem 0.8rem;
		border-radius: var(--radius-full);
	}

	.sign-out:hover {
		color: var(--color-text-on-ink);
		border-color: var(--color-text-muted-on-ink);
	}

	.who {
		color: var(--color-text-muted-on-ink);
	}

	.admin-main {
		padding-block: var(--space-xl);
		width: min(100% - 2rem, 64rem);
	}

	.admin-main-center {
		display: grid;
		place-items: center;
		min-height: 70dvh;
	}
</style>
