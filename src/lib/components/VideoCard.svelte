<script lang="ts">
	import { formatDate } from '#lib/utils/format';

	interface VideoCardData {
		slug: string;
		title: string;
		thumbnailUrl?: string | null;
		providerVideoId: string;
		publishedAt?: Date | string | null;
		category?: string | null;
	}

	let { video }: { video: VideoCardData } = $props();

	let thumbFailed = $state(false);
	const thumb = $derived(video.thumbnailUrl || `https://i.ytimg.com/vi/${video.providerVideoId}/hqdefault.jpg`);
</script>

<a class="video-card surface-card" href="/watch/{video.slug}">
	<span class="thumb">
		{#if !thumbFailed}
			<img src={thumb} alt="" loading="lazy" width="480" height="270" onerror={() => (thumbFailed = true)} />
		{:else}
			<span class="thumb-fallback"><span>{video.title}</span></span>
		{/if}
		<span class="play-chip" aria-hidden="true">
			<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
				<path d="M5 3.5v13a1 1 0 0 0 1.5.9l11-6.5a1 1 0 0 0 0-1.8l-11-6.5A1 1 0 0 0 5 3.5Z" />
			</svg>
		</span>
	</span>
	<span class="card-body">
		{#if video.category}<span class="card-eyebrow">{video.category}</span>{/if}
		<span class="card-title">{video.title}</span>
		<span class="card-meta">{formatDate(video.publishedAt)}</span>
	</span>
</a>

<style>
	.video-card {
		display: grid;
		grid-template-rows: auto 1fr;
		text-decoration: none;
		overflow: hidden;
		transition: box-shadow var(--dur-fast) var(--ease-out), translate var(--dur-fast) var(--ease-out);
	}

	.video-card:hover {
		box-shadow: var(--shadow-m);
		translate: 0 -2px;
	}

	.thumb {
		position: relative;
		display: block;
		overflow: hidden;
	}

	.thumb img {
		width: 100%;
		aspect-ratio: 16/9;
		object-fit: cover;
		transition: scale var(--dur-med) var(--ease-out);
	}

	.video-card:hover .thumb img {
		scale: 1.03;
	}

	.thumb .thumb-fallback {
		width: 100%;
	}

	.play-chip {
		position: absolute;
		bottom: var(--space-s);
		right: var(--space-s);
		width: 2.4rem;
		height: 2.4rem;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--color-ink) 82%, transparent);
		color: var(--color-brass-bright);
		display: grid;
		place-items: center;
	}

	.card-body {
		display: block;
		padding: var(--space-m) var(--space-l) var(--space-l);
	}

	.video-card .card-eyebrow,
	.video-card .card-title,
	.video-card .card-meta {
		display: block;
	}
</style>
