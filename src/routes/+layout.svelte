<script lang="ts">
	import '@fontsource-variable/inter';
	import '@fontsource-variable/newsreader';
	import '@fontsource-variable/fraunces';
	import '#lib/styles/global.css';
	import favicon from '#lib/assets/favicon.svg';
	import Header from '#lib/components/Header.svelte';
	import Footer from '#lib/components/Footer.svelte';
	import PlayerBar from '#lib/components/player/PlayerBar.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<a class="skip-link" href="#main">Skip to main content</a>
<Header />
<main id="main">
	{@render children()}
</main>
<Footer />
<PlayerBar />
