<script lang="ts">
	import { formatDate } from '#lib/utils/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const cards = $derived([
		{
			label: 'Insights',
			href: '/admin/insights',
			published: data.dashboard.counts.articles.published,
			draft: data.dashboard.counts.articles.draft
		},
		{
			label: 'Videos',
			href: '/admin/videos',
			published: data.dashboard.counts.videos.published,
			draft: data.dashboard.counts.videos.draft
		},
		{
			label: 'Audio',
			href: '/admin/audio',
			published: data.dashboard.counts.audio.published,
			draft: data.dashboard.counts.audio.draft
		}
	]);

	const editHref = (type: string, id: string) =>
		type === 'article' ? `/admin/insights/${id}/edit` : type === 'video' ? `/admin/videos/${id}/edit` : `/admin/audio/${id}/edit`;
</script>

<svelte:head>
	<title>Dashboard · Admin</title>
</svelte:head>

<h1 class="page-title">Dashboard</h1>

<section class="counts" aria-label="Published and draft counts">
	{#each cards as card (card.label)}
		<a class="count-card surface-card" href={card.href}>
			<p class="count-label">{card.label}</p>
			<p class="count-numbers">
				<strong>{card.published}</strong> published
				<span class="count-draft">· {card.draft} draft</span>
			</p>
		</a>
	{/each}
</section>

<div class="dashboard-grid">
	<section class="recent panel">
		<h2>Recently updated</h2>
		{#if data.dashboard.recent.length}
			<ul>
				{#each data.dashboard.recent as item (item.id)}
					<li>
						<a href={editHref(item.type, item.id)}>{item.title}</a>
						<span class="badge badge-{item.status}">{item.status}</span>
						<span class="when">{formatDate(item.updatedAt)}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="none-yet">No content yet. Create your first article, video, or episode.</p>
		{/if}
	</section>

	<section class="events panel">
		<h2>Recent activity</h2>
		{#if data.dashboard.recentEvents.length}
			<ul>
				{#each data.dashboard.recentEvents as event (event.id)}
					<li>
						<span class="event-type">{event.type.replace(/_/g, ' ')}</span>
						{#if event.actor}<span class="event-actor">{event.actor}</span>{/if}
						<span class="when">{formatDate(event.createdAt)}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="none-yet">No recorded events yet.</p>
		{/if}
	</section>
</div>

<style>
	.page-title {
		font-family: var(--font-ui);
		font-size: var(--text-h2);
		font-weight: 700;
		margin-bottom: var(--space-l);
	}

	.counts {
		display: grid;
		gap: var(--space-m);
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		margin-bottom: var(--space-xl);
	}

	.count-card {
		padding: var(--space-m) var(--space-l);
		text-decoration: none;
		transition: box-shadow var(--dur-fast) var(--ease-out);
	}

	.count-card:hover {
		box-shadow: var(--shadow-m);
	}

	.count-label {
		font-size: var(--text-meta);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-brass-strong);
	}

	.count-numbers {
		margin-top: var(--space-2xs);
		font-size: var(--text-small);
		color: var(--color-text-muted-on-ivory);
	}

	.count-numbers strong {
		font-size: 1.4rem;
		color: var(--color-text-on-ivory);
	}

	.count-draft {
		font-size: var(--text-meta);
	}

	.dashboard-grid {
		display: grid;
		gap: var(--space-l);
		grid-template-columns: 1.6fr 1fr;
	}

	.panel {
		border: 1px solid var(--color-ivory-line);
		border-radius: var(--radius-l);
		background: var(--color-surface-card);
		padding: var(--space-l);
	}

	.panel h2 {
		font-family: var(--font-ui);
		font-size: var(--text-body);
		font-weight: 700;
		margin-bottom: var(--space-m);
	}

	.panel ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-s);
	}

	.panel li {
		display: flex;
		align-items: center;
		gap: var(--space-s);
		font-size: var(--text-small);
	}

	.panel li a {
		text-decoration: none;
		font-weight: 600;
		color: inherit;
	}

	.panel li a:hover {
		text-decoration: underline;
		text-underline-offset: 0.15em;
	}

	.when {
		color: var(--color-text-muted-on-ivory);
		font-size: var(--text-meta);
		margin-left: auto;
		white-space: nowrap;
	}

	.event-type {
		font-weight: 600;
	}

	.event-actor {
		color: var(--color-text-muted-on-ivory);
	}

	.none-yet {
		color: var(--color-text-muted-on-ivory);
		font-size: var(--text-small);
	}

	@media (max-width: 800px) {
		.dashboard-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
