import { describe, expect, it } from 'vitest';

import { summarise } from '../src/lib/features/notifications/conversation';

import { echoNotificationBody, oneLineBody } from './notification-body';

const line = (sender: string | null, body: string) => ({ sender, body, eventId: null });

describe('oneLineBody', () => {
  it('keeps a single message as it is', () => {
    expect(oneLineBody([line('wreck', 'hi')], summarise)).toBe('wreck: hi');
  });

  it('shows the latest message and counts the rest on one line', () => {
    const body = oneLineBody(
      [
        line(null, 'New message from wreck'),
        line(null, 'New message from wreck'),
        line(null, 'New message from Fiona'),
      ],
      summarise
    );
    expect(body).toBe('New message from Fiona (+2 more)');
    expect(body).not.toContain('\n');
  });
});

it("flattens a message's own line breaks", () => {
  expect(oneLineBody([line('wreck', 'one\n\ntwo')], summarise)).toBe('wreck: one two');
});

describe('echoNotificationBody', () => {
  it("leaves Sable's stacked body alone when echo's layer is off", () => {
    const lines = [line('a', 'one'), line('b', 'two')];
    expect(echoNotificationBody(lines, summarise)).toBe('a: one\nb: two');
  });
});
