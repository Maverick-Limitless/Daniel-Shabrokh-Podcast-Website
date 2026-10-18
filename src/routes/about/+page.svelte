<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>About · Daniel Shabrokh</title>
	<meta
		name="description"
		content="About this platform and the work of Daniel Shabrokh."
	/>
	<link rel="canonical" href={data.canonicalBase + '/about'} />
	<meta property="og:title" content="About · Daniel Shabrokh" />
	<meta property="og:description" content="About this platform and the work of Daniel Shabrokh." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={data.canonicalBase + '/about'} />
</svelte:head>

<section class="section container">
	<header class="page-head">
		<p class="eyebrow">About</p>
		<h1>A platform for the work of Daniel Shabrokh</h1>
	</header>

	<div class="about-grid">
		<div class="about-text">
			<p class="lede">
				This is an independent editorial, video, and audio publishing platform — a single,
				coherent destination for discovering published work as it becomes available.
			</p>

			<section class="about-block">
				<h2>Biography</h2>
				<p class="pending">
					A verified biography is in preparation. Biographical details, professional titles, and
					credentials will appear here only after they have been confirmed with the owner.
				</p>
			</section>

			<section class="about-block">
				<h2>Official channels</h2>
				<p class="pending">
					Links to official channels will be listed here once they are verified. Nothing is listed
					on this platform without confirmation.
				</p>
			</section>

			<section class="about-block">
				<h2>Editorial independence</h2>
				<p>
					This platform is independently published. It does not present itself as an official
					publication without the owner's authorization, and it does not host media it has no
					right to distribute. All embedded video is served by its original platform; all audio
					is served from sources approved for this site.
				</p>
			</section>
		</div>

		<aside class="about-aside">
			<div class="portrait-frame" aria-hidden="true">
				<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor">
					<circle cx="12" cy="8.5" r="3.5" />
					<path d="M4.5 20a7.5 7.5 0 0 1 15 0Z" />
				</svg>
			</div>
			<p class="portrait-caption">Portrait pending approval</p>
		</aside>
	</div>
</section>

<style>
	.page-head {
		display: grid;
		gap: var(--space-s);
		margin-bottom: var(--space-2xl);
		max-width: 46rem;
	}

	.page-head h1 {
		font-size: var(--text-h1);
	}

	.about-grid {
		display: grid;
		gap: var(--space-2xl);
		align-items: start;
	}

	.about-text {
		display: grid;
		gap: var(--space-l);
		max-width: 42rem;
	}

	.about-block {
		border-top: 1px solid var(--color-ivory-line);
		padding-top: var(--space-l);
	}

	.about-block h2 {
		font-size: var(--text-h3);
		font-family: var(--font-ui);
		font-weight: 700;
		letter-spacing: -0.005em;
		margin-bottom: var(--space-xs);
	}

	.about-block p {
		color: var(--color-text-muted-on-ivory);
	}

	/* Deliberately restrained pending states (PRD §5.5): no invented content. */
	.about-block .pending {
		font-style: italic;
	}

	.about-aside {
		display: grid;
		justify-items: center;
		gap: var(--space-s);
	}

	.portrait-frame {
		width: 15rem;
		aspect-ratio: 4/5;
		border: 1px dashed var(--color-ivory-line);
		border-radius: var(--radius-l);
		display: grid;
		place-items: center;
		color: var(--color-ivory-line);
	}

	.portrait-caption {
		font-size: var(--text-meta);
		color: var(--color-text-muted-on-ivory);
		font-style: italic;
	}

	@media (min-width: 900px) {
		.about-grid {
			grid-template-columns: minmax(0, 1.8fr) minmax(0, 1fr);
		}
	}
</style>
