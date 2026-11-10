<!-- echo: the room list's settings in Settings → echo, echo's own category
     (echo/settings.ts), hooked into Sable's category panels
     (src/lib/features/settings/category-panels.ts). Kept on this device
     (echo/space-icons.svelte.ts), not in Sable's synced preferences. -->
<script lang="ts">
  import SettingsRow from '#lib/ui/primitives/SettingsRow.svelte';
  import Switch from '#lib/ui/primitives/Switch.svelte';
  import '#lib/ui/primitives/settings-row.css';
  import { echoSpaceIcons } from '../space-icons.svelte.js';

  const SPACE_ICONS = 'Show space icons in All chats';
</script>

<section class="settings-form" aria-labelledby="echo-room-list">
  <div class="settings-heading-row">
    <h3 id="echo-room-list" data-settings-outline>Room list</h3>
  </div>

  <ul class="settings-rows">
    <SettingsRow
      id="echo-space-icons"
      title={SPACE_ICONS}
      description="Put the avatar of each space a room or DM is in at the right edge of its row."
      control="echo-space-icons-switch"
    >
      <Switch
        id="echo-space-icons-switch"
        label={SPACE_ICONS}
        checked={echoSpaceIcons.show}
        onCheckedChange={(checked: boolean) => {
          echoSpaceIcons.setShow(checked);
        }}
      />
    </SettingsRow>
  </ul>
</section>
