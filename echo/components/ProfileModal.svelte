<!-- echo: the "User profile" card (echo/design/SPEC.md §9.3), a centred,
     dimmed two-column modal where Sable anchors a popover to the name. It
     takes MentionProfile's props and stands in for it: Sable's openers import
     this instead (RoomView.svelte, RoomNav.svelte). On phones, your own
     profile, a per-message persona, or with echo off, it renders Sable's
     MentionProfile unchanged. -->
<script lang="ts">
  import XIcon from 'phosphor-svelte/lib/XIcon';
  import type { ComponentProps } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { useCoreClient } from '#lib/core/context.js';
  import MentionProfile from '#lib/features/room/members/MentionProfile.svelte';
  import { BREAKPOINTS } from '#lib/ui/breakpoints.js';
  import DialogFrame from '#lib/ui/primitives/DialogFrame.svelte';
  import { echoActive } from '../active.js';
  import ProfileModalCard from './ProfileModalCard.svelte';

  type Props = ComponentProps<typeof MentionProfile>;

  let { open = $bindable(false), ...props }: Props = $props();
  const core = useCoreClient();
  const appLayout = new MediaQuery(BREAKPOINTS.appLayout);

  let modal = $derived(
    echoActive() &&
      appLayout.current &&
      !props.pmp &&
      (props.userId === null || props.userId !== core.session?.user_id)
  );

  function setOpen(next: boolean): void {
    open = next;
    props.onOpenChange?.(next);
  }
</script>

{#if modal}
  <DialogFrame
    open={open && props.userId !== null}
    onOpenChange={setOpen}
    variant="verification"
    contentClass="echo-profile-box"
    label="User profile"
  >
    <div class="echo-profile">
      <header class="echo-profile-header">
        <span class="echo-profile-title">User profile</span>
        <button
          class="echo-profile-close"
          type="button"
          title="Close"
          aria-label="Close"
          onclick={() => setOpen(false)}
        >
          <XIcon />
        </button>
      </header>
      {#if props.userId}
        {#key props.userId}
          <ProfileModalCard
            userId={props.userId}
            member={props.member}
            roomId={props.roomId}
            ownPowerLevel={props.ownPowerLevel}
            permissions={props.permissions}
            powerTags={props.powerTags}
            profile={props.profile}
            failed={props.failed}
            onAvatarClick={props.onAvatarClick}
            onMatrixLink={props.onMatrixLink}
            onPowerLevelChange={props.onPowerLevelChange}
            onClose={() => setOpen(false)}
          />
        {/key}
      {/if}
    </div>
  </DialogFrame>
{:else}
  <MentionProfile bind:open {...props} />
{/if}
