<!-- Notes for the release you are about to cut. scripts/release.sh reads this file, puts it in the
     updater feed (which is what the app renders in the "What's new" panel), uses it as the GitHub
     release body, and archives a copy to release-notes/<version>.md. Overwrite it each release.

     Comment lines like this one are stripped. Supported formatting is deliberately small — it is
     rendered as React elements, never as HTML:

       ## Heading            (any depth; all render the same)
       - bullet
       **bold**  `code`  [label](https://example.com)

     Anything else comes through as plain text. Links must be http(s) or they render as their
     label alone. -->

## The rail opens up

- Clicking a space now slides the sidebar apart, revealing the space with its own sub-filters
  underneath: everything, just its rooms, or just its direct messages.
- **All chats** and **Outside spaces** get the same treatment — Outside spaces is the new
  network-of-bubbles icon, covering every chat no space has claimed, direct messages included.
  The DMs filter under All chats brings back the old direct-chats view.
- Unreads moved below your spaces, behind its own divider.
- The yellow marker now follows the view you are actually in — select Rooms inside a space and
  the marker moves with you.
- Everything is a little bigger, and opening and closing is animated (when "Ignore reduce
  motion" is on).

## Room list

- The open room sits on a stronger highlight with a lit edge, so it no longer looks like a
  hover that got stuck.
- A new **Room list color** setting picks the accent used when every room shares one color —
  which is now the default. Per-room colors are still there as a toggle.
- New button in the header to mark every unread room read at once, with a confirmation.

## Known issue

- Read receipts are not always sent, so a room can stay marked unread after you have read it.
  Marking it read from another client clears it. Still under investigation.
