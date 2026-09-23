<!-- Notes for the release you are about to cut. scripts/release.sh reads this file, puts it in the
     updater feed (which is what the app renders in the "What's new" panel), uses it as the GitHub
     release body, and archives a copy to release-notes/<version>.md. Overwrite it each release.
     Left empty between releases on purpose: release.sh refuses to run until it is filled in.

     Comment lines like this one are stripped. Supported formatting is deliberately small — it is
     rendered as React elements, never as HTML:

       ## Heading            (any depth; all render the same)
       - bullet
       **bold**  `code`  [label](https://example.com)

     Anything else comes through as plain text. Links must be http(s) or they render as their
     label alone.

     How to write them (see release-notes/0.6.1.md for the model):
       - One line per bullet. Never hard-wrap: GitHub shows the wraps as line breaks, and app
         versions before 0.6.2 split a wrapped bullet into a bullet plus a stray paragraph.
       - Plain headings that name the area ("Room list", "Fixes"), not slogans.
       - Say what changed, briefly. Leave out why, how it works inside, and anything a user
         cannot see (cookies, CSS, dev builds).
       - No em dashes, no punchy closing lines, no "X, not Y" framing.
       - Setting and button names in **bold**, exactly as they appear in the app. -->

## Mentions

- Mentioning someone in the composer now shows @Name instead of a long link. The mention still works the same when you send.
- The mention list is bigger, and long names are cut short with "…" instead of running past the edge.
- Mentions in messages start with @ and use that person's colour.

## Reactions

- Reactions are a bit bigger, with slightly rounded corners instead of a pill shape. Mentions use the same shape.

## Space rail

- Rooms, Direct messages and Recent under All chats now work straight after opening echo.
- The Rooms and Direct messages views show a plain title instead of a header you can collapse.
- All chats has a new icon.

## Fixes

- Fixed line breaks in the "What's new" panel.

## Known issue

- Read receipts aren't always sent, so a room can stay unread after you've read it. Marking it read in another client clears it.
