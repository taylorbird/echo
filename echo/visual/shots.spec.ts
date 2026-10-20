import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
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
  /** Records measurements once the view is fully set up. */
  measure?: (page: Page) => Promise<void>;
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

// ECHO_SHOTS_LIVE_CSS=1 layers echo/theme.css as it is on disk over the built
// app, so CSS-only changes can be checked without the minutes-long rebuild.
// Rules deleted since the last build still apply until the next one.
async function inlineCss(path: string): Promise<string> {
  const css = await readFile(path, 'utf8');
  const parts = css.split(/@import url\('([^']+)'\);/);
  let out = '';
  for (const [index, part] of parts.entries()) {
    out += index % 2 === 0 ? part : await inlineCss(resolve(dirname(path), part));
  }
  return out;
}

async function liveCss(context: BrowserContext): Promise<void> {
  if (process.env.ECHO_SHOTS_LIVE_CSS !== '1') return;
  const css = await inlineCss(resolve(import.meta.dirname, '../theme.css'));
  await context.addInitScript((text) => {
    const add = () => {
      const style = document.createElement('style');
      style.dataset.echoLive = '';
      style.textContent = text;
      document.head.append(style);
    };
    // Init scripts can run before <head> exists.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add);
    else add();
  }, css);
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
    await view.measure?.(page);
    await page.screenshot({ path: join(OUT_DIR, `${file}.png`) });
    // The rendered markup, to write echo's CSS against Sable's real classes.
    if (process.env.ECHO_SHOTS_DOM === '1') {
      await writeFile(join(OUT_DIR, `${file}.html`), await page.content());
    }
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

// echo's right panel closes with Esc, and stays closed in the next room.
const membersEscape: View = {
  name: 'members-esc',
  open: async (page) => {
    await members.open(page);
    await page.mouse.move(-1, -1);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('complementary', { name: 'Members' })).toHaveCount(0);
  },
};

const membersNextRoom: View = {
  name: 'members-next-room',
  open: async (page) => {
    await members.open(page);
    // Book club is read already, so opening it costs no other shot an unread badge.
    await page.goto(`/rooms/${encodeURIComponent(state.rooms['Book club'])}`);
    await expect(page.locator('.timeline-viewport:not(.initial)')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('complementary', { name: 'Members' })).toHaveCount(0);
  },
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

// Home: every room in one list, with echo's parted rail open under its tile.
const home: View = {
  name: 'home',
  open: async (page) => {
    await page.goto('/home');
    await expect(page.locator('.echo-rail-band')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: /Releases/ }).first()).toBeVisible({
      timeout: 15_000,
    });
  },
};

// Home narrowed to direct messages by the band's sub-filter.
const homeDirect: View = {
  name: 'home-dms',
  open: async (page) => {
    await home.open(page);
    await page.locator('.echo-rail-band').getByRole('button', { name: 'Direct messages' }).click();
    await expect(page.locator('html[data-echo-filter="dms"]')).toHaveCount(1);
  },
  close: async (page) => {
    await page.locator('.echo-rail-band').getByRole('button', { name: 'All chats' }).click();
  },
};

// The Work space with each of the band's sub-filters selected. The selected
// row's box is saved to out/.pill-<view>.json, to check the pill against it.
function spaceFilter(value: string, label: string): View {
  return {
    name: `space-${value}`,
    open: async (page) => {
      await space.open(page);
      await page.locator('.echo-rail-band').getByRole('button', { name: label }).click();
      await expect(page.locator(`html[data-echo-filter="${value}"]`)).toHaveCount(1);
    },
    measure: async (page) => {
      const row = await page
        .locator('.echo-rail-band [aria-pressed="true"]')
        .evaluate((element) => {
          const box = element.getBoundingClientRect();
          return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
        });
      await writeFile(join(OUT_DIR, `.pill-space-${value}.json`), JSON.stringify(row));
    },
  };
}

const spaceFilters = [
  spaceFilter('all', 'All chats'),
  spaceFilter('rooms', 'Rooms'),
  spaceFilter('dms', 'Direct messages'),
  spaceFilter('recent', 'Recent'),
];

// The macOS app's chrome, which a browser never gets: echo/init.ts and Sable
// set these on <html> inside the app.
function inApp(view: View): View {
  return {
    name: view.name,
    open: async (page) => {
      await view.open(page);
      await page.evaluate(() => {
        document.documentElement.dataset.tauriOs = 'macos';
        document.documentElement.dataset.clientDecorations = 'mac';
      });
    },
    close: view.close,
    measure: view.measure,
  };
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 2 });

  test('desktop', async ({ context, page }) => {
    await holdReadState(context);
    await liveCss(context);
    await signIn(page);
    // The room list first, in both themes, while every badge is still unread.
    for (const view of [
      roomList,
      home,
      homeDirect,
      space,
      timeline,
      members,
      membersEscape,
      membersNextRoom,
      profile,
      settings,
      roomSettings,
    ]) {
      for (const scheme of ['light', 'dark'] satisfies Scheme[]) {
        await page.emulateMedia({ colorScheme: scheme });
        await capture(page, `desktop-${scheme}-${view.name}`, view);
      }
    }
  });
});

test.describe('app', () => {
  test.use({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 2 });

  test('app', async ({ context, page }) => {
    await holdReadState(context);
    await liveCss(context);
    await signIn(page);
    for (const view of [home, timeline, members]) {
      for (const scheme of ['light', 'dark'] satisfies Scheme[]) {
        await page.emulateMedia({ colorScheme: scheme });
        await capture(page, `app-${scheme}-${view.name}`, inApp(view));
      }
    }
    await page.emulateMedia({ colorScheme: 'dark' });
    for (const view of spaceFilters) await capture(page, `app-dark-${view.name}`, inApp(view));
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
    await liveCss(context);
    await signIn(page);
    for (const view of [roomList, timeline]) await capture(page, `phone-light-${view.name}`, view);
  });
});

// The setup screens after a first sign-in, at a short desktop window: each step
// is screenshotted, and whether a wheel over it scrolls anything is recorded
// in out/.setup-scroll.json (a short window must be able to reach the
// buttons at the bottom).
test.describe('setup', () => {
  test.use({ viewport: { width: 1280, height: 440 }, deviceScaleFactor: 2 });

  test('setup', async ({ context, page }) => {
    await holdReadState(context);
    await liveCss(context);
    const auth = new AuthFlow(page);
    await auth.open(state.baseUrl);
    await expect(auth.moreMethodsButton).toBeVisible({ timeout: 60_000 });
    await auth.revealPasswordLogin();
    await auth.signInWithPassword(LOGIN_USERNAME, LOGIN_PASSWORD);
    const report: Record<string, { overflow: number; scrolled: number }> = {};
    for (let index = 0; index < 12; index += 1) {
      await expect(page).toHaveURL(/\/(setup\/[a-z]+|rooms)$/, { timeout: 30_000 });
      const path = new URL(page.url()).pathname;
      if (path.endsWith('/rooms')) break;
      const step = path.split('/').pop() ?? String(index);
      await settle(page);
      await page.screenshot({ path: join(OUT_DIR, `setup-${step}.png`) });
      // How far the page overflows the window, and how far a wheel moved it.
      const overflow = await page.evaluate(() =>
        Math.max(
          ...[document.documentElement, ...document.querySelectorAll('main')].map(
            (element) => element.scrollHeight - element.clientHeight
          )
        )
      );
      await page.mouse.move(640, 300);
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(300);
      const scrolled = await page.evaluate(() =>
        Math.max(
          window.scrollY,
          ...[...document.querySelectorAll('*')].map((element) => element.scrollTop)
        )
      );
      report[step] = { overflow, scrolled };
      await page.screenshot({ path: join(OUT_DIR, `setup-${step}-scrolled.png`) });
      const before = page.url();
      // AuthFlow's own step picker; private to the e2e suite, reused as is.
      await expect(async () => {
        await (await auth['nextSetupAction']()).click({ timeout: 5_000 });
      }).toPass({ timeout: 30_000 });
      await page
        .waitForURL((url) => url.href !== before, { timeout: 5_000 })
        .catch(() => undefined);
    }
    await writeFile(join(OUT_DIR, '.setup-scroll.json'), JSON.stringify(report, null, 2));
  });
});
