<!-- echo: one folded line of the profile card (SPEC §9.3, echo-gomuks
     CardRow.tsx): a label, a one-line summary, and the detail underneath,
     opened by the chevron or a click anywhere on the line that isn't a
     control of its own (a room chip). Without detail it is a plain line. -->
<script lang="ts">
  import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
  import type { Snippet } from 'svelte';

  interface Props {
    label: string;
    summary: Snippet;
    /** Shown instead of the summary while open, when the detail repeats it. */
    openSummary?: Snippet;
    children?: Snippet;
    defaultOpen?: boolean;
  }

  let { label, summary, openSummary, children, defaultOpen = false }: Props = $props();
  const detailId = $props.id();
  // Only the starting state: the row opens and closes on its own after that.
  // svelte-ignore state_referenced_locally
  let open = $state(defaultOpen);

  function clickLine(event: MouseEvent): void {
    if (event.target instanceof Element && event.target.closest('button, a, select, input')) return;
    open = !open;
  }
</script>

{#if children}
  <!-- The chevron is the keyboard's way in; the line is a bigger mouse target. -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class={['echo-card-row', 'expandable', { open }]} onclick={clickLine}>
    <span class="echo-card-row-label">{label}</span>
    <span class="echo-card-row-summary"
      >{#if open && openSummary}{@render openSummary()}{:else}{@render summary()}{/if}</span
    >
    <button
      class="echo-card-row-toggle"
      type="button"
      aria-expanded={open}
      aria-controls={detailId}
      aria-label={`${open ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
      onclick={() => (open = !open)}
    >
      <CaretRightIcon />
    </button>
  </div>
  {#if open}
    <div class="echo-card-row-detail" id={detailId}>{@render children()}</div>
  {/if}
{:else}
  <div class="echo-card-row">
    <span class="echo-card-row-label">{label}</span>
    <span class="echo-card-row-summary">{@render summary()}</span>
  </div>
{/if}
