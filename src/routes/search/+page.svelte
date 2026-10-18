<script lang="ts">
	import EmptyState from '#lib/components/EmptyState.svelte';
	import { formatDate } from '#lib/utils/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const total = $derived(
		data.results ? data.results.articles.length + data.results.videos.length + data.results.episodes.length : 0
	);
</script>

<svelte:head>
	<title>{data.q ? `Search: ${data.q}` : 'Search'} · Daniel Shabrokh</title>
	<meta name="description" content="Search published articles, videos, and audio episodes." />
	<meta name="robots" content="noindex" />
	<link rel="canonical" href={data.canonicalBase + '/search'} />
</svelte:head>

<section class="section container-narrow">
	<header class="page-head">
		<p class="eyebrow">Search</p>
		<h1>Search the platform</h1>
	</header>

	<form class="search-form" action="/search" method="get" role="search">
		<label class="label" for="search-q">Search published content</label>
		<div class="search-row">
			<input
				class="input"
				id="search-q"
				name="q"
				type="search"
				value={data.q}
				placeholder="Articles, videos, episodes…"
				autocomplete="off"
			/>
			<button class="btn btn-primary" type="submit">Search</button>
		</div>
	</form>

	{#if data.results}
		<p class="result-summary" role="status">
			{total === 0
				? `No results for “${data.q}”.`
				: `${total} ${total === 1 ? 'result' : 'results'} for “${data.q}”.`}
		</p>

		{#if data.results.articles.length}
			<section class="result-group">
				<h2>Articles</h2>
				<ul>
					{#each data.results.articles as hit (hit.id)}
						<li>
							<a href="/insights/{hit.slug}">{hit.title}</a>
							{#if hit.excerpt}<p class="hit-excerpt">{hit.excerpt}</p>{/if}
							<p class="card-meta">{formatDate(hit.publishedAt)}</p>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if data.results.videos.length}
			<section class="result-group">
				<h2>Videos</h2>
				<ul>
					{#each data.results.videos as hit (hit.id)}
						<li>
							<a href="/watch/{hit.slug}">{hit.title}</a>
							{#if hit.excerpt}<p class="hit-excerpt">{hit.excerpt}</p>{/if}
							<p class="card-meta">{formatDate(hit.publishedAt)}</p>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if data.results.episodes.length}
			<section class="result-group">
				<h2>Audio episodes</h2>
				<ul>
					{#each data.results.episodes as hit (hit.id)}
						<li>
							<a href="/listen/{hit.slug}">{hit.title}</a>
							{#if hit.excerpt}<p class="hit-excerpt">{hit.excerpt}</p>{/if}
							<p class="card-meta">{formatDate(hit.publishedAt)}</p>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if total === 0}
			<EmptyState
				title="Nothing matched your search"
				hint="Try different keywords — search covers titles and descriptions of published content."
			/>
		{/if}
	{:else}
		<p class="search-hint">
			Search covers all published articles, videos, and audio episodes. Unpublished drafts are
			never searchable.
		</p>
	{/if}
</section>

<style>
	.page-head {
		display: grid;
		gap: var(--space-s);
		margin-bottom: var(--space-xl);
	}

	.page-head h1 {
		font-size: var(--text-h1);
	}

	.search-form {
		display: grid;
		gap: var(--space-xs);
	}

	.search-row {
		display: flex;
		gap: var(--space-s);
	}

	.search-row .input {
		flex: 1;
	}

	.search-hint {
		margin-top: var(--space-l);
		color: var(--color-text-muted-on-ivory);
		font-size: var(--text-small);
	}

	.result-summary {
		margin-top: var(--space-xl);
		font-size: var(--text-small);
		color: var(--color-text-muted-on-ivory);
	}

	.result-group {
		margin-top: var(--space-xl);
	}

	.result-group h2 {
		font-family: var(--font-ui);
		font-size: var(--text-body);
		font-weight: 700;
		border-bottom: 1px solid var(--color-ivory-line);
		padding-bottom: var(--space-2xs);
	}

	.result-group ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-l);
	}

	.result-group li {
		display: grid;
		gap: var(--space-2xs);
		margin-top: var(--space-m);
	}

	.result-group a {
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 640;
		color: inherit;
		text-decoration: none;
	}

	.result-group a:hover {
		color: var(--color-brass-strong);
		text-decoration: underline;
		text-underline-offset: 0.15em;
	}

	.hit-excerpt {
		font-size: var(--text-small);
		color: var(--color-text-muted-on-ivory);
	}

	@media (max-width: 520px) {
		.search-row {
			flex-direction: column;
		}
	}
</style>
