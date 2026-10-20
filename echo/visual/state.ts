import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { SeededAccount } from './seed';

export const VISUAL_DIR = dirname(fileURLToPath(import.meta.url));
export const OUT_DIR = join(VISUAL_DIR, 'out');
const STATE_PATH = join(OUT_DIR, '.homeserver.json');
export const SKIPPED_PATH = join(OUT_DIR, '.skipped.json');

export type ShotsState = SeededAccount & { baseUrl: string; containerId: string };

const execFileAsync = promisify(execFile);

export async function readState(): Promise<ShotsState | undefined> {
  try {
    return JSON.parse(await readFile(STATE_PATH, 'utf8')) as ShotsState;
  } catch {
    return undefined;
  }
}

export async function writeState(state: ShotsState): Promise<void> {
  await mkdir(dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, undefined, 2));
}

export async function containerRunning(containerId: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('docker', [
      'inspect',
      '--format',
      '{{.State.Running}}',
      containerId,
    ]);
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

export const keepHomeserver = (): boolean => process.env.ECHO_SHOTS_KEEP === '1';
