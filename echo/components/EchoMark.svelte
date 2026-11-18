<!-- echo's penguin as an icon: the app icon's outline (echo/brand/logo.svg,
     #outline) in the current text colour, so it reads as echo wherever a
     phosphor icon would go (Settings → echo, echo/settings-category.ts). Takes
     phosphor's `weight`: "fill" is the solid silhouette, anything else the
     outline, as Sable's settings list switches them for the open entry. -->
<script lang="ts">
  interface Props {
    weight?: string;
    class?: string;
  }

  let { weight = 'regular', class: className }: Props = $props();

  // The logo's outline, beak to the left, in the logo's own coordinates
  // (about 146–398 across, 84–416 down); the viewBox squares it up.
  const OUTLINE = `M280,84 C240,86 214,100 206,124 L146,142 L204,160 C196,196 178,240 172,296
    C168,340 178,378 200,404 L232,416 L276,416 C300,416 330,410 352,398 L398,386
    C394,330 398,270 390,210 C382,140 340,90 280,84 Z`;
</script>

<svg
  class={className}
  viewBox="102 80 340 340"
  width="1em"
  height="1em"
  fill="currentColor"
  aria-hidden="true"
>
  {#if weight === 'fill'}
    <path d={OUTLINE} />
  {:else}
    <path d={OUTLINE} fill="none" stroke="currentColor" stroke-width="22" stroke-linejoin="round" />
  {/if}
</svg>
