<!-- echo: where Sable's AppShell mounts its MobileNavDrawer (hooked by its import).
     On a phone, echo's own two-screen shell (PhoneShell.svelte); on the desktop
     layout, or with echo's layer off, Sable's drawer exactly as before, which
     is what lays out the content pane there. -->
<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import type { Snippet } from 'svelte';
  import MobileNavDrawer from '#lib/features/sidebar/MobileNavDrawer.svelte';
  import { BREAKPOINTS } from '#lib/ui/breakpoints.js';
  import { echoActive } from '../active.js';
  import PhoneShell from './PhoneShell.svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
  const appLayout = new MediaQuery(BREAKPOINTS.appLayout);
  const echo = echoActive();
</script>

{#if echo && !appLayout.current}
  <PhoneShell>{@render children()}</PhoneShell>
{:else}
  <MobileNavDrawer>{@render children()}</MobileNavDrawer>
{/if}
