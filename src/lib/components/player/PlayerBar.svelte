<script lang="ts">
	import { fly } from 'svelte/transition';
	import { player } from '#lib/state/player.svelte';

	let audio = $state<HTMLAudioElement | null>(null);
	let loadedSrc: string | null = $state(null);

	// Drive the single <audio> element from store intent.
	$effect(() => {
		const episode = player.episode;
		const status = player.status;
		if (!episode || !audio) return;

		if (episode.src !== loadedSrc) {
			loadedSrc = episode.src;
			audio.src = episode.src;
			audio.load();
		}

		if (status === 'playing' || status === 'loading') {
			audio.play().catch(() => player.markError('This audio source could not be played.'));
		} else if (status === 'paused') {
			audio.pause();
		}
	});

	const fmt = (s: number) => {
		if (!Number.isFinite(s) || s < 0) return '--:--';
		const m = Math.floor(s / 60);
		const sec = Math.floor(s % 60);
		return `${m}:${String(sec).padStart(2, '0')}`;
	};

	const isPlaying = $derived(player.status === 'playing' || (player.status === 'loading' && !player.error));

	function onSeek(e: Event) {
		const value = Number((e.currentTarget as HTMLInputElement).value);
		if (audio) audio.currentTime = value;
		player.position = value;
	}

	function retry() {
		if (!audio || !player.episode) return;
		player.error = null;
		player.status = 'loading';
		audio.load();
		audio.play().catch(() => player.markError('This audio source could not be played.'));
	}

	const statusText = $derived(
		player.error
			? 'Playback error'
			: player.status === 'playing'
				? 'Playing'
				: player.status === 'loading'
					? 'Loading'
					: player.status === 'paused'
						? 'Paused'
						: player.buffering
							? 'Buffering'
							: ''
	);
</script>

{#if player.episode}
	<div
		class="player-bar liquid-glass"
		transition:fly={{ y: 90, duration: 240 }}
		role="group"
		aria-label="Audio player"
	>
		<p class="visually-hidden" aria-live="polite">{statusText}</p>

		<audio
			bind:this={audio}
			preload="metadata"
			onplay={() => {
				player.status = 'playing';
				player.error = null;
			}}
			onpause={() => {
				if (player.status !== 'loading') player.status = 'paused';
			}}
			onended={() => player.close()}
			ontimeupdate={(e) => {
				player.position = e.currentTarget.currentTime;
			}}
			onloadedmetadata={(e) => {
				player.duration = e.currentTarget.duration || 0;
			}}
			onwaiting={() => (player.buffering = true)}
			onplaying={() => (player.buffering = false)}
			onerror={() => player.markError('This audio source could not be loaded.')}
		></audio>

		<div class="pb-main">
			{#if player.episode.coverImage}
				<img class="pb-cover" src={player.episode.coverImage} alt="" />
			{:else}
				<div class="pb-cover pb-cover-fallback" aria-hidden="true">
					<svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">
						<path d="M10 2a4.5 4.5 0 0 1 4.5 4.5c0 1.6-.4 3.2-1 4.7-.4 1-.1 2.1.9 2.5l2.3 1c.8.4.5 1.6-.4 1.6H3.7c-.9 0-1.2-1.3-.4-1.6l2.3-1c1-.4 1.3-1.5.9-2.5-.6-1.5-1-3.1-1-4.7A4.5 4.5 0 0 1 10 2Z" />
					</svg>
				</div>
			{/if}

			<button
				class="pb-toggle"
				type="button"
				onclick={() => (isPlaying ? player.pause() : player.load(player.episode!))}
				aria-label={isPlaying ? 'Pause' : 'Play'}
			>
				{#if isPlaying}
					<svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">
						<rect x="4" y="3" width="4" height="14" rx="1" />
						<rect x="12" y="3" width="4" height="14" rx="1" />
					</svg>
				{:else}
					<svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">
						<path d="M5 3.5v13a1 1 0 0 0 1.5.9l11-6.5a1 1 0 0 0 0-1.8l-11-6.5A1 1 0 0 0 5 3.5Z" />
					</svg>
				{/if}
			</button>

			<div class="pb-info">
				<a class="pb-title" href="/listen/{player.episode.slug}">{player.episode.title}</a>
				<div class="pb-seek">
					<span class="pb-time">{fmt(player.position)}</span>
					<input
						type="range"
						min="0"
						max={player.duration || 0}
						step="0.1"
						value={player.position}
						oninput={onSeek}
						aria-label="Seek"
						disabled={player.duration <= 0 || player.status === 'error'}
					/>
					<span class="pb-time">{fmt(player.duration)}</span>
				</div>
			</div>

			<button class="pb-close" type="button" onclick={() => player.close()} aria-label="Close player">
				<svg viewBox="0 0 20 20" width="16" height="16" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
					<path d="m4 4 12 12M16 4 4 16" stroke-linecap="round" />
				</svg>
			</button>
		</div>

		{#if player.error}
			<div class="pb-error" role="alert">
				<span>{player.error}</span>
				<button class="btn btn-secondary btn-sm" type="button" onclick={retry}>Retry</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.player-bar {
		position: fixed;
		left: 50%;
		transform: translateX(-50%);
		bottom: 1rem;
		z-index: var(--z-player);
		width: min(100% - 1.5rem, 44rem);
		border: 1px solid var(--color-ivory-line);
		border-radius: var(--radius-l);
		box-shadow: var(--shadow-m);
		padding: var(--space-s) var(--space-m);
		display: grid;
		gap: var(--space-s);
	}

	.pb-main {
		display: flex;
		align-items: center;
		gap: var(--space-s);
		min-width: 0;
	}

	.pb-cover {
		width: 2.6rem;
		height: 2.6rem;
		border-radius: var(--radius-s);
		object-fit: cover;
		flex-shrink: 0;
	}

	.pb-cover-fallback {
		display: grid;
		place-items: center;
		background: var(--color-ink);
		color: var(--color-brass-bright);
	}

	.pb-toggle {
		flex-shrink: 0;
		width: 2.6rem;
		height: 2.6rem;
		border-radius: var(--radius-full);
		border: none;
		background: var(--color-ink);
		color: var(--color-text-on-ink);
		display: grid;
		place-items: center;
		transition: background-color var(--dur-fast) var(--ease-out);
	}

	.pb-toggle:hover {
		background: var(--color-ink-raised);
	}

	.pb-info {
		flex: 1;
		min-width: 0;
		display: grid;
		gap: 0.15rem;
	}

	.pb-title {
		font-size: var(--text-small);
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.pb-title:hover {
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.pb-seek {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.pb-time {
		font-size: var(--text-micro);
		color: var(--color-text-muted-on-ivory);
		font-variant-numeric: tabular-nums;
		min-width: 2.4rem;
		text-align: center;
	}

	.pb-seek input {
		flex: 1;
		accent-color: var(--color-brass-strong);
		min-width: 0;
	}

	.pb-close {
		flex-shrink: 0;
		background: none;
		border: none;
		color: var(--color-text-muted-on-ivory);
		padding: 0.35rem;
		border-radius: var(--radius-s);
	}

	.pb-close:hover {
		color: var(--color-text-on-ivory);
		background: color-mix(in srgb, var(--color-ink) 8%, transparent);
	}

	.pb-error {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-s);
		color: var(--color-error);
		font-size: var(--text-meta);
		border-top: 1px solid color-mix(in srgb, var(--color-error) 25%, transparent);
		padding-top: var(--space-xs);
	}

	@media (max-width: 480px) {
		.player-bar {
			bottom: 0.5rem;
		}
		.pb-time:first-child {
			display: none;
		}
	}
</style>
