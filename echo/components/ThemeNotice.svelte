<script lang="ts">
  // The inline confirmation for a theme change (echo/theme-notice.svelte.ts).
  // `bar` is the theme catalog's bottom bar, where the preview bar sits while a
  // theme is being tried; without it, a line under the theme list in Settings →
  // Appearance.
  import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
  import XIcon from 'phosphor-svelte/lib/XIcon';
  import { themePreview } from '#lib/settings/custom-themes.svelte.js';
  import { i18n } from '#lib/i18n.js';
  import Button from '#lib/ui/primitives/Button.svelte';
  import IconButton from '#lib/ui/primitives/IconButton.svelte';
  import { echoActive } from '../active.js';
  import { echoThemeToasts } from '../theme-notice.svelte.js';

  let { bar = false, hidden = false }: { bar?: boolean; hidden?: boolean } = $props();

  let notice = $derived(echoThemeToasts.current);
  let shown = $derived(
    echoActive() && notice !== null && !hidden && !(bar && themePreview.current)
  );
</script>

{#if shown && notice}
  <div class={['echo-theme-notice', { bar }]} role="status">
    <span class="mark"><CheckIcon weight="bold" /></span>
    <span class="message">{notice.message}</span>
    <span class="actions">
      <Button
        variant="ghost"
        size="small"
        onclick={() => {
          echoThemeToasts.undo();
        }}
      >
        {notice.label}
      </Button>
      <IconButton
        variant="ghost"
        size="small"
        label={i18n.t('common.dismiss')}
        onclick={() => {
          echoThemeToasts.close();
        }}><XIcon /></IconButton
      >
    </span>
  </div>
{/if}

<style>
  .echo-theme-notice {
    align-items: center;
    color: var(--echo-text, var(--surface-on-container));
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    min-height: var(--target-hit);
  }

  /* The catalog's bottom bar, laid out like its preview bar. */
  .bar {
    background: var(--echo-chat, var(--surface-container));
    border-top: 1px solid var(--echo-border, var(--surface-container-line));
    bottom: calc(var(--catalog-inset) * -1);
    margin: 0 calc(var(--catalog-inset) * -1) calc(var(--catalog-inset) * -1);
    padding: 0.75rem var(--catalog-inset) var(--catalog-inset);
    position: sticky;
    z-index: 1;
  }

  .mark {
    align-items: center;
    background: color-mix(in srgb, var(--primary-main) 18%, transparent);
    border-radius: 50%;
    color: var(--primary-main);
    display: inline-flex;
    flex: none;
    height: 1.5rem;
    justify-content: center;
    width: 1.5rem;
  }

  .mark :global(svg) {
    height: 0.875rem;
    width: 0.875rem;
  }

  .message {
    flex: 1 1 12rem;
    font-size: var(--font-size-label);
    font-weight: var(--font-weight-medium);
  }

  .actions {
    align-items: center;
    display: flex;
    gap: 0.25rem;
    margin-inline-start: auto;
  }
</style>
