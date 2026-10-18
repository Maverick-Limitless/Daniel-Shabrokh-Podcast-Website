<script lang="ts">
	import { player } from '#lib/state/player.svelte';
	import { formatDate, formatDuration } from '#lib/utils/format';

	interface EpisodeCardData {
		slug: string;
		title: string;
		description?: string | null;
		audioSourceUrl: string;
		coverImage?: string | null;
		durationSeconds?: number | null;
		episodeNumber?: number | null;
		publishedAt?: Date | string | null;
	}

	let { episode, showDescription = false }: { episode: EpisodeCardData; showDescription?: boolean } = $props();

	const isCurrent = $derived(player.episode?.src === episode.audioSourceUrl);
	const isPlaying = $derived(isCurrent && (player.status === 'playing' || player.status === 'loading'));

	function toggle() {
		player.load({
			title: episode.title,
			slug: episode.slug,
			src: episode.audioSourceUrl,
			coverImage: episode.coverImage
		});
	}
</script>

<article class="episode-card surface-card">
	<div class="ep-row">
		<button
			class="play-circle"
			type="button"
			onclick={toggle}
			aria-label={isPlaying ? `Pause ${episode.title}` : `Play ${episode.title}`}
		>
			{#if isPlaying}
				<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
					<rect x="4" y="3" width="4" height="14" rx="1" />
					<rect x="12" y="3" width="4" height="14" rx="1" />
				</svg>
			{:else}
				<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
					<path d="M5 3.5v13a1 1 0 0 0 1.5.9l11-6.5a1 1 0 0 0 0-1.8l-11-6.5A1 1 0 0 0 5 3.5Z" />
				</svg>
			{/if}
		</button>

		<div class="ep-info">
			<a class="card-title ep-title" href="/listen/{episode.slug}">{episode.title}</a>
			<p class="card-meta">
				{#if episode.episodeNumber}Episode {episode.episodeNumber} · {/if}{formatDate(episode.publishedAt)}{#if episode.durationSeconds} · {formatDuration(episode.durationSeconds)}{/if}
			</p>
		</div>
	</div>

	{#if showDescription && episode.description}
		<p class="ep-desc">{episode.description}</p>
	{/if}
</article>

<style>
	.episode-card {
		padding: var(--space-m) var(--space-l);
		display: grid;
		gap: var(--space-s);
		transition: box-shadow var(--dur-fast) var(--ease-out);
	}

	.episode-card:hover {
		box-shadow: var(--shadow-m);
	}

	.ep-row {
		display: flex;
		align-items: center;
		gap: var(--space-m);
		min-width: 0;
	}

	.play-circle {
		flex-shrink: 0;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: var(--radius-full);
		border: 1px solid var(--color-ivory-line);
		background: var(--color-ink);
		color: var(--color-brass-bright);
		display: grid;
		place-items: center;
		transition: background-color var(--dur-fast) var(--ease-out);
	}

	.play-circle:hover {
		background: var(--color-ink-raised);
	}

	.ep-info {
		min-width: 0;
	}

	.ep-title {
		display: block;
		font-size: 1.05rem;
	}

	.ep-desc {
		font-size: var(--text-small);
		color: var(--color-text-muted-on-ivory);
		display: -webkit-box;
		-webkit-line-clamp: 2; line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
