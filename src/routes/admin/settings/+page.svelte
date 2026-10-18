<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let submitting = $state(false);
</script>

<svelte:head>
	<title>Settings · Admin</title>
</svelte:head>

<h1 class="page-title">Settings</h1>

{#if data.mustChangePassword}
	<div class="form-message form-message-error" role="alert">
		Your account was initialized with a temporary password. Set a permanent password before
		continuing.
	</div>
{/if}

<div class="settings-grid">
	<section class="panel">
		<h2>Change password</h2>

		{#if form?.message}
			<div class="form-message form-message-success" role="status">{form.message}</div>
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
				<label class="label" for="current">Current password</label>
				<input class="input" id="current" name="current" type="password" autocomplete="current-password" required />
			</div>
			<div class="field">
				<label class="label" for="password">New password</label>
				<input class="input" id="password" name="password" type="password" autocomplete="new-password" required minlength="10" />
				<p class="hint">At least 10 characters. Must not contain your username.</p>
			</div>
			<div class="field">
				<label class="label" for="confirm">Confirm new password</label>
				<input class="input" id="confirm" name="confirm" type="password" autocomplete="new-password" required />
			</div>
			<button class="btn btn-primary" type="submit" disabled={submitting}>
				{submitting ? 'Updating…' : 'Update password'}
			</button>
		</form>
		<p class="hint">
			Updating the password signs out every other session (PRD §6.5).
		</p>
	</section>

	<section class="panel">
		<h2>Account</h2>
		<dl class="account-facts">
			<dt>Administrator</dt>
			<dd>{data.username}</dd>
		</dl>

		<h2>Password recovery</h2>
		<p class="hint recovery">
			This platform has a single administrator and no email delivery configured, so there is no
			public "forgot password" flow. Recovery is a documented server-side procedure: an operator
			with deployment access runs
			<code>pnpm admin:create -- --reset</code> on the server, which sets a new temporary password
			that must be changed at next sign-in. The procedure is described in README →
			"Password recovery".
		</p>
	</section>
</div>

<style>
	.page-title {
		font-family: var(--font-ui);
		font-size: var(--text-h2);
		font-weight: 700;
		margin-bottom: var(--space-l);
	}

	.settings-grid {
		display: grid;
		gap: var(--space-l);
		grid-template-columns: 1.4fr 1fr;
		align-items: start;
	}

	.panel {
		border: 1px solid var(--color-ivory-line);
		border-radius: var(--radius-l);
		background: var(--color-surface-card);
		padding: var(--space-l);
		display: grid;
		gap: var(--space-m);
	}

	.panel h2 {
		font-family: var(--font-ui);
		font-size: var(--text-body);
		font-weight: 700;
	}

	.panel form {
		display: grid;
		gap: var(--space-m);
	}

	.account-facts {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-xs) var(--space-m);
	}

	.account-facts dt {
		font-size: var(--text-meta);
		font-weight: 600;
		color: var(--color-text-muted-on-ivory);
	}

	.account-facts dd {
		margin: 0;
		font-size: var(--text-small);
		font-weight: 600;
	}

	.recovery {
		line-height: 1.6;
	}

	.recovery code {
		background: var(--color-ivory-deep);
		padding: 0.1em 0.35em;
		border-radius: 4px;
		font-size: 0.9em;
	}

	@media (max-width: 800px) {
		.settings-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
