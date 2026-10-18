<script lang="ts">
	import { enhance } from '$app/forms';

	let { form }: { form: { message?: string; values?: { username?: string } } | null } = $props();

	let submitting = $state(false);
</script>

<svelte:head>
	<title>Sign in · Admin</title>
</svelte:head>

<section class="login-card surface-card">
	<p class="eyebrow">Administration</p>
	<h1>Sign in</h1>

	{#if form?.message}
		<div class="form-message form-message-error" role="alert">{form.message}</div>
	{/if}

	<form
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
			<label class="label" for="username">Username</label>
			<input
				class="input"
				id="username"
				name="username"
				type="text"
				autocomplete="username"
				required
				value={form?.values?.username ?? ''}
			/>
		</div>

		<div class="field">
			<label class="label" for="password">Password</label>
			<input
				class="input"
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				required
			/>
		</div>

		<button class="btn btn-primary btn-block" type="submit" disabled={submitting}>
			{submitting ? 'Signing in…' : 'Sign in'}
		</button>
	</form>

	<p class="hint">
		Access is limited to the platform administrator. Password recovery is performed on the server
		by an operator with deployment access — there is no public reset endpoint.
	</p>
</section>

<style>
	.login-card {
		width: min(100%, 24rem);
		padding: var(--space-2xl);
		display: grid;
		gap: var(--space-m);
	}

	h1 {
		font-family: var(--font-ui);
		font-size: 1.6rem;
		font-weight: 700;
	}

	form {
		display: grid;
		gap: var(--space-m);
	}

	.btn-block {
		width: 100%;
	}

	.hint {
		font-size: var(--text-meta);
		color: var(--color-text-muted-on-ivory);
	}
</style>
