<!-- echo: the main pane of a place with no room open. echo-gomuks showed
     nothing there (gomuks web/src/ui/MainScreen.tsx), so this is the bare chat
     surface, without Sable's welcome, support and donate cards. It takes
     HomeLanding's props and stands in for it: Home's and the rooms outside
     spaces' pages import this instead. On phones or with echo off it renders
     Sable's HomeLanding unchanged.
     The rooms outside spaces are a place of their own (their rail tile, the
     globe), but sign-in, account switching and the other Sable flows land on
     /rooms by goto, so those go on to Home. Arriving by a link (the tile) or
     Back stays. -->
<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { afterNavigate, goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import HomeLanding from '#lib/features/home/HomeLanding.svelte';
  import { i18n } from '#lib/i18n.js';
  import { preferences } from '#lib/settings/preferences.svelte.js';
  import { BREAKPOINTS } from '#lib/ui/breakpoints.js';
  import { echoActive } from '../active.js';

  let props: ComponentProps<typeof HomeLanding> = $props();
  const appLayout = new MediaQuery(BREAKPOINTS.appLayout);

  let empty = $derived(echoActive() && appLayout.current);

  afterNavigate((navigation) => {
    if (navigation.type === 'link' || navigation.type === 'popstate') return;
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
