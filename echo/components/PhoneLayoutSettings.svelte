<!-- echo: where the phone's room list keeps its spaces (echo/mobile/layout.svelte.ts),
     a card in Sable's Appearance settings, hooked into its category panels
     (src/lib/features/settings/category-panels.ts) by echo/settings.ts. Phones
     only, like the room list it changes. Kept on this device, not in Sable's
     synced preferences. -->
<script lang="ts">
  import SettingsRow from '#lib/ui/primitives/SettingsRow.svelte';
  import Switch from '#lib/ui/primitives/Switch.svelte';
  import '#lib/ui/primitives/settings-row.css';
  import { phoneLayout } from '../mobile/layout.svelte.js';

  const ON_TOP = 'Spaces along the top';
</script>

<section class="settings-form" aria-labelledby="echo-phone-layout">
  <div class="settings-heading-row">
    <h3 id="echo-phone-layout" data-settings-outline>Room list</h3>
  </div>

  <ul class="settings-rows">
    <SettingsRow
      id="echo-spaces-on-top"
      title={ON_TOP}
      description="Show your spaces in a row under the title. Off, they open in a drawer from the left edge."
      control="echo-spaces-on-top-switch"
    >
      <Switch
        id="echo-spaces-on-top-switch"
        label={ON_TOP}
        checked={phoneLayout.spacesOnTop}
        onCheckedChange={(checked: boolean) => {
          phoneLayout.setSpacesOnTop(checked);
        }}
      />
    </SettingsRow>
  </ul>
</section>
