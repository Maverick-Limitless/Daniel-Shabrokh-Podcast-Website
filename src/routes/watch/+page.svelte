<script lang="ts">
	import EmptyState from '#lib/components/EmptyState.svelte';
	import VideoCard from '#lib/components/VideoCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Watch — Video archive · Daniel Shabrokh</title>
	<meta
		name="description"
		content="The video archive: published programming, conversations, and features."
	/>
	<link rel="canonical" href={data.canonicalBase + '/watch'} />
	<meta property="og:title" content="Watch — Daniel Shabrokh" />
	<meta
		property="og:description"
		content="The video archive: published programming, conversations, and features."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content={data.canonicalBase + '/watch'} />
</svelte:head>

<section class="section container">
	<header class="page-head">
		<p class="eyebrow">Archive</p>
		<h1>Watch</h1>
		<p class="lede">
			{data.videos.length}
			{data.videos.length === 1 ? 'video' : 'videos'} published.
		</p>
	</header>

	{#if data.videos.length}
		<div class="grid-3">
			{#each data.videos as video (video.id)}
				<VideoCard {video} />
			{/each}
		</div>
	{:else}
		<EmptyState
			title="No videos published yet"
			hint="Videos will appear here once they are published through the platform."
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
