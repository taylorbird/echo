import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { removeContinuwuity, startContinuwuity } from '../../tests/e2e/fixtures/continuwuity';
import { seedAccount } from './seed';
import { OUT_DIR, containerRunning, readState, writeState } from './state';

// Reuses a homeserver a kept run left behind (ECHO_SHOTS_KEEP=1) unless
// ECHO_SHOTS_RESEED=1; otherwise starts and seeds a fresh one.
export default async function globalSetup(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  for (const name of await readdir(OUT_DIR)) {
    if (name.endsWith('.png')) await rm(join(OUT_DIR, name));
  }
  await rm(join(OUT_DIR, '.skipped.json'), { force: true });
  await rm(join(OUT_DIR, '.debug'), { recursive: true, force: true });

  const previous = await readState();
  if (previous?.userId && process.env.ECHO_SHOTS_RESEED !== '1') {
    if (await containerRunning(previous.containerId)) {
      const versions = await fetch(`${previous.baseUrl}/_matrix/client/versions`).catch(
        () => undefined
      );
      if (versions?.ok) {
        console.log(`[echo:shots] reusing homeserver ${previous.containerId.slice(0, 12)}`);
        return;
      }
    }
  }
  if (previous) await removeContinuwuity(previous.containerId).catch(() => undefined);

  const started = Date.now();
  const homeserver = await startContinuwuity();
  // Recorded before seeding, so a failed seed still gets cleaned up.
  await writeState({ ...homeserver, userId: '', rooms: {} });
  const account = await seedAccount(homeserver.baseUrl);
  await writeState({ ...homeserver, ...account });
  console.log(
    `[echo:shots] homeserver ${homeserver.containerId.slice(0, 12)} seeded in ${String(Math.round((Date.now() - started) / 1000))}s`
  );
}
