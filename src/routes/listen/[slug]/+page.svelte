<script lang="ts">
	import EpisodeCard from '#lib/components/EpisodeCard.svelte';
	import PlayButton from '#lib/components/PlayButton.svelte';
	import { formatDate, formatDuration } from '#lib/utils/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const playerEpisode = $derived({
		title: data.episode.title,
		slug: data.episode.slug,
		src: data.episode.audioSourceUrl,
		coverImage: data.episode.coverImage
	});
</script>

<svelte:head>
	<title>{data.episode.title} · Daniel Shabrokh</title>
	<meta name="description" content={data.episode.description || data.episode.title} />
	<link rel="canonical" href={data.canonicalBase + '/listen/' + data.episode.slug} />
	<meta property="og:title" content={data.episode.title} />
	<meta property="og:description" content={data.episode.description || data.episode.title} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={data.canonicalBase + '/listen/' + data.episode.slug} />
</svelte:head>

<section class="section container detail">
	<a class="back" href="/listen">← All episodes</a>

	<div class="ep-hero">
		{#if data.episode.coverImage}
			<img
				class="cover"
				src={data.episode.coverImage}
				alt="Episode artwork for {data.episode.title}"
				width="480"
				height="480"
			/>
		{:else}
			<div class="cover cover-fallback" aria-hidden="true">
				<svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor">
					<path d="M12 3a5 5 0 0 1 5 5c0 1.8-.4 3.5-1 5.2-.5 1.1-.1 2.3.9 2.8l2.6 1.1c.9.4.6 1.7-.3 1.7H4.8c-.9 0-1.2-1.3-.3-1.7l2.6-1.1c1-.5 1.4-1.7.9-2.8-.6-1.7-1-3.4-1-5.2a5 5 0 0 1 5-5Z" />
					<rect x="9.5" y="20" width="5" height="2" rx="1" />
				</svg>
			</div>
		{/if}

		<div class="ep-hero-info">
			{#if data.episode.episodeNumber}
				<p class="eyebrow">Episode {data.episode.episodeNumber}</p>
			{/if}
			<h1>{data.episode.title}</h1>
			<p class="meta">
				{formatDate(data.episode.publishedAt)}{#if data.episode.durationSeconds} · {formatDuration(data.episode.durationSeconds)}{/if}
			</p>
			<!-- No autoplay: playback always starts from an explicit user action (PRD §5.3). -->
			<PlayButton episode={playerEpisode} label="Play episode" />
		</div>
	</div>

	{#if data.episode.description}
		<p class="detail-desc">{data.episode.description}</p>
	{/if}

	{#if data.related.length}
		<section class="related">
			<header class="section-head">
				<h2>More episodes</h2>
			</header>
			<div class="related-list">
				{#each data.related as episode (episode.id)}
					<EpisodeCard {episode} />
				{/each}
			</div>
		</section>
	{/if}
</section>

<style>
	.detail {
		display: grid;
		gap: var(--space-l);
	}

	.back {
		font-size: var(--text-small);
		font-weight: 600;
		color: var(--color-brass-strong);
		text-decoration: none;
	}

	.back:hover {
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.ep-hero {
		display: grid;
		gap: var(--space-l);
		align-items: center;
	}

	.cover {
		width: 13rem;
		aspect-ratio: 1;
		border-radius: var(--radius-l);
		object-fit: cover;
		box-shadow: var(--shadow-s);
	}

	.cover-fallback {
		display: grid;
		place-items: center;
		background: var(--color-ink);
		color: var(--color-brass-bright);
	}

	.ep-hero-info h1 {
		font-size: var(--text-h1);
		margin-top: var(--space-2xs);
	}

	.ep-hero-info .meta {
		margin-block: var(--space-s) var(--space-m);
	}

	.detail-desc {
		font-size: var(--text-body-lg);
		color: var(--color-text-muted-on-ivory);
		max-width: 44rem;
	}

	.related {
		margin-top: var(--space-xl);
		border-top: 1px solid var(--color-ivory-line);
		padding-top: var(--space-xl);
	}

	.related-list {
		display: grid;
		gap: var(--space-m);
	}

	@media (min-width: 768px) {
		.ep-hero {
			grid-template-columns: auto minmax(0, 1fr);
		}
	}
</style>
