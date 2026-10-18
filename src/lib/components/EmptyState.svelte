<script lang="ts">
	let {
		title,
		hint,
		actionHref,
		actionLabel
	}: {
		title: string;
		hint?: string;
		actionHref?: string;
		actionLabel?: string;
	} = $props();
</script>

<div class="empty">
	<p class="empty-title">{title}</p>
	{#if hint}
		<p class="empty-hint">{hint}</p>
	{/if}
	{#if actionHref && actionLabel}
		<a class="btn btn-secondary btn-sm" href={actionHref}>{actionLabel}</a>
	{/if}
</div>

<style>
	.empty {
		display: grid;
		gap: var(--space-s);
		justify-items: center;
		text-align: center;
		padding: var(--space-2xl) var(--space-m);
		border: 1px dashed var(--color-ivory-line);
		border-radius: var(--radius-l);
	}

	.empty-title {
		font-family: var(--font-display);
		font-size: var(--text-h3);
		font-weight: 640;
	}

	.empty-hint {
		font-size: var(--text-small);
		color: var(--color-text-muted-on-ivory);
		max-width: 34rem;
	}
</style>
