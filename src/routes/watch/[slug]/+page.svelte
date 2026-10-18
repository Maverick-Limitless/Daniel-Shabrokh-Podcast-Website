<script lang="ts">
	import VideoCard from '#lib/components/VideoCard.svelte';
	import YoutubeEmbed from '#lib/components/YoutubeEmbed.svelte';
	import { formatDate } from '#lib/utils/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.video.title} · Daniel Shabrokh</title>
	<meta name="description" content={data.video.description || data.video.title} />
	<link rel="canonical" href={data.canonicalBase + '/watch/' + data.video.slug} />
	<meta property="og:title" content={data.video.title} />
	<meta property="og:description" content={data.video.description || data.video.title} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={data.canonicalBase + '/watch/' + data.video.slug} />
</svelte:head>

<section class="section container detail">
	<a class="back" href="/watch">← All videos</a>

	<div class="embed-wrap">
		<YoutubeEmbed
			videoId={data.video.providerVideoId}
			title={data.video.title}
			thumbnailUrl={data.video.thumbnailUrl}
		/>
	</div>

	<div class="detail-head">
		{#if data.video.category}<p class="eyebrow">{data.video.category}</p>{/if}
		<h1>{data.video.title}</h1>
		<p class="meta">
			{#if data.video.featured}Featured · {/if}{formatDate(data.video.publishedAt)}
		</p>
	</div>

	{#if data.video.description}
		<p class="detail-desc">{data.video.description}</p>
	{/if}

	{#if data.related.length}
		<section class="related">
			<header class="section-head">
				<h2>Related videos</h2>
			</header>
			<div class="grid-3">
				{#each data.related as video (video.id)}
					<VideoCard {video} />
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

	.detail-head h1 {
		font-size: var(--text-h1);
		margin-top: var(--space-2xs);
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
</style>
