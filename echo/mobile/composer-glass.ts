// echo: the phone's floating glass composer (echo/styles/mobile-timeline.css).
// The composer sits over the timeline, so the timeline pads its end by the
// composer's height. Sable's room view owns the composer, so this watches the
// open page for its dock and publishes the dock's height as
// --echo-m-composer-h on the page's screen.

const DOCK = '.room-view .composer-dock';

export function trackComposerHeight(screen: HTMLElement): () => void {
  let dock: Element | null = null;
  const sizes = new ResizeObserver((entries) => {
    const box = entries.at(-1)?.borderBoxSize[0];
    if (box) screen.style.setProperty('--echo-m-composer-h', `${String(box.blockSize)}px`);
  });

  const find = (): void => {
    const next = screen.querySelector(DOCK);
    if (next === dock) return;
    if (dock) sizes.unobserve(dock);
    dock = next;
    if (dock) sizes.observe(dock);
    else screen.style.removeProperty('--echo-m-composer-h');
  };

  // The dock comes and goes with the room (and with Sable re-rendering it), so
  // re-check on any change under the page; each check is one lookup.
  const pages = new MutationObserver(find);
  pages.observe(screen, { childList: true, subtree: true });
  find();

  return () => {
    pages.disconnect();
    sizes.disconnect();
    screen.style.removeProperty('--echo-m-composer-h');
  };
}
