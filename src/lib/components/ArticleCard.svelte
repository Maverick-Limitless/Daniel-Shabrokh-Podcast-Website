<script lang="ts">
	import { formatDate } from '#lib/utils/format';

	interface ArticleCardData {
		slug: string;
		title: string;
		excerpt?: string | null;
		category?: string | null;
		publishedAt?: Date | string | null;
	}

	let { article, readingMinutes = null }: { article: ArticleCardData; readingMinutes?: number | null } = $props();
</script>

<article class="article-card surface-card">
	<div class="ac-body">
		{#if article.category}<p class="card-eyebrow">{article.category}</p>{/if}
		<h3 class="card-title ac-title">
			<a href="/insights/{article.slug}">{article.title}</a>
		</h3>
		{#if article.excerpt}
			<p class="card-excerpt">{article.excerpt}</p>
		{/if}
		<p class="card-meta">
			{formatDate(article.publishedAt)}{#if readingMinutes} · {readingMinutes} min read{/if}
		</p>
	</div>
</article>

<style>
	.article-card {
		padding: var(--space-l);
		display: grid;
		transition: box-shadow var(--dur-fast) var(--ease-out), translate var(--dur-fast) var(--ease-out);
	}

	.article-card:hover {
		box-shadow: var(--shadow-m);
		translate: 0 -2px;
	}

	.ac-title a {
		color: inherit;
	}

	.ac-body {
		display: grid;
		gap: var(--space-2xs);
		align-content: start;
	}
</style>
