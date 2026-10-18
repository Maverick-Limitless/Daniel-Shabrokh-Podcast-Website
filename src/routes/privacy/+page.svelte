<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Privacy · Daniel Shabrokh</title>
	<meta
		name="description"
		content="How this platform handles data, cookies, and content rights."
	/>
	<link rel="canonical" href={data.canonicalBase + '/privacy'} />
</svelte:head>

<section class="section container-narrow">
	<header class="page-head">
		<p class="eyebrow">Legal</p>
		<h1>Privacy</h1>
	</header>

	<div class="prose privacy-body">
		<h2>In summary</h2>
		<p>
			This platform does not use analytics, tracking pixels, advertising, or any third-party data
			collection. It collects no personal data from visitors.
		</p>

		<h2>What is stored</h2>
		<ul>
			<li>
				<strong>Published content.</strong> Articles, videos, and audio episodes are stored in the
				platform's database. Video playback is embedded directly from YouTube's privacy-enhanced
				player and loads only when you choose to play it.
			</li>
			<li>
				<strong>Server logs.</strong> Like any web server, the hosting infrastructure may keep
				routine request logs (such as IP address and requested URL) for operational and security
				purposes. These logs are not used to profile visitors.
			</li>
			<li>
				<strong>Administrator account.</strong> The only account on this platform belongs to the
				site administrator. Passwords are stored exclusively as salted argon2id hashes.
			</li>
		</ul>

		<h2>Cookies</h2>
		<p>
			Visitors are not set any cookies. The single cookie this platform can set is the
			administrator's login session (<code>dsh_session</code>), which is marked
			<code>HttpOnly</code>, is not readable by JavaScript, and expires automatically. It is set
			only when the administrator signs in.
		</p>

		<h2>Third-party content</h2>
		<p>
			Embedded videos are served by YouTube. When you press play on a video, you are connecting to
			YouTube's servers, and YouTube's own privacy terms apply to that interaction. Nothing is sent
			to any third party before you press play.
		</p>

		<h2>Content rights</h2>
		<p>
			All media remains the property of its respective owners. This platform only embeds or serves
			media that its owner has approved for use here. If you believe content appearing here is
			used without permission, please contact the site owner.
		</p>

		<h2>Contact</h2>
		<p>
			Questions about this policy can be directed to the site owner through the contact channels
			listed on the About page once they are verified and published.
		</p>
	</div>
</section>

<style>
	.page-head {
		display: grid;
		gap: var(--space-s);
		margin-bottom: var(--space-2xl);
	}

	.page-head h1 {
		font-size: var(--text-h1);
	}

	.privacy-body :is(h2) {
		font-family: var(--font-ui);
		font-weight: 700;
		font-size: 1.15rem;
	}
</style>
