<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let submitting = $state(false);

	const v = (name: string, fallback: string) =>
		(form?.values?.[name] as string | undefined) ?? fallback;
	const err = (name: string) => form?.errors?.[name];
</script>

<svelte:head>
	<title>Edit episode · Admin</title>
</svelte:head>

<header class="edit-head">
	<div>
		<h1>Edit audio episode</h1>
		<p class="status-line">
			<span class="badge badge-{data.episode.status}">{data.episode.status}</span>
			<a class="preview-link" href="/preview/audio/{data.episode.id}">Preview ↗</a>
			{#if data.episode.status === 'published'}
				<a class="preview-link" href="/listen/{data.episode.slug}">View public page ↗</a>
			{/if}
		</p>
	</div>
	<a class="btn btn-secondary btn-sm" href="/admin/audio">Back to audio</a>
</header>

{#if form?.message}
	<div class="form-message form-message-success" role="status">{form.message}</div>
{/if}

<form
	class="editor"
	method="POST"
	use:enhance={() => {
		submitting = true;
		return async ({ update }) => {
			submitting = false;
			await update();
		};
	}}
>
	<div class="field">
		<label class="label" for="title">Title</label>
		<input class="input" id="title" name="title" required value={v('title', data.episode.title)} aria-invalid={!!err('title')} />
		{#if err('title')}<p class="field-error">{err('title')}</p>{/if}
	</div>

	<div class="field-row">
		<div class="field">
			<label class="label" for="slug">Slug</label>
			<input class="input" id="slug" name="slug" required value={v('slug', data.episode.slug)} aria-invalid={!!err('slug')} />
			{#if err('slug')}<p class="field-error">{err('slug')}</p>{/if}
		</div>
		<div class="field">
			<label class="label" for="episodeNumber">Episode number <span class="optional">(optional)</span></label>
			<input class="input" id="episodeNumber" name="episodeNumber" type="number" min="1" max="9999" value={v('episodeNumber', data.episode.episodeNumber?.toString() ?? '')} />
		</div>
	</div>

	<div class="field">
		<label class="label" for="audioSourceUrl">Audio source URL</label>
		<input class="input" id="audioSourceUrl" name="audioSourceUrl" required value={v('audioSourceUrl', data.episode.audioSourceUrl)} aria-invalid={!!err('audioSourceUrl')} />
		<p class="hint">https:// URL of an authorized audio file, or a root-relative path (e.g. /fixtures/dev-tone-30s.wav).</p>
		{#if err('audioSourceUrl')}<p class="field-error">{err('audioSourceUrl')}</p>{/if}
	</div>

	<div class="field">
		<label class="label" for="description">Description</label>
		<textarea class="input textarea textarea-sm" id="description" name="description">{v('description', data.episode.description)}</textarea>
	</div>

	<div class="field-row">
		<div class="field">
			<label class="label" for="durationSeconds">Duration (seconds) <span class="optional">(optional)</span></label>
			<input class="input" id="durationSeconds" name="durationSeconds" type="number" min="0" max="86400" value={v('durationSeconds', data.episode.durationSeconds?.toString() ?? '')} />
		</div>
		<div class="field">
			<label class="label" for="coverImage">Cover image URL <span class="optional">(https)</span></label>
			<input class="input" id="coverImage" name="coverImage" inputmode="url" value={v('coverImage', data.episode.coverImage ?? '')} />
		</div>
	</div>

	<div class="field-row">
		<div class="field">
			<label class="label" for="category">Category <span class="optional">(optional)</span></label>
			<input class="input" id="category" name="category" value={v('category', data.episode.category ?? '')} />
		</div>
		<div class="field">
			<label class="label" for="tags">Tags <span class="optional">(comma-separated)</span></label>
			<input class="input" id="tags" name="tags" value={v('tags', data.episode.tags)} />
		</div>
	</div>

	<div class="field checkbox-field">
		<input class="checkbox" id="featured" name="featured" type="checkbox" checked={data.episode.featured} />
		<label class="label label-inline" for="featured">Featured (highlighted on the home page)</label>
	</div>

	<div class="actions">
		<button class="btn btn-secondary" type="submit" formaction="?/save" disabled={submitting}>
			{submitting ? 'Saving…' : 'Save'}
		</button>
		{#if data.episode.status !== 'published'}
			<button class="btn btn-primary" type="submit" formaction="?/publish" disabled={submitting}>
				{submitting ? 'Publishing…' : 'Publish'}
			</button>
		{/if}
	</div>
</form>

<section class="danger-zone">
	<h2>Status & deletion</h2>
	<div class="danger-actions">
		{#if data.episode.status === 'published'}
			<form method="POST" action="?/unpublish" use:enhance={undefined}>
				<button class="btn btn-secondary btn-sm" type="submit">Unpublish</button>
			</form>
		{/if}
		{#if data.episode.status !== 'archived'}
			<form method="POST" action="?/archive" use:enhance={undefined}>
				<button class="btn btn-secondary btn-sm" type="submit">Archive</button>
			</form>
		{:else}
			<form method="POST" action="?/restore" use:enhance={undefined}>
				<button class="btn btn-secondary btn-sm" type="submit">Restore to draft</button>
			</form>
		{/if}

		<!-- Destructive action with a no-JS confirmation pattern (PRD §6.7). -->
		<details class="delete-details">
			<summary class="btn btn-danger btn-sm">Delete episode…</summary>
			<form method="POST" action="?/delete" use:enhance={undefined}>
				<p class="delete-confirm">
					This permanently deletes the episode record and cannot be undone.
					<button class="btn btn-danger btn-sm" type="submit">Confirm delete</button>
				</p>
			</form>
		</details>
	</div>
</section>

<style>
	.edit-head {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: var(--space-m);
		margin-bottom: var(--space-l);
		flex-wrap: wrap;
	}

	h1 {
		font-family: var(--font-ui);
		font-size: var(--text-h2);
		font-weight: 700;
	}

	.status-line {
		display: flex;
		align-items: center;
		gap: var(--space-m);
		margin-top: var(--space-2xs);
	}

	.preview-link {
		font-size: var(--text-meta);
		font-weight: 600;
		color: var(--color-brass-strong);
		text-decoration: none;
	}

	.preview-link:hover {
		text-decoration: underline;
		text-underline-offset: 0.15em;
	}

	.editor {
		display: grid;
		gap: var(--space-l);
		max-width: 46rem;
	}

	.field-row {
		display: grid;
		gap: var(--space-m);
		grid-template-columns: 1fr 1fr;
	}

	.textarea-sm {
		min-height: 5rem;
	}

	.checkbox-field {
		display: flex;
		align-items: center;
		gap: var(--space-s);
	}

	.checkbox {
		width: 1.1rem;
		height: 1.1rem;
		accent-color: var(--color-brass-strong);
	}

	.label-inline {
		margin: 0;
	}

	.actions {
		display: flex;
		gap: var(--space-s);
		border-top: 1px solid var(--color-ivory-line);
		padding-top: var(--space-l);
	}

	.danger-zone {
		margin-top: var(--space-xl);
		border: 1px solid color-mix(in srgb, var(--color-error) 30%, transparent);
		border-radius: var(--radius-l);
		padding: var(--space-l);
		max-width: 46rem;
	}

	.danger-zone h2 {
		font-family: var(--font-ui);
		font-size: var(--text-body);
		font-weight: 700;
		color: var(--color-error);
		margin-bottom: var(--space-m);
	}

	.danger-actions {
		display: flex;
		gap: var(--space-s);
		flex-wrap: wrap;
		align-items: center;
	}

	.delete-details summary {
		list-style: none;
	}

	.delete-details summary::-webkit-details-marker {
		display: none;
	}

	.delete-confirm {
		display: flex;
		align-items: center;
		gap: var(--space-m);
		flex-wrap: wrap;
		font-size: var(--text-small);
		color: var(--color-error);
		margin-top: var(--space-s);
	}

	@media (max-width: 640px) {
		.field-row {
			grid-template-columns: 1fr;
		}
	}
</style>
