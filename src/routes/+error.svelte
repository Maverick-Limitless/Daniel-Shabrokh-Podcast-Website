<script lang="ts">
	import { page } from '$app/state';

	const is404 = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{is404 ? 'Page not found' : 'Something went wrong'} · Daniel Shabrokh</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="section container error-section">
	<p class="eyebrow">{page.status}</p>
	{#if is404}
		<h1>Page not found</h1>
		<p class="lede">
			The page you're looking for doesn't exist, may have been unpublished, or the link is
			incorrect.
		</p>
		<div class="error-actions">
			<a class="btn btn-primary" href="/">Back to home</a>
			<a class="btn btn-secondary" href="/search">Search the site</a>
		</div>
	{:else}
		<h1>Something went wrong</h1>
		<p class="lede">
			An unexpected error occurred while loading this page. Please try again in a moment.
		</p>
		<div class="error-actions">
			<a class="btn btn-primary" href="/">Back to home</a>
		</div>
	{/if}
</section>

<style>
	.error-section {
		display: grid;
		justify-items: center;
		text-align: center;
		gap: var(--space-m);
		padding-block: var(--space-4xl);
	}

	.error-section h1 {
		font-size: var(--text-h1);
	}

	.error-actions {
		display: flex;
		gap: var(--space-s);
		flex-wrap: wrap;
		justify-content: center;
		margin-top: var(--space-s);
	}
</style>
