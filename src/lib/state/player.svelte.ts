export interface PlayerEpisode {
	title: string;
	slug: string;
	src: string;
	coverImage?: string | null;
}

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

/**
 * Shared audio-player state. One instance for the whole app: the single
 * <audio> element lives in PlayerBar (root layout), so playback continues
 * across client-side navigation (PRD §4.2 Journey B) and competing instances
 * cannot exist.
 */
class PlayerStore {
	episode = $state<PlayerEpisode | null>(null);
	status = $state<PlayerStatus>('idle');
	position = $state(0);
	duration = $state(0);
	buffering = $state(false);
	error = $state<string | null>(null);

	/** Play an episode; clicking the same episode again toggles playback. */
	load(episode: PlayerEpisode) {
		if (this.episode && this.episode.src === episode.src) {
			if (this.status === 'playing' || this.status === 'loading') {
				this.status = 'paused';
			} else if (this.status !== 'error') {
				this.status = 'playing';
			} else {
				this.status = 'loading';
			}
			return;
		}
		this.episode = episode;
		this.status = 'loading';
		this.position = 0;
		this.duration = 0;
		this.buffering = false;
		this.error = null;
	}

	pause() {
		if (this.episode) this.status = 'paused';
	}

	close() {
		this.episode = null;
		this.status = 'idle';
		this.position = 0;
		this.duration = 0;
		this.buffering = false;
		this.error = null;
	}

	markError(message: string) {
		this.status = 'error';
		this.error = message;
		this.buffering = false;
	}
}

export const player = new PlayerStore();
