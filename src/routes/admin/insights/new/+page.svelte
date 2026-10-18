<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();

	let submitting = $state(false);

	const v = (name: string, fallback = '') => (form?.values?.[name] as string | undefined) ?? fallback;
	const err = (name: string) => form?.errors?.[name];
</script>

<svelte:head>
	<title>New article · Admin</title>
</svelte:head>

<header class="edit-head">
	<h1>New article</h1>
	<a class="btn btn-secondary btn-sm" href="/admin/insights">Back to insights</a>
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
		<p class="hint">Lowercase letters, digits, hyphens — becomes /insights/your-slug</p>
		{#if err('slug')}<p class="field-error">{err('slug')}</p>{/if}
	</div>

	<div class="field">
		<label class="label" for="excerpt">Excerpt</label>
		<textarea class="textarea textarea-sm" id="excerpt" name="excerpt">{v('excerpt')}</textarea>
	</div>

	<div class="field">
		<label class="label" for="body">Body (Markdown)</label>
		<textarea class="textarea textarea-lg" id="body" name="body" required aria-invalid={!!err('body')}>{v('body')}</textarea>
		<p class="hint">
			Markdown: ## for section headings, **bold**, [links](https://…), lists, > quotes. Save, then
			use "Preview" to see the article exactly as it will publish.
		</p>
		{#if err('body')}<p class="field-error">{err('body')}</p>{/if}
	</div>

	<div class="field-row">
		<div class="field">
			<label class="label" for="category">Category <span class="optional">(optional)</span></label>
			<input class="input" id="category" name="category" value={v('category')} />
		</div>
		<div class="field">
			<label class="label" for="tags">Tags <span class="optional">(comma-separated, optional)</span></label>
			<input class="input" id="tags" name="tags" value={v('tags')} />
		</div>
	</div>

	<div class="field-row">
		<div class="field">
			<label class="label" for="authorLabel">Author label <span class="optional">(only if verified)</span></label>
			<input class="input" id="authorLabel" name="authorLabel" value={v('authorLabel')} />
		</div>
		<div class="field">
			<label class="label" for="coverImage">Cover image URL <span class="optional">(https, optional)</span></label>
			<input class="input" id="coverImage" name="coverImage" inputmode="url" value={v('coverImage')} aria-invalid={!!err('coverImage')} />
			{#if err('coverImage')}<p class="field-error">{err('coverImage')}</p>{/if}
		</div>
	</div>

	<div class="field-row">
		<div class="field">
			<label class="label" for="seoTitle">SEO title <span class="optional">(optional)</span></label>
			<input class="input" id="seoTitle" name="seoTitle" value={v('seoTitle')} />
		</div>
		<div class="field">
			<label class="label" for="seoDescription">SEO description <span class="optional">(optional)</span></label>
			<input class="input" id="seoDescription" name="seoDescription" value={v('seoDescription')} />
		</div>
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
		min-height: 4.5rem;
	}

	.textarea-lg {
		min-height: 22rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.9rem;
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
