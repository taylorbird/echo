// Seeds the throwaway homeserver with a small, realistic account: people with
// avatars, a "Work" space, rooms outside it, DMs, and a busy #general.
import { chromium, webkit, type Browser } from '@playwright/test';
import { registerUser, type RegisteredSession } from '../../tests/e2e/fixtures/continuwuity';
import { LOGIN_PASSWORD, LOGIN_USERNAME } from '../../tests/e2e/fixtures/loginAccount';
import { MatrixAdmin } from '../../tests/e2e/fixtures/matrix';

export const ME_NAME = 'Morgan Blake';

const PEOPLE = [
  { username: 'alex', name: 'Alex Rivera', colour: '#e4572e' },
  { username: 'sam', name: 'Sam Okafor', colour: '#2e86ab' },
  { username: 'priya', name: 'Priya Nair', colour: '#8e5bd6' },
  { username: 'jordan', name: 'Jordan Lee', colour: '#2a9d63' },
] as const;
const ME_COLOUR = '#d4a017';

type Person = (typeof PEOPLE)[number]['username'];

export type SeededAccount = {
  userId: string;
  rooms: Record<string, string>;
};

async function avatarPng(browser: Browser, initial: string, colour: string): Promise<Uint8Array> {
  const page = await browser.newPage();
  try {
    const dataUrl = await page.evaluate(
      ([letter, fill]) => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const draw = canvas.getContext('2d');
        if (!draw) throw new Error('no 2d context');
        draw.fillStyle = fill;
        draw.fillRect(0, 0, 128, 128);
        draw.fillStyle = '#ffffff';
        draw.font = '600 64px -apple-system, Helvetica, Arial, sans-serif';
        draw.textAlign = 'center';
        draw.textBaseline = 'middle';
        draw.fillText(letter, 64, 68);
        return canvas.toDataURL('image/png');
      },
      [initial, colour] as const
    );
    return new Uint8Array(Buffer.from(dataUrl.split(',')[1], 'base64'));
  } finally {
    await page.close();
  }
}

async function setProfile(
  browser: Browser,
  account: MatrixAdmin,
  name: string,
  colour: string
): Promise<void> {
  await account.setDisplayName(name);
  const png = await avatarPng(browser, name[0], colour);
  const uri = await account.uploadMedia(png, 'image/png', 'avatar.png');
  await account.request(
    'PUT',
    `client/v3/profile/${encodeURIComponent(account.userId)}/avatar_url`,
    {
      avatar_url: uri,
    }
  );
}

function asAdmin(baseUrl: string, session: RegisteredSession): MatrixAdmin {
  return new MatrixAdmin(baseUrl, session.accessToken, session.userId);
}

export async function seedAccount(baseUrl: string): Promise<SeededAccount> {
  // The signed-in account first, so it is the server admin.
  const me = asAdmin(baseUrl, await registerUser(baseUrl, LOGIN_USERNAME, LOGIN_PASSWORD));
  const people = {} as Record<Person, MatrixAdmin>;
  for (const person of PEOPLE) {
    people[person.username] = asAdmin(
      baseUrl,
      await registerUser(baseUrl, person.username, LOGIN_PASSWORD)
    );
  }
  // The browser the screenshots use, so a run needs only one installed.
  const browserType = process.env.ECHO_SHOTS_BROWSER === 'chromium' ? chromium : webkit;
  const browser = await browserType.launch();
  try {
    await setProfile(browser, me, ME_NAME, ME_COLOUR);
    for (const person of PEOPLE) {
      await setProfile(browser, people[person.username], person.name, person.colour);
    }
  } finally {
    await browser.close();
  }

  const everyone = Object.values(people);
  const invite = everyone.map((person) => person.userId);
  const groupRoom = async (name: string, topic: string): Promise<string> => {
    const roomId = await me.createRoom({ name, topic, invite });
    for (const person of everyone) await person.join(roomId);
    return roomId;
  };

  const space = await me.createRoom({
    name: 'Work',
    topic: 'Where the team gets things done',
    isSpace: true,
    invite,
  });
  for (const person of everyone) await person.join(space);
  const rooms: Record<string, string> = { Work: space };
  for (const [name, topic] of [
    ['general', 'Company-wide chatter'],
    ['design', 'Mocks, reviews and pixel pushing'],
    ['random', 'Off-topic, cat photos welcome'],
  ] as const) {
    rooms[name] = await groupRoom(name, topic);
    await me.addSpaceChild(space, rooms[name], { suggested: name === 'general' });
    await me.sendStateEvent(rooms[name], 'm.space.parent', space, {
      via: [me.userId.split(':')[1]],
      canonical: true,
    });
  }
  rooms['Book club'] = await groupRoom('Book club', 'This month: Piranesi');
  rooms['Weekend plans'] = await groupRoom('Weekend plans', 'Hikes, brunch, whatever');

  const direct: Record<string, string[]> = {};
  for (const username of ['alex', 'sam'] as const) {
    const roomId = await people[username].request<{ room_id: string }>(
      'POST',
      'client/v3/createRoom',
      {
        preset: 'trusted_private_chat',
        is_direct: true,
        invite: [me.userId],
      }
    );
    await me.join(roomId.room_id);
    direct[people[username].userId] = [roomId.room_id];
    rooms[`dm:${username}`] = roomId.room_id;
  }
  await me.request(
    'PUT',
    `client/v3/user/${encodeURIComponent(me.userId)}/account_data/m.direct`,
    direct
  );

  // Messages, oldest first. Every one is stamped now: backdating needs an
  // appservice, and only an admin can register one, which the e2e fixture's
  // server (first-run mode off) never grants.
  const send = (
    sender: MatrixAdmin,
    roomId: string,
    content: Record<string, unknown>,
    type = 'm.room.message'
  ): Promise<string> => sender.sendEvent(roomId, type, content);
  const text = (body: string, extra: Record<string, unknown> = {}) => ({
    msgtype: 'm.text',
    body,
    ...extra,
  });
  const { alex, sam, priya, jordan } = people;
  const pill = `<a href="https://matrix.to/#/${me.userId}">${ME_NAME}</a>`;

  // #general: yesterday's chatter, then this morning's (all stamped today).
  const general = rooms.general;
  const g = (sender: MatrixAdmin, body: string, extra?: Record<string, unknown>) =>
    send(sender, general, text(body, extra));
  await g(alex, 'Morning all! Standup notes are in the doc as usual.');
  await g(sam, 'Thanks Alex. I pushed the onboarding fixes last night, should be on staging now.');
  const lunch = await g(priya, 'Anyone up for lunch at the noodle place? 12:30?');
  await g(jordan, "I'm in 🍜");
  await g(me, 'Count me in too');
  await g(alex, 'Reminder: design review moved to Thursday at 2pm.');
  const docs = await g(sam, 'Docs for the new sync API are up: https://example.com/docs/sync-v2');
  await g(priya, 'Nice, that was quick. Bookmarking.');
  await g(jordan, 'Is the build slow for anyone else today? Mine took 9 minutes.');
  await g(sam, 'Yeah, the cache got evicted. Should be back to normal after the next run.');
  await g(alex, 'Heading out early, see you tomorrow 👋');
  await g(me, 'Have a good one!');

  await g(jordan, 'Good morning! Coffee machine on 3 is fixed, finally ☕');
  await g(priya, 'The best news of the week');
  await g(alex, 'Here is the helper I mentioned for retrying flaky requests:', {});
  await g(
    alex,
    '```ts\nexport async function retry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {\n  for (let i = 1; ; i++) {\n    try { return await fn(); } catch (e) { if (i >= tries) throw e; }\n  }\n}\n```',
    {
      format: 'org.matrix.custom.html',
      formatted_body:
        '<pre><code class="language-ts">export async function retry&lt;T&gt;(fn: () =&gt; Promise&lt;T&gt;, tries = 3): Promise&lt;T&gt; {\n  for (let i = 1; ; i++) {\n    try { return await fn(); } catch (e) { if (i &gt;= tries) throw e; }\n  }\n}\n</code></pre>',
    }
  );
  await g(sam, 'Nice, small and readable.', {
    'm.relates_to': { 'm.in_reply_to': { event_id: docs } },
  });
  const typo = await g(jordan, 'Release candidate is tagged, plase test when you get a chance');
  await send(jordan, general, {
    ...text('* Release candidate is tagged, please test when you get a chance'),
    'm.new_content': text('Release candidate is tagged, please test when you get a chance'),
    'm.relates_to': { rel_type: 'm.replace', event_id: typo },
  });
  await send(
    alex,
    general,
    { 'm.relates_to': { rel_type: 'm.annotation', event_id: typo, key: '🎉' } },
    'm.reaction'
  );
  await send(
    priya,
    general,
    { 'm.relates_to': { rel_type: 'm.annotation', event_id: typo, key: '🎉' } },
    'm.reaction'
  );
  await send(
    sam,
    general,
    { 'm.relates_to': { rel_type: 'm.annotation', event_id: lunch, key: '👍' } },
    'm.reaction'
  );
  await g(me, "On it. I'll run through the checklist after lunch.");
  await g(priya, 'Did the new icons make it into the RC?');
  await g(jordan, 'They did, along with the dark mode fixes.');
  await g(alex, `@${ME_NAME} can you take a look at the release notes before we send them out?`, {
    format: 'org.matrix.custom.html',
    formatted_body: `${pill} can you take a look at the release notes before we send them out?`,
    'm.mentions': { user_ids: [me.userId] },
  });
  await g(sam, "I'll grab the screenshots for the changelog.");
  await g(priya, 'Thanks all, great week 🙌');

  // Other rooms: a few messages each.
  await send(priya, rooms.design, text('New mocks for the settings page are in Figma.'));
  await send(me, rooms.design, text('These look great, love the new spacing.'));
  await send(alex, rooms.design, text('Can we try a slightly warmer accent?'));
  await send(
    priya,
    rooms.design,
    text(`@${ME_NAME} what do you think about the sidebar width?`, {
      format: 'org.matrix.custom.html',
      formatted_body: `${pill} what do you think about the sidebar width?`,
      'm.mentions': { user_ids: [me.userId] },
    })
  );
  await send(jordan, rooms.random, text('Found a great hiking trail near the lake'));
  await send(sam, rooms.random, text('Who keeps leaving the office plant in the sun?'));
  await send(alex, rooms.random, text('Guilty 🌱'));
  await send(sam, rooms['Book club'], text('Halfway through, no spoilers please!'));
  const bookLast = await send(me, rooms['Book club'], text('The house is so strange, I love it.'));
  await send(jordan, rooms['Weekend plans'], text('Brunch Saturday at 11?'));
  await send(priya, rooms['Weekend plans'], text('Yes! The place with the pancakes.'));
  await send(alex, rooms['dm:alex'], text('Hey, got a minute to pair on the release script?'));
  await send(alex, rooms['dm:alex'], text('No rush, whenever you are free.'));
  await send(sam, rooms['dm:sam'], text('Thanks for the help yesterday!'));
  const samLast = await send(me, rooms['dm:sam'], text('Any time 🙂'));

  // The unread states a real account has beyond those: a muted room with unread
  // messages, a room set to notify on everything, and one marked unread by hand.
  rooms.Announcements = await groupRoom('Announcements', 'Office news');
  rooms.Releases = await groupRoom('Releases', 'Build and release notices');
  rooms['Reading list'] = await groupRoom('Reading list', 'Books to get to');
  const announcementsRead = await send(
    me,
    rooms.Announcements,
    text('Posting office hours here from now on.')
  );
  await me.request(
    'PUT',
    `client/v3/pushrules/global/override/${encodeURIComponent(rooms.Announcements)}`,
    {
      conditions: [{ kind: 'event_match', key: 'room_id', pattern: rooms.Announcements }],
      actions: [],
    }
  );
  await send(priya, rooms.Announcements, text('Office hours move to Thursday.'));
  await send(jordan, rooms.Announcements, text('Parking lot B is closed next week.'));
  await me.request('PUT', `client/v3/pushrules/global/room/${encodeURIComponent(rooms.Releases)}`, {
    actions: ['notify'],
  });
  for (const body of ['Nightly 0.9.1 is out.', 'Nightly 0.9.2 is out.', 'RC1 is tagged.']) {
    await send(sam, rooms.Releases, text(body));
  }
  const readingLast = await send(
    me,
    rooms['Reading list'],
    text('Adding The Dispossessed to the list.')
  );

  // Read up to date: Book club and the DM with Sam. Everything else is unread.
  for (const [roomId, eventId] of [
    [rooms['Book club'], bookLast],
    [rooms['dm:sam'], samLast],
    [rooms.Announcements, announcementsRead],
    [rooms['Reading list'], readingLast],
  ] as const) {
    await me.request('POST', `client/v3/rooms/${encodeURIComponent(roomId)}/read_markers`, {
      'm.fully_read': eventId,
      'm.read': eventId,
    });
  }

  // Read, then marked unread by hand.
  for (const type of ['m.marked_unread', 'com.famedly.marked_unread']) {
    await me.request(
      'PUT',
      `client/v3/user/${encodeURIComponent(me.userId)}/rooms/${encodeURIComponent(rooms['Reading list'])}/account_data/${type}`,
      { unread: true }
    );
  }

  // More spaces, three of them grouped in a rail folder: Sable keeps the rail's
  // order and folders in the in.cinny.spaces account data.
  for (const name of ['Signal', 'WhatsApp', 'Discord', 'Hobbies'] as const) {
    rooms[name] = await me.createRoom({ name, topic: `${name} space`, isSpace: true });
  }
  await me.request(
    'PUT',
    `client/v3/user/${encodeURIComponent(me.userId)}/account_data/in.cinny.spaces`,
    {
      sidebar: [
        rooms.Work,
        {
          id: 'echo-shots-bridges',
          name: 'Bridges',
          content: [rooms.Signal, rooms.WhatsApp, rooms.Discord],
        },
        rooms.Hobbies,
      ],
    }
  );

  return { userId: me.userId, rooms };
}
