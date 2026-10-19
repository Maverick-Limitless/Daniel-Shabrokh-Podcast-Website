<script lang="ts">
	import ArticleCard from '#lib/components/ArticleCard.svelte';
	import { formatDate } from '#lib/utils/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const seoTitle = $derived(data.article.seoTitle || data.article.title);
	const seoDescription = $derived(
		data.article.seoDescription || data.article.excerpt || data.article.title
	);
</script>

<svelte:head>
	<title>{seoTitle} · Daniel Shabrokh</title>
	<meta name="description" content={seoDescription} />
	<link rel="canonical" href={data.canonicalBase + '/insights/' + data.article.slug} />
	<meta property="og:title" content={seoTitle} />
	<meta property="og:description" content={seoDescription} />
	<meta property="og:type" content="article" />
	<meta property="og:url" content={data.canonicalBase + '/insights/' + data.article.slug} />
</svelte:head>

<article class="section container-narrow article-page">
	<header class="article-head">
		{#if data.article.category}<p class="eyebrow">{data.article.category}</p>{/if}
		<h1>{data.article.title}</h1>
		<p class="meta">
			{#if data.article.authorLabel}{data.article.authorLabel} · {/if}{formatDate(data.article.publishedAt)} · {data.readingMinutes} min read
		</p>
		{#if data.article.coverImage}
			<img class="cover" src={data.article.coverImage} alt="" loading="lazy" width="880" height="440" />
		{/if}
	</header>

	{#if data.toc.length >= 3}
		<nav class="toc" aria-label="On this page">
			<p class="toc-title">On this page</p>
			<ol>
				{#each data.toc as item (item.id)}
					<li class:level-3={item.level === 3}>
						<a href="#{item.id}">{item.text}</a>
					</li>
				{/each}
			</ol>
		</nav>
	{/if}

	<!-- Rendered server-side from Markdown through a strict sanitizer. -->
	<div class="prose">
		{@html data.html}
	</div>

	<a class="back" href="/insights">← All insights</a>
</article>

{#if data.related.length}
	<section class="section container related">
		<header class="section-head">
			<h2>Related insights</h2>
		</header>
		<div class="grid-3">
			{#each data.related as article (article.id)}
				<ArticleCard {article} />
			{/each}
		</div>
	</section>
{/if}

<style>
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
		text-underline-offset: 0.2em;
	}

	.toc .level-3 {
		padding-left: var(--space-l);
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

	.related {
		padding-top: 0;
		border-top: 1px solid var(--color-ivory-line);
	}
</style>
