<script lang="ts">
	import { formatDate } from '#lib/utils/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const statuses = ['all', 'draft', 'published', 'archived'];
</script>

<svelte:head>
	<title>Videos · Admin</title>
</svelte:head>

<header class="list-head">
	<h1>Videos</h1>
	<a class="btn btn-primary btn-sm" href="/admin/videos/new">Add video</a>
</header>

<form class="filters" method="GET" action="/admin/videos">
	<label class="visually-hidden" for="q">Search videos</label>
	<input class="input filter-q" id="q" name="q" type="search" placeholder="Search by title…" value={data.q} />
	<label class="visually-hidden" for="status">Filter status</label>
	<select class="select filter-status" id="status" name="status">
		{#each statuses as s (s)}
			<option value={s} selected={data.status === s}>{s === 'all' ? 'All statuses' : s}</option>
		{/each}
	</select>
	<button class="btn btn-secondary btn-sm" type="submit">Filter</button>
</form>

{#if data.videos.length}
	<table class="content-table">
		<thead>
			<tr>
				<th scope="col">Title</th>
				<th scope="col">Status</th>
				<th scope="col">Updated</th>
				<th scope="col"><span class="visually-hidden">Actions</span></th>
			</tr>
		</thead>
		<tbody>
			{#each data.videos as video (video.id)}
				<tr>
					<td><a class="row-title" href="/admin/videos/{video.id}/edit">{video.title}</a></td>
					<td><span class="badge badge-{video.status}">{video.status}</span></td>
					<td class="when">{formatDate(video.updatedAt)}</td>
					<td class="row-actions">
						<a href="/preview/videos/{video.id}">Preview</a>
						{#if video.status === 'published'}
							<a href="/watch/{video.slug}">View</a>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else}
	<p class="empty-note">
		{data.q || data.status !== 'all' ? 'No videos match this filter.' : 'No videos yet. Add your first video.'}
	</p>
{/if}

<style>
	.list-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-m);
		margin-bottom: var(--space-l);
	}

	h1 {
		font-family: var(--font-ui);
		font-size: var(--text-h2);
		font-weight: 700;
	}

	.filters {
		display: flex;
		gap: var(--space-s);
		margin-bottom: var(--space-l);
	}

	.filter-q {
		max-width: 20rem;
	}

	.filter-status {
		max-width: 10rem;
	}

	.content-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-small);
	}

	.content-table th {
		text-align: left;
		font-size: var(--text-meta);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-muted-on-ivory);
		padding: var(--space-2xs) var(--space-s);
		border-bottom: 1px solid var(--color-ivory-line);
	}

	.content-table td {
		padding: var(--space-s);
		border-bottom: 1px solid var(--color-ivory-line);
		vertical-align: middle;
	}

	.row-title {
		font-weight: 600;
		color: inherit;
		text-decoration: none;
	}

	.row-title:hover {
		text-decoration: underline;
		text-underline-offset: 0.15em;
	}

	.when {
		color: var(--color-text-muted-on-ivory);
		white-space: nowrap;
	}

	.row-actions {
		display: flex;
		gap: var(--space-m);
		white-space: nowrap;
	}

	.row-actions a {
		color: var(--color-brass-strong);
		font-weight: 600;
		text-decoration: none;
	}

	.row-actions a:hover {
		text-decoration: underline;
		text-underline-offset: 0.15em;
	}

	.empty-note {
		color: var(--color-text-muted-on-ivory);
		border: 1px dashed var(--color-ivory-line);
		border-radius: var(--radius-l);
		padding: var(--space-xl);
		text-align: center;
	}

	@media (max-width: 640px) {
		.content-table th:nth-child(3),
		.content-table td:nth-child(3) {
			display: none;
		}
	}
</style>
