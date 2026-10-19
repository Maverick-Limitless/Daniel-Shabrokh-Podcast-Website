<script lang="ts">
	import ArticleCard from '#lib/components/ArticleCard.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import EpisodeCard from '#lib/components/EpisodeCard.svelte';
	import VideoCard from '#lib/components/VideoCard.svelte';
	import YoutubeEmbed from '#lib/components/YoutubeEmbed.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const watchRow = $derived(
		data.latestVideos.filter((v) => v.id !== data.featuredVideo?.id).slice(0, 3)
	);
</script>

<svelte:head>
	<title>Daniel Shabrokh — Video, audio & written insights</title>
	<meta
		name="description"
		content="An independent editorial, video, and audio publishing platform: watch, listen, and read."
	/>
	<link rel="canonical" href={data.canonicalBase + '/'} />
	<meta property="og:title" content="Daniel Shabrokh" />
	<meta
		property="og:description"
		content="An independent editorial, video, and audio publishing platform: watch, listen, and read."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content={data.canonicalBase + '/'} />
</svelte:head>

<!-- Hero (PRD §5.1: distinctive, restrained, no fabricated metrics) -->
<section class="hero on-ink">
	<div class="container hero-inner">
		<div class="hero-copy">
			<p class="eyebrow rise">An independent media platform</p>
			<h1 class="hero-title rise">The work of <em>Daniel Shabrokh</em></h1>
			<p class="lede rise">
				Video, audio, and written insights — one coherent destination, published with editorial
				care.
			</p>
			<div class="hero-cta rise">
				<a class="btn btn-primary" href="/watch">Watch</a>
				<a class="btn btn-secondary" href="/listen">Listen</a>
				<a class="btn btn-secondary" href="/insights">Read insights</a>
			</div>
		</div>

		{#if data.featuredVideo}
			<div class="hero-media rise">
				<YoutubeEmbed
					videoId={data.featuredVideo.providerVideoId}
					title={data.featuredVideo.title}
					thumbnailUrl={data.featuredVideo.thumbnailUrl}
				/>
				<a class="hero-media-link" href="/watch/{data.featuredVideo.slug}">
					{data.featuredVideo.title}
					<span aria-hidden="true"> →</span>
				</a>
			</div>
		{/if}
	</div>
</section>

<!-- Watch -->
<section class="section container">
	<header class="section-head">
		<div>
			<p class="eyebrow">Watch</p>
			<h2>Latest videos</h2>
		</div>
		<a class="section-link" href="/watch">All videos →</a>
	</header>

	{#if watchRow.length}
		<div class="grid-3">
			{#each watchRow as video (video.id)}
				<VideoCard {video} />
			{/each}
		</div>
	{:else}
		<EmptyState
			title="Video programming is in preparation"
			hint="Published videos will appear here as soon as they are available."
			actionHref="/watch"
			actionLabel="Browse the archive"
		/>
	{/if}
</section>

<!-- Listen -->
<section class="section listen-band">
	<div class="container">
		<header class="section-head">
			<div>
				<p class="eyebrow">Listen</p>
				<h2>Latest episodes</h2>
			</div>
			<a class="section-link" href="/listen">All episodes →</a>
		</header>

		{#if data.episodes.length}
			<div class="grid-3">
				{#each data.episodes as episode (episode.id)}
					<EpisodeCard {episode} showDescription />
				{/each}
			</div>
		{:else}
			<EmptyState
				title="Audio episodes are in preparation"
				hint="Published episodes will appear here as soon as they are available."
				actionHref="/listen"
				actionLabel="Browse the archive"
			/>
		{/if}
	</div>
</section>

<!-- Insights -->
<section class="section container">
	<header class="section-head">
		<div>
			<p class="eyebrow">Insights</p>
			<h2>Recent writing</h2>
		</div>
		<a class="section-link" href="/insights">All insights →</a>
	</header>

	{#if data.articles.length}
		<div class="grid-3">
			{#each data.articles as article (article.id)}
				<ArticleCard {article} />
			{/each}
		</div>
	{:else}
		<EmptyState
			title="Insights are in preparation"
			hint="Published articles will appear here as soon as they are available."
			actionHref="/insights"
			actionLabel="Browse the archive"
		/>
	{/if}
</section>

<style>
	.hero {
		padding-block: var(--space-3xl) var(--space-2xl);
	}

	.hero-inner {
		display: grid;
		gap: var(--space-2xl);
		align-items: center;
	}

	.hero-title {
		font-size: var(--text-display);
		font-weight: 620;
		max-width: 14ch;
		margin-top: var(--space-s);
	}

	.hero-title em {
		font-style: italic;
		font-weight: 560;
		color: var(--color-brass-bright);
	}

	.hero-copy .lede {
		margin-top: var(--space-m);
	}

	/* Grid items must be able to shrink below their min-content width so
	   long words wrap instead of overflowing the container at 320px. */
	.hero-copy {
		min-width: 0;
	}

	.hero-cta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-s);
		margin-top: var(--space-xl);
	}

	.hero-media {
		display: grid;
		gap: var(--space-s);
	}

	.hero-media-link {
		font-size: var(--text-small);
		font-weight: 600;
		color: var(--color-brass-bright);
		text-decoration: none;
	}

	.hero-media-link:hover {
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.listen-band {
		background: var(--color-ivory-deep);
	}

	@media (min-width: 1024px) {
		.hero-inner {
			grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
		}
	}
</style>
