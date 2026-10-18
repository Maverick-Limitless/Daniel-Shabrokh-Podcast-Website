<script lang="ts">
	import ArticleCard from '#lib/components/ArticleCard.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Insights — Editorial archive · Daniel Shabrokh</title>
	<meta
		name="description"
		content="Written insights and editorial pieces: commentary, analysis, and long-form reading."
	/>
	<link rel="canonical" href={data.canonicalBase + '/insights'} />
	<meta property="og:title" content="Insights — Daniel Shabrokh" />
	<meta
		property="og:description"
		content="Written insights and editorial pieces: commentary, analysis, and long-form reading."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content={data.canonicalBase + '/insights'} />
</svelte:head>

<section class="section container">
	<header class="page-head">
		<p class="eyebrow">Archive</p>
		<h1>Insights</h1>
		<p class="lede">
			{data.articles.length}
			{data.articles.length === 1 ? 'article' : 'articles'} published.
		</p>
	</header>

	{#if data.articles.length}
		<div class="grid-2">
			{#each data.articles as article (article.id)}
				<ArticleCard {article} />
			{/each}
		</div>
	{:else}
		<EmptyState
			title="No articles published yet"
			hint="Written insights will appear here once they are published through the platform."
			actionHref="/"
			actionLabel="Return home"
		/>
	{/if}
</section>

<style>
	.page-head {
		display: grid;
		gap: var(--space-s);
		margin-bottom: var(--space-xl);
		max-width: 40rem;
	}

	.page-head h1 {
		font-size: var(--text-h1);
	}
</style>
