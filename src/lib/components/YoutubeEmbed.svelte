<script lang="ts">
	let {
		videoId,
		title,
		thumbnailUrl = null
	}: {
		videoId: string;
		title: string;
		thumbnailUrl?: string | null;
	} = $props();

	// Click-to-load facade: the YouTube iframe (and its JS) is only fetched
	// when the visitor actually plays.
	let activated = $state(false);
	let thumbFailed = $state(false);
	let img: HTMLImageElement | undefined = $state();

	// Attached imperatively: an onerror attribute would be serialized into the
	// SSR markup as an inline handler, which the strict CSP blocks.
	$effect(() => {
		const el = img;
		if (!el) return;
		const onImgError = () => (thumbFailed = true);
		el.addEventListener('error', onImgError);
		return () => el.removeEventListener('error', onImgError);
	});

	const thumb = $derived(thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
</script>

<div class="embed">
	{#if activated}
		<iframe
			src="https://www.youtube-nocookie.com/embed/{videoId}?autoplay=1&rel=0"
			title={title}
			allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
			allowfullscreen
		></iframe>
	{:else}
		<button class="facade" type="button" onclick={() => (activated = true)} aria-label="Play video: {title}">
			{#if !thumbFailed}
				<img
					bind:this={img}
					src={thumb}
					alt=""
					loading="lazy"
					width="480"
					height="270"
				/>
			{:else}
				<div class="thumb-fallback"><span>Video preview unavailable — {title}</span></div>
			{/if}
			<span class="play-chip" aria-hidden="true">
				<svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor">
					<path d="M5 3.5v13a1 1 0 0 0 1.5.9l11-6.5a1 1 0 0 0 0-1.8l-11-6.5A1 1 0 0 0 5 3.5Z" />
				</svg>
			</span>
		</button>
	{/if}
</div>

<style>
	.embed {
		position: relative;
		aspect-ratio: 16/9;
		overflow: hidden;
		border-radius: var(--radius-l);
		background: var(--color-ink);
	}

	.embed iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
	}

	.facade {
		display: block;
		width: 100%;
		height: 100%;
		padding: 0;
		border: 0;
		background: none;
		position: relative;
	}

	.facade img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.facade .thumb-fallback {
		width: 100%;
		height: 100%;
	}

	.play-chip {
		position: absolute;
		top: 50%;
		left: 50%;
		translate: -50% -50%;
		width: 3.4rem;
		height: 3.4rem;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--color-ink) 82%, transparent);
		color: var(--color-brass-bright);
		display: grid;
		place-items: center;
		transition: scale var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out);
	}

	.facade:hover .play-chip,
	.facade:focus-visible .play-chip {
		scale: 1.08;
		background: var(--color-ink);
	}
</style>
