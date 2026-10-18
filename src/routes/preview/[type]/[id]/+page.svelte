<script lang="ts">
	import PlayButton from '#lib/components/PlayButton.svelte';
	import YoutubeEmbed from '#lib/components/YoutubeEmbed.svelte';
	import { formatDate, formatDuration } from '#lib/utils/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const editorHref = $derived(
		data.kind === 'article'
			? `/admin/insights/${data.article.id}/edit`
			: data.kind === 'video'
				? `/admin/videos/${data.video.id}/edit`
				: `/admin/audio/${data.episode.id}/edit`
	);

	const status = $derived(
		data.kind === 'article' ? data.article.status : data.kind === 'video' ? data.video.status : data.episode.status
	);

	const record = $derived(
		data.kind === 'article' ? data.article : data.kind === 'video' ? data.video : data.episode
	);
</script>

<svelte:head>
	<title>Preview · Daniel Shabrokh</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="preview-banner" role="note">
	<div class="container banner-inner">
		<p>
			<strong>Preview — not publicly visible.</strong>
			Status: {status}.
		</p>
		<a class="btn btn-secondary btn-sm" href={editorHref}>Back to editor</a>
	</div>
</div>

{#if data.kind === 'article'}
	<article class="section container-narrow article-page">
		<header class="article-head">
			{#if data.article.category}<p class="eyebrow">{data.article.category}</p>{/if}
			<h1>{data.article.title}</h1>
			<p class="meta">
				{#if data.article.authorLabel}{data.article.authorLabel} · {/if}{formatDate(data.article.publishedAt)} · {data.readingMinutes} min read
			</p>
			{#if data.article.coverImage}
				<img class="cover" src={data.article.coverImage} alt="" width="880" height="440" />
			{/if}
		</header>

		{#if data.toc.length >= 3}
			<nav class="toc" aria-label="On this page">
				<p class="toc-title">On this page</p>
				<ol>
					{#each data.toc as item (item.id)}
						<li class:level-3={item.level === 3}><a href="#{item.id}">{item.text}</a></li>
					{/each}
				</ol>
			</nav>
		{/if}

		<div class="prose">
			{@html data.html}
		</div>
	</article>
{:else if data.kind === 'video'}
	<section class="section container detail">
		<div class="embed-wrap">
			<YoutubeEmbed videoId={data.video.providerVideoId} title={data.video.title} thumbnailUrl={data.video.thumbnailUrl} />
		</div>
		<div class="detail-head">
			{#if data.video.category}<p class="eyebrow">{data.video.category}</p>{/if}
			<h1>{data.video.title}</h1>
			<p class="meta">{formatDate(data.video.publishedAt)}</p>
		</div>
		{#if data.video.description}
			<p class="detail-desc">{data.video.description}</p>
		{/if}
	</section>
{:else}
	<section class="section container detail">
		<div class="ep-hero">
			{#if data.episode.coverImage}
				<img class="cover" src={data.episode.coverImage} alt="" width="480" height="480" />
			{:else}
				<div class="cover cover-fallback" aria-hidden="true"></div>
			{/if}
			<div class="ep-hero-info">
				{#if data.episode.episodeNumber}
					<p class="eyebrow">Episode {data.episode.episodeNumber}</p>
				{/if}
				<h1>{data.episode.title}</h1>
				<p class="meta">
					{formatDate(data.episode.publishedAt)}{#if data.episode.durationSeconds} · {formatDuration(data.episode.durationSeconds)}{/if}
				</p>
				<PlayButton
					episode={{
						title: data.episode.title,
						slug: data.episode.slug,
						src: data.episode.audioSourceUrl,
						coverImage: data.episode.coverImage
					}}
				/>
			</div>
		</div>
		{#if data.episode.description}
			<p class="detail-desc">{data.episode.description}</p>
		{/if}
	</section>
{/if}

<style>
	.preview-banner {
		background: var(--color-ink);
		color: var(--color-text-on-ink);
		padding-block: var(--space-s);
	}

	.banner-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-m);
		flex-wrap: wrap;
	}

	.banner-inner p {
		font-size: var(--text-small);
	}

	.article-page {
		display: grid;
		gap: var(--space-xl);
	}

	.article-head {
		display: grid;
		gap: var(--space-s);
	}

	.article-head h1 {
		font-size: var(--text-h1);
	}

	.cover {
		margin-top: var(--space-s);
		border-radius: var(--radius-l);
		width: 100%;
		height: auto;
	}

	.toc {
		border: 1px solid var(--color-ivory-line);
		border-radius: var(--radius-m);
		padding: var(--space-m) var(--space-l);
		background: var(--color-ivory-deep);
	}

	.toc-title {
		font-size: var(--text-meta);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: var(--tracking-meta);
		margin-bottom: var(--space-xs);
	}

	.toc ol {
		list-style: none;
		padding: 0;
		display: grid;
		gap: var(--space-2xs);
	}

	.toc a {
		font-size: var(--text-small);
		color: var(--color-text-muted-on-ivory);
		text-decoration: none;
	}

	.toc a:hover {
		color: var(--color-brass-strong);
		text-decoration: underline;
	}

	.toc .level-3 {
		padding-left: var(--space-l);
	}

	.detail {
		display: grid;
		gap: var(--space-l);
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

	.ep-hero {
		display: grid;
		gap: var(--space-l);
		align-items: center;
	}

	.ep-hero .cover {
		width: 13rem;
		aspect-ratio: 1;
		border-radius: var(--radius-l);
		object-fit: cover;
	}

	.cover-fallback {
		background: var(--color-ink);
	}

	.ep-hero-info h1 {
		font-size: var(--text-h1);
		margin-top: var(--space-2xs);
	}

	.ep-hero-info .meta {
		margin-block: var(--space-s) var(--space-m);
	}


	@media (min-width: 768px) {
		.ep-hero {
			grid-template-columns: auto minmax(0, 1fr);
		}
	}
</style>
