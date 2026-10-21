// echo: Sable's own "Reduce motion" setting decides whether echo animates. The
// system setting only seeds that setting's first value; Sable otherwise ORs it
// in for good, so with macOS's Reduce motion on, nothing could ever animate.
// echo-gomuks had the same escape hatch ("Ignore reduce motion").

import { echoActive } from './active.js';

export function echoSystemReducedMotion(system: boolean): boolean {
  return system && !echoActive();
}
