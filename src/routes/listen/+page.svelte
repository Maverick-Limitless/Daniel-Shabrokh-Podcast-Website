<script lang="ts">
	import EmptyState from '#lib/components/EmptyState.svelte';
	import EpisodeCard from '#lib/components/EpisodeCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Listen — Audio archive · Daniel Shabrokh</title>
	<meta
		name="description"
		content="The audio archive: published episodes and conversations."
	/>
	<link rel="canonical" href={data.canonicalBase + '/listen'} />
	<meta property="og:title" content="Listen — Daniel Shabrokh" />
	<meta property="og:description" content="The audio archive: published episodes and conversations." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={data.canonicalBase + '/listen'} />
</svelte:head>

<section class="section container">
	<header class="page-head">
		<p class="eyebrow">Archive</p>
		<h1>Listen</h1>
		<p class="lede">
			{data.episodes.length}
			{data.episodes.length === 1 ? 'episode' : 'episodes'} published.
		</p>
	</header>

	{#if data.episodes.length}
		<div class="episodes">
			{#each data.episodes as episode (episode.id)}
				<EpisodeCard {episode} showDescription />
			{/each}
		</div>
	{:else}
		<EmptyState
			title="No episodes published yet"
			hint="Audio episodes will appear here once they are published through the platform."
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

	.episodes {
		display: grid;
		gap: var(--space-m);
	}
</style>
