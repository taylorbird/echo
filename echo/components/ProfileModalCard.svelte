<!-- echo: the body of the profile modal (SPEC §9.3, echo-gomuks
     ProfileCard.tsx): who they are on the left, what you can do on the right,
     then the folded rows. The data and actions are Sable's, the ones its
     MentionProfileCard uses; only the layout is echo's. Another person's
     profile only: your own keeps Sable's card (ProfileModal.svelte). -->
<script lang="ts">
  import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOutIcon';
  import ChatCircleIcon from 'phosphor-svelte/lib/ChatCircleIcon';
  import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
  import CopyIcon from 'phosphor-svelte/lib/CopyIcon';
  import DotsThreeIcon from 'phosphor-svelte/lib/DotsThreeIcon';
  import FlagIcon from 'phosphor-svelte/lib/FlagIcon';
  import ImageIcon from 'phosphor-svelte/lib/ImageIcon';
  import LinkIcon from 'phosphor-svelte/lib/LinkIcon';
  import LockKeyIcon from 'phosphor-svelte/lib/LockKeyIcon';
  import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
  import ShieldCheckIcon from 'phosphor-svelte/lib/ShieldCheckIcon';
  import ShieldWarningIcon from 'phosphor-svelte/lib/ShieldWarningIcon';
  import IconContext from 'phosphor-svelte/lib/IconContext';
  import type {
    MemberView,
    MutualRoomView,
    ProfileView,
    RoomPermissionsView,
    UserSecurityView,
  } from '#src/generated/protocol';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { useCoreClient } from '#lib/core/context.js';
  import FormattedBody from '#lib/features/room/messages/FormattedBody.svelte';
  import MessageReportDialog from '#lib/features/room/messages/MessageReportDialog.svelte';
  import { sendReport } from '#lib/features/room/messages/report.js';
  import {
    MemberProfileActions,
    moderationErrorMessage,
  } from '#lib/features/room/members/member-profile-actions.js';
  import { powerTag } from '#lib/features/room/members/power-tags.js';
  import ProfileOverrideDialog from '#lib/features/room/members/ProfileOverrideDialog.svelte';
  import UserSecurityDialog from '#lib/features/room/members/UserSecurityDialog.svelte';
  import {
    FOUNDER_POWER_LEVEL,
    type PowerLevelTagMap,
  } from '#lib/features/room/settings/power-level-tags.js';
  import { i18n } from '#lib/i18n.js';
  import { profileOverrides } from '#lib/profile/profile-overrides.svelte.js';
  import type { MatrixLink } from '#lib/rooms/matrix-link.js';
  import { roomSectionPath } from '#lib/rooms/permalink.js';
  import { useRoomCosmetics } from '#lib/rooms/room-cosmetics.svelte.js';
  import { hasDirectRoom, roomPathParamFromId, useRoomList } from '#lib/rooms/room-list.svelte.js';
  import { toasts } from '#lib/ui/toasts.svelte.js';
  import ActionMenu from '#lib/ui/primitives/ActionMenu.svelte';
  import ActionMenuItem from '#lib/ui/primitives/ActionMenuItem.svelte';
  import ActionMenuSeparator from '#lib/ui/primitives/ActionMenuSeparator.svelte';
  import Alert from '#lib/ui/primitives/Alert.svelte';
  import Avatar from '#lib/ui/primitives/Avatar.svelte';
  import Button from '#lib/ui/primitives/Button.svelte';
  import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
  import DialogFrame from '#lib/ui/primitives/DialogFrame.svelte';
  import FormField from '#lib/ui/primitives/FormField.svelte';
  import Skeleton from '#lib/ui/primitives/Skeleton.svelte';
  import TextInput from '#lib/ui/primitives/TextInput.svelte';
  import ProfileCardRow from './ProfileCardRow.svelte';

  interface Props {
    userId: string;
    member: MemberView | null;
    roomId: string;
    ownPowerLevel?: number;
    permissions?: RoomPermissionsView | null;
    powerTags?: PowerLevelTagMap | null;
    profile?: ProfileView | null;
    failed?: boolean;
    onAvatarClick?: (source: string, displayName: string) => void;
    onMatrixLink?: (link: MatrixLink, anchor: HTMLAnchorElement) => void;
    onPowerLevelChange?: (roomId: string, userId: string, level: number) => void;
    onClose: () => void;
  }

  let {
    userId,
    member,
    roomId,
    ownPowerLevel = 0,
    permissions = null,
    powerTags = null,
    profile = null,
    failed = false,
    onAvatarClick,
    onMatrixLink,
    onPowerLevelChange,
    onClose,
  }: Props = $props();

  const core = useCoreClient();
  const roomList = useRoomList();
  const roomCosmetics = useRoomCosmetics();
  const actions = new MemberProfileActions(core);
  const fieldId = $props.id();

  // Who they are: the room's member event first, then their global profile,
  // then your own override on top (Sable's order).
  let invitedMember = $state.raw<MemberView | null>(null);
  let roomMember = $derived(member ?? invitedMember);
  let currentProfile = $derived(profile?.user_id === userId ? profile : null);
  let realName = $derived(
    (roomMember ? roomMember.display_name : currentProfile?.display_name) ?? userId
  );
  let realAvatar = $derived(
    roomMember ? roomMember.avatar_url : (currentProfile?.avatar_url ?? null)
  );
  let displayName = $derived(profileOverrides.name(userId, realName));
  let avatarUrl = $derived(profileOverrides.avatar(userId, realAvatar));
  let override = $derived(profileOverrides.of(userId));
  let nameOverridden = $derived(override?.display_name.kind === 'set');
  let pictureOverridden = $derived(override?.avatar.kind === 'set');
  let loading = $derived(!currentProfile && roomMember === null && !failed);
  let showFailure = $derived(failed && !currentProfile && roomMember === null);
  let cosmetics = $derived(roomCosmetics?.for(userId) ?? null);
  let pronouns = $derived(
    (cosmetics?.pronouns.length ? cosmetics.pronouns : (currentProfile?.pronouns ?? []))
      .map((set) => set.summary)
      .filter(Boolean)
      .join(', ')
  );
  let homeserver = $derived(userId.slice(userId.indexOf(':') + 1));
  let profileLink = $derived(`https://matrix.to/#/${userId}`);

  // Sable's card looks up an invited member only when you could act on it.
  $effect(() => {
    const targetRoomId = roomId;
    const targetUserId = userId;
    if (member !== null || targetRoomId === '' || !(permissions?.can_kick ?? false)) return;
    let active = true;
    core.rpc.members
      .list({ room_id: targetRoomId, memberships: ['invite'] })
      .then((members) => {
        if (active) invitedMember = members.find((entry) => entry.user_id === targetUserId) ?? null;
      })
      .catch((error: unknown) => {
        console.debug('[echo profile] invited member unavailable', error);
      });
    return () => {
      active = false;
    };
  });

  // Their local time, kept to the minute.
  let now = $state(Date.now());
  let timezone = $derived(currentProfile?.timezone ?? null);
  let localTime = $derived.by(() => {
    if (!timezone) return null;
    try {
      return new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: timezone,
      }).format(now);
    } catch {
      return null;
    }
  });

  $effect(() => {
    if (!timezone) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(
      () => {
        now = Date.now();
        interval = setInterval(() => (now = Date.now()), 60_000);
      },
      60_000 - (Date.now() % 60_000)
    );
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  });

  // The bio: three lines until opened, and the toggle only when it runs over.
  let bioOpen = $state(false);
  let bioBody = $state<HTMLElement>();
  let bioOverflows = $state(false);

  $effect(() => {
    void currentProfile?.bio;
    if (!bioBody || bioOpen) return;
    const body = bioBody;
    const measure = () => (bioOverflows = body.scrollHeight > body.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  });

  // Copy buttons tick for a moment after copying.
  let copied = $state<'id' | 'link' | null>(null);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  async function copy(which: 'id' | 'link'): Promise<void> {
    await actions.copy(which === 'id' ? userId : profileLink);
    copied = which;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copied = null), 1500);
  }

  $effect(() => () => clearTimeout(copiedTimer));

  // Message: straight to an existing DM; a new one invites them, so it asks.
  let hasDirect = $derived(hasDirectRoom(roomList.rooms, userId));
  let confirmingDirect = $state(false);
  let directPending = $state(false);

  function messageUser(): void {
    if (hasDirect) void openDirect();
    else confirmingDirect = true;
  }

  async function openDirect(): Promise<void> {
    if (directPending) return;
    directPending = true;
    try {
      const dmId = await core.rpc.rooms.createDm({ user_id: userId, encrypted: null });
      onClose();
      await goto(resolve('/(app)/direct/[roomId]', { roomId: roomPathParamFromId(dmId) }));
    } catch (error) {
      console.warn('[echo profile] could not open a chat', error);
      toasts.error(i18n.t('timeline.openChatFailed'));
    } finally {
      directPending = false;
    }
  }

  function openRoom(target: string): void {
    onClose();
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- roomSectionPath() resolves the route itself
    void goto(roomSectionPath(roomList.rooms, target));
  }

  // Shared rooms and whether you ignore them, from one call.
  const PREVIEW_ROOMS = 3;
  let sharedRooms = $state.raw<MutualRoomView[] | null>(null);
  let relationsFailed = $state(false);
  let ignored = $state(false);

  $effect(() => {
    const wanted = userId;
    let active = true;
    core.userRelations(wanted).then(
      (relations) => {
        if (!active) return;
        sharedRooms = relations.mutualRooms.filter((room) => !room.is_space);
        ignored = relations.ignored;
      },
      (error: unknown) => {
        console.warn('[echo profile] user relations unavailable', error);
        if (active) relationsFailed = true;
      }
    );
    return () => {
      active = false;
    };
  });

  function roomName(room: MutualRoomView): string {
    return room.name ?? roomList.byId(room.room_id)?.name ?? room.room_id;
  }

  // Ignoring hides everything they send, so it asks; un-ignoring doesn't.
  let confirmingIgnore = $state(false);

  async function setIgnored(next: boolean): Promise<void> {
    try {
      ignored = await actions.setIgnored(userId, next);
    } catch (error) {
      console.warn('[echo profile] could not change ignore state', error);
      toasts.error(i18n.t('errors.actionFailed'));
    }
  }

  // Security: their identity and devices, summarised; Sable's dialog does
  // the verifying and blocking.
  let security = $state.raw<UserSecurityView | null>(null);
  let securityFailed = $state(false);
  let securityOpen = $state(false);
  let securityRevision = $state(0);

  $effect(() => {
    void securityRevision;
    const wanted = userId;
    let active = true;
    core.rpc.encryption
      .userSecurity({ user_id: wanted })
      .then((value) => {
        if (active) security = value;
      })
      .catch((error: unknown) => {
        console.warn('[echo profile] loading user security failed', error);
        if (active) securityFailed = true;
      });
    return () => {
      active = false;
    };
  });

  const DEVICE_PREVIEW = 4;
  let showAllDevices = $state(false);
  let deviceCount = $derived(
    security ? `${security.devices.length} device${security.devices.length === 1 ? '' : 's'}` : ''
  );

  // In this room: their standing, and what you may do about it (Sable's checks).
  const MEMBERSHIP_LABELS: Record<string, string> = {
    join: '',
    invite: 'Invited',
    knock: 'Asked to join',
    leave: 'Not in this room',
    ban: 'Banned',
  };
  let membership = $derived(roomMember?.membership ?? 'leave');
  let theirLevel = $derived(roomMember?.power_level ?? 0);
  let roleName = $derived(powerTag(theirLevel, i18n.t, powerTags ?? {}).name);
  let outranks = $derived(ownPowerLevel > theirLevel);
  let canKick = $derived(
    outranks &&
      (membership === 'join' || membership === 'invite') &&
      (permissions?.can_kick ?? false)
  );
  let canBan = $derived(outranks && membership !== 'ban' && (permissions?.can_ban ?? false));
  let canUnban = $derived(membership === 'ban' && (permissions?.can_ban ?? false));
  let canInvite = $derived(membership === 'leave' && (permissions?.can_invite ?? false));
  let canSetPower = $derived((permissions?.can_change_power_levels ?? false) && outranks);
  // You can't hand out more power than you have.
  let roles = $derived(
    [...new Set([100, 50, 0, -1, theirLevel, ...Object.keys(powerTags ?? {}).map(Number)])]
      .filter(
        (level) => level === theirLevel || (level <= ownPowerLevel && level !== FOUNDER_POWER_LEVEL)
      )
      .sort((left, right) => right - left)
      .map((level) => ({ level, label: powerTag(level, i18n.t, powerTags ?? {}).name }))
  );
  let pendingLevel = $state<number | null>(null);
  let savingLevel = $state(false);
  let hasRoomDetail = $derived(canSetPower || canKick || canBan || canUnban || canInvite);

  function saveLevel(): void {
    const level = pendingLevel;
    if (level === null || level === theirLevel) return;
    const target = roomId;
    const user = userId;
    savingLevel = true;
    actions
      .setPowerLevel(target, user, level)
      .then(
        () => {
          pendingLevel = null;
          onPowerLevelChange?.(target, user, level);
        },
        (error: unknown) => {
          console.warn('[echo profile] power level change failed', error);
          toasts.error(i18n.t('errors.actionFailed'));
        }
      )
      .finally(() => (savingLevel = false));
  }

  function membershipAction(action: () => Promise<unknown>): void {
    action().catch((error: unknown) => {
      console.warn('[echo profile] moderation action failed', error);
      toasts.error(moderationErrorMessage(error));
    });
  }

  let moderationAction = $state<'kick' | 'ban' | null>(null);
  let moderationReason = $state('');
  let moderationBusy = $state(false);
  let moderationError = $state<string | null>(null);

  function openModeration(action: 'kick' | 'ban'): void {
    moderationAction = action;
    moderationReason = '';
    moderationError = null;
  }

  async function confirmModeration(): Promise<void> {
    const action = moderationAction;
    if (!action || moderationBusy) return;
    moderationBusy = true;
    moderationError = null;
    try {
      await actions.moderate(roomId, userId, action, moderationReason.trim() || null);
      moderationAction = null;
    } catch (error) {
      console.warn('[echo profile] moderation action failed', error);
      moderationError = moderationErrorMessage(error);
    } finally {
      moderationBusy = false;
    }
  }

  let overrideOpen = $state(false);
  let reportOpen = $state(false);
</script>

<IconContext values={{ 'aria-hidden': 'true' }}>
  <div class="echo-profile-body">
    <div class="echo-profile-identity">
      {#if loading}
        <Skeleton class="echo-profile-avatar" />
      {:else if avatarUrl && onAvatarClick}
        <button
          class="echo-profile-avatar"
          type="button"
          title="View full size"
          aria-label={i18n.t('timeline.profileAvatar', { name: displayName })}
          onclick={() => onAvatarClick(avatarUrl, displayName)}
        >
          <Avatar src={avatarUrl} name={displayName} id={userId} size="large" original decorative />
        </button>
      {:else}
        <span class="echo-profile-avatar">
          <Avatar src={avatarUrl} name={displayName} id={userId} size="large" original decorative />
        </span>
      {/if}
      {#if pictureOverridden}
        <span class="echo-profile-override" title="Your picture for them. Only you see it."
          >[override]</span
        >
      {/if}
      {#if localTime && timezone}
        <div class="echo-profile-time" title={timezone}>
          <b>{localTime}</b> for them<br />{timezone.replaceAll('_', ' ')}
        </div>
      {/if}
    </div>

    <div class="echo-profile-details">
      <div class="echo-profile-names">
        {#if loading}
          <Skeleton class="echo-profile-name-skeleton" />
        {:else}
          <div class="echo-profile-name-line">
            <h2 class="echo-profile-name">{displayName}</h2>
            {#if nameOverridden}
              <span
                class="echo-profile-override"
                title={`Your nickname for them. They go by ${realName}.`}>[override]</span
              >
            {/if}
          </div>
        {/if}
        <div class="echo-profile-uid">
          <span>{userId}</span>
          <button
            class={['echo-profile-copy', { copied: copied === 'id' }]}
            type="button"
            title="Copy user ID"
            aria-label="Copy user ID"
            onclick={() => void copy('id')}
          >
            {#if copied === 'id'}<CheckIcon />{:else}<CopyIcon />{/if}
          </button>
          <button
            class={['echo-profile-copy', { copied: copied === 'link' }]}
            type="button"
            title="Copy link to profile"
            aria-label="Copy link to profile"
            onclick={() => void copy('link')}
          >
            {#if copied === 'link'}<CheckIcon />{:else}<LinkIcon />{/if}
          </button>
        </div>
        {#if pronouns}<div class="echo-profile-pronouns">{pronouns}</div>{/if}
        {#if showFailure}<div class="echo-profile-error">Couldn't load their profile.</div>{/if}
      </div>

      {#if currentProfile?.bio}
        <div class={['echo-profile-bio', { open: bioOpen }]}>
          <div class="echo-profile-bio-body" bind:this={bioBody}>
            <FormattedBody
              html={currentProfile.bio}
              senderTimezone={currentProfile.timezone}
              keepMentionText
              {onMatrixLink}
            />
          </div>
          {#if bioOverflows || bioOpen}
            <button class="echo-profile-link" type="button" onclick={() => (bioOpen = !bioOpen)}>
              {bioOpen ? 'Less' : 'More'}
            </button>
          {/if}
        </div>
      {/if}

      <div class="echo-profile-actions">
        <button
          class="echo-card-btn primary"
          type="button"
          disabled={directPending}
          onclick={messageUser}
        >
          <ChatCircleIcon weight="fill" />
          {directPending ? 'Starting…' : hasDirect ? 'Message' : 'Start chat'}
        </button>
        <button class="echo-card-btn" type="button" onclick={() => (overrideOpen = true)}>
          <PencilSimpleIcon />
          {nameOverridden ? 'Change nickname' : 'Nickname'}
        </button>
        <button class="echo-card-btn" type="button" onclick={() => (overrideOpen = true)}>
          <ImageIcon />
          {pictureOverridden ? 'Change picture' : 'Picture'}
        </button>
        <ActionMenu label={i18n.t('timeline.moreActions')}>
          {#snippet trigger({ props })}
            <button
              {...props}
              class="echo-card-btn icon"
              type="button"
              title={i18n.t('timeline.moreActions')}
              aria-label={i18n.t('timeline.moreActions')}
            >
              <DotsThreeIcon weight="bold" />
            </button>
          {/snippet}
          <ActionMenuItem onSelect={() => (securityOpen = true)}>
            <LockKeyIcon />
            {i18n.t('timeline.profileEncryption')}
          </ActionMenuItem>
          <ActionMenuSeparator />
          <ActionMenuItem onSelect={() => void actions.copy(homeserver)}>
            <CopyIcon />
            {i18n.t('timeline.profileCopyServer')}
          </ActionMenuItem>
          <ActionMenuItem onSelect={() => actions.openServer(homeserver)}>
            <ArrowSquareOutIcon />
            {i18n.t('timeline.profileOpenServer')}
          </ActionMenuItem>
          <ActionMenuSeparator />
          <ActionMenuItem destructive onSelect={() => (reportOpen = true)}>
            <FlagIcon />
            {i18n.t('timeline.profileReport')}
          </ActionMenuItem>
        </ActionMenu>
      </div>

      <div class="echo-profile-rows">
        {#snippet roomChip(room: MutualRoomView)}
          {@const name = roomName(room)}
          <button
            class="echo-card-chip"
            type="button"
            title={`Open ${name}`}
            onclick={() => openRoom(room.room_id)}
          >
            <Avatar
              id={room.room_id}
              src={roomList.byId(room.room_id)?.avatar_url}
              {name}
              size="tiny"
              decorative
            />
            <span>{name}</span>
          </button>
        {/snippet}

        {#snippet sharedSummary()}
          {#if relationsFailed}
            <span class="echo-card-dim">Couldn't load them</span>
          {:else if sharedRooms === null}
            <Skeleton class="echo-card-skeleton" />
          {:else if sharedRooms.length === 0}
            <span class="echo-card-dim">None</span>
          {:else}
            {#each sharedRooms.slice(0, PREVIEW_ROOMS) as room (room.room_id)}
              {@render roomChip(room)}
            {/each}
            {#if sharedRooms.length > PREVIEW_ROOMS}
              <span class="echo-card-chip more">+{sharedRooms.length - PREVIEW_ROOMS}</span>
            {/if}
          {/if}
        {/snippet}
        {#snippet sharedOpenSummary()}
          <span>{sharedRooms?.length ?? 0} rooms</span>
        {/snippet}
        {#if sharedRooms && sharedRooms.length > PREVIEW_ROOMS}
          <ProfileCardRow
            label="Shared rooms"
            summary={sharedSummary}
            openSummary={sharedOpenSummary}
          >
            <div class="echo-card-chip-list">
              {#each sharedRooms as room (room.room_id)}{@render roomChip(room)}{/each}
            </div>
          </ProfileCardRow>
        {:else}
          <ProfileCardRow label="Shared rooms" summary={sharedSummary} />
        {/if}

        {#snippet securitySummary()}
          {#if security}
            {#if security.verification_violation}
              <span class="echo-card-trust changed"
                ><ShieldWarningIcon />Their identity changed</span
              >
            {:else if security.verification === 'verified'}
              <span class="echo-card-trust verified"><ShieldCheckIcon />Verified</span>
            {:else if security.verification === 'unverified'}
              <span class="echo-card-trust"><ShieldWarningIcon />Not verified</span>
            {:else}
              <span class="echo-card-trust"><ShieldWarningIcon />No cross-signing keys</span>
            {/if}
            <span class="echo-card-dim">· {deviceCount}</span>
          {:else if securityFailed}
            <span class="echo-card-dim">Couldn't load</span>
          {:else}
            <Skeleton class="echo-card-skeleton" />
          {/if}
        {/snippet}
        {#if security}
          <ProfileCardRow label="Security" summary={securitySummary}>
            {#if security.verification_violation}
              <p class="echo-card-detail-text warning">
                Their identity isn't the one you verified. Trust it only if you know they reset
                their keys.
              </p>
            {/if}
            {#if security.devices.length === 0}
              <p class="echo-card-detail-text">{i18n.t('timeline.profileNoDevices')}</p>
            {:else}
              <ul class="echo-card-devices">
                {#each showAllDevices ? security.devices : security.devices.slice(0, DEVICE_PREVIEW) as device (device.device_id)}
                  {@const trusted = device.verified || device.cross_signed}
                  <li class={['echo-card-device', { trusted, blocked: device.blocked }]}>
                    <span
                      class="echo-card-device-icon"
                      title={device.blocked
                        ? 'Blocked'
                        : trusted
                          ? 'Signed by their identity'
                          : 'Not signed by their identity'}
                    >
                      {#if trusted && !device.blocked}<ShieldCheckIcon />{:else}<ShieldWarningIcon
                        />{/if}
                    </span>
                    <span class="echo-card-device-name"
                      >{device.display_name?.trim() || device.device_id}</span
                    >
                    <code class="echo-card-device-id">{device.device_id}</code>
                  </li>
                {/each}
              </ul>
              {#if security.devices.length > DEVICE_PREVIEW}
                <button
                  class="echo-profile-link"
                  type="button"
                  onclick={() => (showAllDevices = !showAllDevices)}
                >
                  {showAllDevices ? 'Show fewer' : `Show all ${security.devices.length} devices`}
                </button>
              {/if}
            {/if}
            <div class="echo-card-detail-actions">
              <button class="echo-card-btn" type="button" onclick={() => (securityOpen = true)}>
                {security.verification === 'verified' ? 'Manage devices' : 'Verify or block…'}
              </button>
            </div>
          </ProfileCardRow>
        {:else}
          <ProfileCardRow label="Security" summary={securitySummary} />
        {/if}

        {#if roomId !== ''}
          {#snippet roomSummary()}
            {@const status = MEMBERSHIP_LABELS[membership] ?? membership}
            {#if status}<span>{status}</span>{/if}
            {#if membership !== 'ban' && membership !== 'leave'}
              <span class={{ 'echo-card-dim': status !== '' }}>{status ? '· ' : ''}{roleName}</span>
              <span class="echo-card-dim">· power {theirLevel}</span>
            {/if}
          {/snippet}
          {#if hasRoomDetail}
            <ProfileCardRow label="In this room" summary={roomSummary}>
              {#if canSetPower}
                <div class="echo-card-power">
                  <label for={`${fieldId}-role`}>Role</label>
                  <select
                    id={`${fieldId}-role`}
                    value={String(pendingLevel ?? theirLevel)}
                    disabled={savingLevel}
                    onchange={(event) => (pendingLevel = Number(event.currentTarget.value))}
                  >
                    {#each roles as role (role.level)}
                      <option value={String(role.level)}>{role.label} ({role.level})</option>
                    {/each}
                  </select>
                  {#if pendingLevel !== null && pendingLevel !== theirLevel}
                    <button
                      class="echo-card-btn primary"
                      type="button"
                      disabled={savingLevel}
                      onclick={saveLevel}>Save</button
                    >
                  {/if}
                </div>
              {/if}
              {#if canInvite || canKick || canBan || canUnban}
                <div class="echo-card-detail-actions">
                  {#if canInvite}
                    <button
                      class="echo-card-btn"
                      type="button"
                      onclick={() =>
                        membershipAction(() =>
                          core.rpc.rooms.invite({ room_id: roomId, user_id: userId })
                        )}>Invite</button
                    >
                  {/if}
                  {#if canKick}
                    <button
                      class="echo-card-btn danger"
                      type="button"
                      onclick={() => openModeration('kick')}
                      >{membership === 'invite' ? 'Cancel invite' : 'Kick'}</button
                    >
                  {/if}
                  {#if canUnban}
                    <button
                      class="echo-card-btn"
                      type="button"
                      onclick={() =>
                        membershipAction(() =>
                          core.rpc.members.unban({ room_id: roomId, user_id: userId, reason: null })
                        )}>Unban</button
                    >
                  {:else if canBan}
                    <button
                      class="echo-card-btn danger"
                      type="button"
                      onclick={() => openModeration('ban')}>Ban</button
                    >
                  {/if}
                </div>
              {/if}
            </ProfileCardRow>
          {:else}
            <ProfileCardRow label="In this room" summary={roomSummary} />
          {/if}
        {/if}
      </div>

      <div class="echo-profile-footer">
        <button
          class={['echo-profile-link', { danger: !ignored }]}
          type="button"
          onclick={() => (ignored ? void setIgnored(false) : (confirmingIgnore = true))}
        >
          {ignored ? `Stop ignoring ${realName}` : `Ignore ${realName}`}
        </button>
      </div>
    </div>
  </div>
</IconContext>

<ProfileOverrideDialog
  open={overrideOpen}
  {userId}
  {realName}
  {realAvatar}
  onOpenChange={(next) => (overrideOpen = next)}
/>

<UserSecurityDialog
  open={securityOpen}
  {userId}
  {displayName}
  onOpenChange={(next) => {
    securityOpen = next;
    // What you did there (verified, blocked a device) shows in the row.
    if (!next) securityRevision += 1;
  }}
/>

<MessageReportDialog
  bind:open={reportOpen}
  title={i18n.t('timeline.profileReportTitle', { name: displayName })}
  hint={i18n.t('timeline.profileReportHint')}
  onReport={(reason) => {
    const target = userId;
    void sendReport(async () => {
      await core.rpc.account.reportUser({ user_id: target, reason: reason ?? '' });
    });
  }}
/>

<ConfirmDialog
  bind:open={confirmingDirect}
  title={i18n.t('direct.confirmTitle', { name: displayName })}
  description={i18n.t('direct.confirmBody')}
  confirmLabel={i18n.t('direct.submit')}
  confirmVariant="primary"
  onConfirm={() => {
    confirmingDirect = false;
    void openDirect();
  }}
/>

<ConfirmDialog
  bind:open={confirmingIgnore}
  title={`Ignore ${realName}?`}
  description="You won't see their messages or invites."
  confirmLabel="Ignore"
  onConfirm={() => {
    confirmingIgnore = false;
    void setIgnored(true);
  }}
/>

<DialogFrame
  open={moderationAction !== null}
  onOpenChange={(next) => {
    if (!next) moderationAction = null;
  }}
  variant="verification"
  label={moderationAction === 'ban'
    ? i18n.t('timeline.profileBan')
    : i18n.t('timeline.profileKick')}
>
  {#if moderationAction}
    <div class="echo-profile-moderation">
      <h2>
        {moderationAction === 'ban'
          ? i18n.t('timeline.profileBanConfirm', { name: displayName })
          : i18n.t('timeline.profileKickConfirm', { name: displayName })}
      </h2>
      {#if moderationError}
        <Alert variant="critical" role="alert">{moderationError}</Alert>
      {/if}
      <FormField {fieldId} label={i18n.t('timeline.deleteReason')}>
        <TextInput id={fieldId} bind:value={moderationReason} autocomplete="off" />
      </FormField>
      <div class="echo-profile-moderation-actions">
        <Button variant="ghost" onclick={() => (moderationAction = null)}
          >{i18n.t('common.cancel')}</Button
        >
        <Button variant="danger" loading={moderationBusy} onclick={confirmModeration}>
          {moderationAction === 'ban'
            ? i18n.t('timeline.profileBan')
            : i18n.t('timeline.profileKick')}
        </Button>
      </div>
    </div>
  {/if}
</DialogFrame>
