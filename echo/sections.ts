// echo: a collapsed room-list section shows "Expand for more" under the rooms
// it still lists (echo/styles/roomlist.css). That line is the list's ::after,
// so a click on it lands on the list itself; this opens the section by
// clicking its heading.

// Favourites' list follows its heading; the main list sits in a wrapper that does.
function headingFor(list: Element): HTMLElement | null {
  for (const candidate of [
    list.previousElementSibling,
    list.parentElement?.previousElementSibling,
  ]) {
    if (
      candidate instanceof HTMLElement &&
      candidate.matches(".rooms-heading[data-state='closed']")
    ) {
      return candidate;
    }
  }
  return null;
}

export function expandOnMarkerClick(): void {
  document.addEventListener('click', (event) => {
    const list = event.target;
    if (!(list instanceof HTMLElement) || !list.matches('.room-list')) return;
    const heading = headingFor(list);
    if (!heading) return;
    // Only the marker: below the last row.
    const rows = list.querySelectorAll(':scope > .room-row-wrap:not(.closed-row)');
    if (rows.length > 0 && event.clientY < rows[rows.length - 1].getBoundingClientRect().bottom) {
      return;
    }
    heading.click();
  });
}
