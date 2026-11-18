<!-- echo: Settings → echo → Updates, in the desktop app (echo/settings.ts).
     "Update without asking" (echo/updates.svelte.ts): off, echo updates as
     Sable does; on, a found update downloads by itself and installs when echo
     quits. Kept on this device, not in Sable's synced preferences. -->
<script lang="ts">
  import SettingsRow from '#lib/ui/primitives/SettingsRow.svelte';
  import Switch from '#lib/ui/primitives/Switch.svelte';
  import '#lib/ui/primitives/settings-row.css';
  import { echoUpdates } from '../updates.svelte.js';

  const WITHOUT_ASKING = 'Update without asking';
</script>

<section class="settings-form">
  <ul class="settings-rows">
    <SettingsRow
      id="echo-update-without-asking"
      title={WITHOUT_ASKING}
      description="Download new versions of echo as soon as they're out, and install them when you quit echo. Off, the update notice waits for you to press Install."
      control="echo-update-without-asking-switch"
    >
      <Switch
        id="echo-update-without-asking-switch"
        label={WITHOUT_ASKING}
        checked={echoUpdates.withoutAsking}
        onCheckedChange={(checked: boolean) => {
          echoUpdates.setWithoutAsking(checked);
        }}
      />
    </SettingsRow>
  </ul>
</section>
