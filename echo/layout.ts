// echo's desktop geometry that lives in Sable's script rather than its CSS.

import { BREAKPOINTS } from '#lib/ui/breakpoints.js';
import { sableTest } from './active.js';

/** The room list's default width in px; echo's was 440 (echo/design/SPEC.md §2.1). */
export const ECHO_ROOM_NAV_WIDTH = 440;

/**
 * The root font size Sable's timeline sizes inline media from (ROOT_FONT_PX in
 * timeline-layout.ts, read once as it loads). echo's desktop frame puts the
 * root at 14px (styles/frame.css), where Sable's is 16px, so Sable's estimate
 * would run 14% large. Sable's own tests keep Sable's size.
 */
export function echoRootFontPx(sable: number): number {
  if (typeof matchMedia === 'undefined' || sableTest()) return sable;
  return matchMedia(BREAKPOINTS.appLayout).matches ? 14 : sable;
}
