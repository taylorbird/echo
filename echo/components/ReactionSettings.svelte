<!-- echo: the room list's reaction settings (echo/design/SPEC.md §4.6), a card
     in Sable's Notifications settings, hooked into its category panels
     (src/lib/features/settings/category-panels.ts) by echo/settings.ts.
     Desktop only, like the room list they change. Kept on this device (echo/reactions.svelte.ts), not in
     Sable's synced preferences. -->
<script lang="ts">
  import { i18n } from '#lib/i18n.js';
  import SettingsRow from '#lib/ui/primitives/SettingsRow.svelte';
  import Switch from '#lib/ui/primitives/Switch.svelte';
  import '#lib/ui/primitives/settings-row.css';
  import { echoReactions } from '../reactions.svelte.js';

  const IN_LIST = 'Show reactions in the room list';
  const AS_NOTIFICATIONS = 'Show reactions as notifications';
</script>

<section class="settings-form" aria-labelledby="echo-reactions">
  <div class="settings-heading-row">
    <h3 id="echo-reactions" data-settings-outline>Reactions</h3>
  </div>
  <p class="hint settings-description">When someone reacts to one of your messages.</p>

  <ul class="settings-rows">
    <SettingsRow
      id="echo-reactions-in-list"
      title={IN_LIST}
      description="Pop the emoji into a room's badge for 5 seconds when someone reacts to your message."
      control="echo-reactions-in-list-switch"
    >
      <Switch
        id="echo-reactions-in-list-switch"
        label={IN_LIST}
        checked={echoReactions.inList}
        onCheckedChange={(checked: boolean) => {
          echoReactions.setInList(checked);
        }}
      />
    </SettingsRow>
    <SettingsRow
      id="echo-reactions-as-notifications"
      title={AS_NOTIFICATIONS}
      description="Keep a marker on the room until you open it."
      disabled={!echoReactions.inList}
      badge={echoReactions.inList ? undefined : i18n.t('settings.needsSetting', { name: IN_LIST })}
      control={echoReactions.inList ? 'echo-reactions-as-notifications-switch' : undefined}
      class="gated"
    >
      <Switch
        id="echo-reactions-as-notifications-switch"
        label={AS_NOTIFICATIONS}
        disabled={!echoReactions.inList}
        checked={echoReactions.inList && echoReactions.asNotifications}
        onCheckedChange={(checked: boolean) => {
          echoReactions.setAsNotifications(checked);
        }}
      />
    </SettingsRow>
  </ul>
</section>
