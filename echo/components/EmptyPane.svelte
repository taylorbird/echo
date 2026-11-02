<!-- echo: the main pane of a place with no room open. echo-gomuks showed
     nothing there (gomuks web/src/ui/MainScreen.tsx), so this is the bare chat
     surface, without Sable's welcome, support and donate cards. It takes
     HomeLanding's props and stands in for it: Home's and the rooms outside
     spaces' pages import this instead. On phones or with echo off it renders
     Sable's HomeLanding unchanged.
     While Home exists the rooms outside spaces are no place of their own
     (echo/styles/rail.css hides their tile), so their page goes on to Home:
     sign-in, account switching and the other Sable flows that land on /rooms
     arrive there. -->
<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import HomeLanding from '#lib/features/home/HomeLanding.svelte';
  import { i18n } from '#lib/i18n.js';
  import { preferences } from '#lib/settings/preferences.svelte.js';
  import { BREAKPOINTS } from '#lib/ui/breakpoints.js';
  import { echoActive } from '../active.js';

  let props: ComponentProps<typeof HomeLanding> = $props();
  const appLayout = new MediaQuery(BREAKPOINTS.appLayout);

  let empty = $derived(echoActive() && appLayout.current);

  $effect(() => {
    if (empty && props.titleKey === 'nav.unspaced' && preferences.showHome) {
      void goto(resolve('/(app)/home'), { replace: true });
    }
  });
</script>

<svelte:head>
  {#if empty}
    <title>{i18n.t(props.titleKey ?? 'nav.home')} - echo</title>
  {/if}
</svelte:head>

{#if empty}
  <main class="echo-empty-pane" aria-label={i18n.t(props.titleKey ?? 'nav.home')}></main>
{:else}
  <HomeLanding {...props} />
{/if}

<style>
  .echo-empty-pane {
    background: var(--echo-chat);
    height: 100%;
    width: 100%;
  }
</style>
