<!-- echo: a DM's page at /direct/<id>, which Sable's flows open (New chat,
     accepting a DM invite, a profile's message button). While Home exists the
     direct messages are no place of their own (echo/styles/rail.css hides
     their tile), so the page goes on to the same room in Home, which lists
     every chat, as /rooms goes on to Home (EmptyPane.svelte). The direct
     room page imports this in place of RoomOrForumPage. On phones or with
     echo off it renders Sable's page unchanged. -->
<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import RoomOrForumPage from '#lib/features/forum/RoomOrForumPage.svelte';
  import { roomPathParamFromId } from '#lib/rooms/room-list.svelte.js';
  import { preferences } from '#lib/settings/preferences.svelte.js';
  import { BREAKPOINTS } from '#lib/ui/breakpoints.js';
  import { echoActive } from '../active.js';

  const appLayout = new MediaQuery(BREAKPOINTS.appLayout);

  let toHome = $derived(echoActive() && appLayout.current && preferences.showHome);

  $effect(() => {
    const roomId = page.params.roomId;
    if (!toHome || roomId === undefined) return;
    // The query and hash carry an event to jump to.
    const room = roomPathParamFromId(roomId);
    void goto(resolve(`home/${room}${page.url.search}${page.url.hash}`), { replace: true });
  });
</script>

{#if !toHome}
  <RoomOrForumPage />
{/if}
