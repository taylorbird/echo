import { readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { removeContinuwuity } from '../../tests/e2e/fixtures/continuwuity';
import { OUT_DIR, SKIPPED_PATH, keepHomeserver, readState } from './state';

export default async function globalTeardown(): Promise<void> {
  const state = await readState();
  if (state && !keepHomeserver()) {
    await removeContinuwuity(state.containerId).catch(() => undefined);
    await rm(join(OUT_DIR, '.homeserver.json'), { force: true });
  } else if (state) {
    console.log(
      `\n[echo:shots] kept homeserver ${state.containerId.slice(0, 12)} for the next run; remove it with \`mise run echo:shots:down\``
    );
  }

  const shots = (await readdir(OUT_DIR).catch(() => [])).filter((name) => name.endsWith('.png'));
  const skipped = await readFile(SKIPPED_PATH, 'utf8')
    .then((text) => JSON.parse(text) as string[])
    .catch(() => []);
  console.log(`\n[echo:shots] ${String(shots.length)} screenshots in ${OUT_DIR}`);
  for (const name of shots.sort()) console.log(`  ${name}`);
  if (skipped.length > 0) {
    console.log('[echo:shots] skipped:');
    for (const line of skipped) console.log(`  ${line}`);
  }
}
