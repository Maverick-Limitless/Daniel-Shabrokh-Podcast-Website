<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();

	let submitting = $state(false);

	const v = (name: string, fallback = '') => (form?.values?.[name] as string | undefined) ?? fallback;
	const err = (name: string) => form?.errors?.[name];
</script>

<svelte:head>
	<title>New episode · Admin</title>
</svelte:head>

<header class="edit-head">
	<h1>New audio episode</h1>
	<a class="btn btn-secondary btn-sm" href="/admin/audio">Back to audio</a>
</header>


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
		<input class="input" id="title" name="title" required value={v('title')} aria-invalid={!!err('title')} />
		{#if err('title')}<p class="field-error">{err('title')}</p>{/if}
	</div>

	<div class="field">
		<label class="label" for="slug">Slug</label>
		<input class="input" id="slug" name="slug" required value={v('slug')} aria-invalid={!!err('slug')} />
		<p class="hint">Becomes /listen/your-slug</p>
		{#if err('slug')}<p class="field-error">{err('slug')}</p>{/if}
	</div>

	<div class="field">
		<label class="label" for="audioSourceUrl">Audio source URL</label>
		<input class="input" id="audioSourceUrl" name="audioSourceUrl" required value={v('audioSourceUrl')} aria-invalid={!!err('audioSourceUrl')} />
		<p class="hint">
			An https:// URL of an audio file you are authorized to use, or a root-relative path such as
			/fixtures/dev-tone-30s.wav for the labeled development fixture. Never point this at media
			you have no right to distribute (PRD §5.3).
		</p>
		{#if err('audioSourceUrl')}<p class="field-error">{err('audioSourceUrl')}</p>{/if}
	</div>

	<div class="field">
		<label class="label" for="description">Description</label>
		<textarea class="input textarea textarea-sm" id="description" name="description">{v('description')}</textarea>
	</div>

	<div class="field-row">
		<div class="field">
			<label class="label" for="episodeNumber">Episode number <span class="optional">(optional)</span></label>
			<input class="input" id="episodeNumber" name="episodeNumber" type="number" min="1" max="9999" value={v('episodeNumber')} />
		</div>
		<div class="field">
			<label class="label" for="durationSeconds">Duration (seconds) <span class="optional">(optional)</span></label>
			<input class="input" id="durationSeconds" name="durationSeconds" type="number" min="0" max="86400" value={v('durationSeconds')} />
		</div>
	</div>

	<div class="field-row">
		<div class="field">
			<label class="label" for="coverImage">Cover image URL <span class="optional">(https, optional)</span></label>
			<input class="input" id="coverImage" name="coverImage" inputmode="url" value={v('coverImage')} />
		</div>
		<div class="field">
			<label class="label" for="category">Category <span class="optional">(optional)</span></label>
			<input class="input" id="category" name="category" value={v('category')} />
		</div>
	</div>

	<div class="field">
		<label class="label" for="tags">Tags <span class="optional">(comma-separated, optional)</span></label>
		<input class="input" id="tags" name="tags" value={v('tags')} />
	</div>

	<div class="field checkbox-field">
		<input class="checkbox" id="featured" name="featured" type="checkbox" />
		<label class="label label-inline" for="featured">Featured (highlighted on the home page)</label>
	</div>

	<div class="actions">
		<button class="btn btn-secondary" type="submit" formaction="?/save" disabled={submitting}>
			{submitting ? 'Saving…' : 'Save draft'}
		</button>
		<button class="btn btn-primary" type="submit" formaction="?/publish" disabled={submitting}>
			{submitting ? 'Publishing…' : 'Publish'}
		</button>
	</div>
</form>

<style>
	.edit-head {
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

	@media (max-width: 640px) {
		.field-row {
			grid-template-columns: 1fr;
		}
	}
</style>
