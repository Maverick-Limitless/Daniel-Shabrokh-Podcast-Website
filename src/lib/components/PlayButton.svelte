<script lang="ts">
	import { player, type PlayerEpisode } from '#lib/state/player.svelte';

	let { episode, label = 'Play episode' }: { episode: PlayerEpisode; label?: string } = $props();

	const isCurrent = $derived(player.episode?.src === episode.src);
	const isPlaying = $derived(isCurrent && (player.status === 'playing' || player.status === 'loading'));
</script>

<button class="btn btn-primary play-cta" type="button" onclick={() => player.load(episode)}>
	{#if isPlaying}
		<svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true">
			<rect x="4" y="3" width="4" height="14" rx="1" />
			<rect x="12" y="3" width="4" height="14" rx="1" />
		</svg>
		<span>Pause</span>
	{:else}
		<svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true">
			<path d="M5 3.5v13a1 1 0 0 0 1.5.9l11-6.5a1 1 0 0 0 0-1.8l-11-6.5A1 1 0 0 0 5 3.5Z" />
		</svg>
		<span>{label}</span>
	{/if}
</button>

<style>
	.play-cta {
		justify-self: start;
	}
</style>
