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

- People joining or leaving no longer marks rooms unread. One person rejoining a lot of rooms
  used to light up the whole room list at once. The joins still appear in the timeline — you
  just aren't notified about them. Invites to you still notify, as before.

## Known issue

- Read receipts are not always sent, so a room can stay marked unread after you have read it.
  Marking it read from another client clears it. Still under investigation.
