<!-- echo: a persistent notice in the window's bottom-right corner while an
     update is available (Sable's desktop update state,
     src/lib/platform/desktop-update.svelte.ts, filled by its five-minute check).
     Sable shows the same update only inside the rail's Alerts popover, where it
     is easy never to see. It stays until the update is installed: Install
     downloads it (or "Update without asking" already has, echo/updates.svelte.ts),
     then Restart applies it, or quitting echo does (echo/electron/updater.ts).
     Mounted by echo/init.ts in the desktop app. -->
<script lang="ts">
  import ArrowCircleUpIcon from 'phosphor-svelte/lib/ArrowCircleUpIcon';
  import { desktopUpdate, installPendingUpdate } from '#lib/platform/desktop-update.svelte.js';
  import { relaunchApp } from '#lib/platform/updates.js';
  import Button from '#lib/ui/primitives/Button.svelte';
  import Progress from '#lib/ui/primitives/Progress.svelte';

  let update = $derived(desktopUpdate.update);
  let stage = $derived(desktopUpdate.stage);
  let version = $derived(update?.version ?? '');
</script>

{#if update}
  <div class="echo-update-notice" role="status" aria-live="polite">
    <ArrowCircleUpIcon class="echo-update-icon" aria-hidden="true" />
    <div class="echo-update-text">
      {#if stage.name === 'staged'}
        <strong>echo {version} is ready</strong>
        <span>Restart now, or it installs when you quit echo.</span>
      {:else if stage.name === 'downloading'}
        <strong>Downloading echo {version}</strong>
        <Progress value={stage.percent} label={`Downloading echo ${version}: ${stage.percent}%`} />
      {:else if stage.name === 'failed'}
        <strong>echo {version} didn't download</strong>
        <span>{stage.message}</span>
      {:else}
        <strong>echo {version} is available</strong>
        <span>Install it now; it applies when you restart or quit.</span>
      {/if}
    </div>
    {#if stage.name === 'staged'}
      <Button variant="primary" size="small" onclick={() => void relaunchApp()}>Restart</Button>
    {:else if stage.name !== 'downloading'}
      <Button variant="primary" size="small" onclick={() => void installPendingUpdate()}>
        {stage.name === 'failed' ? 'Retry' : 'Install'}
      </Button>
    {/if}
  </div>
{/if}

<style>
  /* Above the composer's toolbar, which sits at the window's bottom right. */
  .echo-update-notice {
    align-items: center;
    background: var(--echo-composer);
    border: 1px solid var(--echo-border);
    border-radius: 0.75rem;
    bottom: 6.5rem;
    box-shadow: 0 8px 24px var(--echo-modal-shadow);
    color: var(--echo-text);
    display: flex;
    gap: 0.75rem;
    max-width: min(24rem, calc(100vw - 2rem));
    padding: 0.625rem 0.75rem 0.625rem 0.875rem;
    position: fixed;
    right: 1rem;
    z-index: var(--layer-notify);
  }

  .echo-update-notice :global(.echo-update-icon) {
    color: var(--echo-accent-glow);
    flex: none;
    height: 1.5rem;
    width: 1.5rem;
  }

  .echo-update-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    font-size: 0.8125rem;
    gap: 0.25rem;
    min-width: 0;
  }

  .echo-update-text > strong {
    font-size: 0.875rem;
    font-weight: 600;
  }

  .echo-update-text > span {
    color: var(--echo-text-2);
  }
</style>
