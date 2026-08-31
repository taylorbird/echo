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

## Fixes

- Clicking someone else's reaction to add your own now works. It had been sending an empty
  reaction and failing silently.
- Unread badges are all one size again. Mentions and notifications were drawing a larger dot than
  ordinary unread messages, which put two sizes of the same red badge down one list.

## Room list

- Rooms you are not in keep their own colour, just muted, instead of being drained to grey. They
  still sit back from unread rooms, but stay tellable apart at a glance.

## Known issue

- Read receipts are not always sent, so a room can stay marked unread after you have read it.
  Marking it read from another client clears it. Under investigation.
