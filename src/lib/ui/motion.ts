import { prefersReducedMotion } from 'svelte/motion';

import { preferences } from '#lib/settings/preferences.svelte.js';
import { echoSystemReducedMotion } from '../../../echo/motion.js';

/** Keep these in sync with the duration tokens in `src/styles.css`. */
export const MOTION_MS = {
  micro: 80,
  quick: 150,
  fast: 250,
  medium: 350,
  slow: 400,
} as const;

export function shouldReduceMotion(): boolean {
  return preferences.reducedMotion || echoSystemReducedMotion(prefersReducedMotion.current);
}

export function motionMs(duration: number): number {
  return shouldReduceMotion() ? 0 : duration;
}

export function scrollBehavior(): ScrollBehavior {
  return shouldReduceMotion() ? 'auto' : 'smooth';
}
