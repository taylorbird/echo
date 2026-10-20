import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { LOGIN_PASSWORD, LOGIN_USERNAME } from '../../tests/e2e/fixtures/loginAccount';
import { AuthFlow } from '../../tests/e2e/pages/AuthFlow';
import { OUT_DIR, SKIPPED_PATH, readState, type ShotsState } from './state';

type Scheme = 'light' | 'dark';
type View = {
  name: string;
  /** Puts the page in the view; throws when it cannot be reached. */
  open: (page: Page) => Promise<void>;
  /** Undoes `open`, so the next view starts from the room. */
  close?: (page: Page) => Promise<void>;
};

const skipped: string[] = [];
let state: ShotsState;

test.beforeAll(async () => {
  const read = await readState();
  if (!read?.userId) throw new Error('the homeserver was not seeded; see global.setup.ts');
  state = read;
});

test.afterAll(async () => {
  await writeFile(SKIPPED_PATH, JSON.stringify(skipped));
});

// Opening a room would mark it read on the server, so a kept homeserver would
// lose its unread badges after one run. The app never learns the difference.
async function holdReadState(context: BrowserContext): Promise<void> {
  await context.route(/\/_matrix\/client\/[^/]+\/rooms\/[^/]+\/(receipt\/|read_markers)/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );
}

async function signIn(page: Page): Promise<void> {
  const auth = new AuthFlow(page);
  await auth.open(state.baseUrl);
  await expect(auth.moreMethodsButton).toBeVisible({ timeout: 60_000 });
  await auth.revealPasswordLogin();
  await auth.signInWithPassword(LOGIN_USERNAME, LOGIN_PASSWORD);
  await auth.finishSetup();
  await expect(page).toHaveURL(/\/rooms$/, { timeout: 30_000 });
}

async function settle(page: Page): Promise<void> {
  // Off the page, so the last click leaves no hover or tooltip behind.
  await page.mouse.move(-1, -1).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page
    .waitForFunction(() => [...document.images].every((image) => image.complete), undefined, {
      timeout: 5_000,
    })
    .catch(() => undefined);
  // Let entrance transitions and the last sync render finish.
  await page.waitForTimeout(800);
}

async function capture(page: Page, file: string, view: View): Promise<void> {
  try {
    await view.open(page);
    await settle(page);
    await page.screenshot({ path: join(OUT_DIR, `${file}.png`) });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    // oxlint-disable-next-line no-control-regex -- stripping terminal colours
    const reason = detail.replaceAll(/\x1b\[[0-9;]*m/g, '').split('\n')[0];
    skipped.push(`${file}: ${reason}`);
    console.warn(`[echo:shots] skipped ${file}: ${reason}`);
    // What was on screen instead, to fix the view's selectors from.
    const debug = join(OUT_DIR, '.debug', file);
    await mkdir(join(OUT_DIR, '.debug'), { recursive: true });
    await page.screenshot({ path: `${debug}.png` }).catch(() => undefined);
    await page
      .locator('body')
      .ariaSnapshot()
      .then((snapshot) => writeFile(`${debug}.aria.yml`, snapshot))
      .catch(() => undefined);
  } finally {
    await view.close?.(page).catch(() => undefined);
  }
}

const message = (page: Page, text: string) => page.getByText(text, { exact: false }).first();

async function openGeneral(page: Page): Promise<void> {
  if (!new URL(page.url()).pathname.endsWith(encodeURIComponent(state.rooms.general))) {
    await page.goto(`/rooms/${encodeURIComponent(state.rooms.general)}`);
  }
  await expect(page.locator('.timeline-viewport:not(.initial)')).toBeVisible({ timeout: 45_000 });
  await expect(message(page, 'great week')).toBeVisible({ timeout: 20_000 });
}

async function closeDialogs(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const open = page.getByRole('dialog').or(page.getByRole('menu'));
    if ((await open.count()) === 0) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
}

async function roomMenu(page: Page, item: string): Promise<void> {
  await openGeneral(page);
  await page.locator('.room-header').getByRole('button', { name: 'More options' }).click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
}

const roomList: View = {
  name: 'roomlist',
  open: async (page) => {
    await page.goto('/rooms');
    await expect(page.getByRole('link', { name: /Book club/ }).first()).toBeVisible({
      timeout: 30_000,
    });
  },
};

const space: View = {
  name: 'space',
  open: async (page) => {
    await page.goto('/rooms');
    await page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: /Work/ })
      .first()
      .click();
    await expect(page.getByRole('link', { name: /design/ }).first()).toBeVisible({
      timeout: 15_000,
    });
  },
};

// The members side panel; the timeline shot closes it.
async function membersPanel(page: Page, open: boolean): Promise<void> {
  const toggle = page.getByRole('toolbar', { name: 'Room actions' }).getByRole('button', {
    name: 'Members',
    exact: true,
  });
  // Phones have no side panel to close.
  if (!open && !(await toggle.isVisible())) return;
  if ((await toggle.getAttribute('aria-pressed')) !== String(open)) await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', String(open));
}

const timeline: View = {
  name: 'timeline',
  open: async (page) => {
    await openGeneral(page);
    await membersPanel(page, false);
  },
};

const members: View = {
  name: 'members',
  open: async (page) => {
    await openGeneral(page);
    await membersPanel(page, true);
    const panel = page.getByRole('complementary', { name: 'Members' });
    await expect(panel.getByText('Priya Nair', { exact: true })).toBeVisible({ timeout: 10_000 });
  },
  close: (page) => membersPanel(page, false),
};

const profile: View = {
  name: 'profile',
  open: async (page) => {
    await openGeneral(page);
    await page.getByRole('button', { name: "Open Alex Rivera's profile" }).last().click();
    await expect(page.locator('.profile-card').first()).toBeVisible({ timeout: 10_000 });
  },
  close: closeDialogs,
};

const settings: View = {
  name: 'settings',
  open: async (page) => {
    await openGeneral(page);
    await page.getByRole('link', { name: 'Settings', exact: true }).first().click();
    await expect(page.getByRole('navigation', { name: 'Settings sections' })).toBeVisible({
      timeout: 15_000,
    });
  },
  close: async (page) => {
    await closeDialogs(page);
    await openGeneral(page);
  },
};

const roomSettings: View = {
  name: 'modal-room-settings',
  open: async (page) => {
    await roomMenu(page, 'Settings');
    await expect(page.locator('.dialog-content-settings')).toBeVisible({ timeout: 15_000 });
  },
  close: closeDialogs,
};

test.describe('desktop', () => {
  test.use({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 2 });

  test('desktop', async ({ context, page }) => {
    await holdReadState(context);
    await signIn(page);
    // The room list first, in both themes, while every badge is still unread.
    for (const view of [roomList, space, timeline, members, profile, settings, roomSettings]) {
      for (const scheme of ['light', 'dark'] satisfies Scheme[]) {
        await page.emulateMedia({ colorScheme: scheme });
        await capture(page, `desktop-${scheme}-${view.name}`, view);
      }
    }
  });
});

test.describe('phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'light',
  });

  test('phone', async ({ context, page }) => {
    await holdReadState(context);
    await signIn(page);
    for (const view of [roomList, timeline]) await capture(page, `phone-light-${view.name}`, view);
  });
});
