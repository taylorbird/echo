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

## When the local server goes away

- If echo's window loses its connection to the local server that holds your conversations, it
  now says so in words — "Lost the local server", what that means, and when it will try again —
  in a panel over a faded outline of the app, with a **Restart echo** button. It replaced a red
  box with a raw error code and a cat.
- The conversation you were reading is not left on screen behind it. A window that cannot
  scroll or send is not live, and leaving it readable suggested otherwise.

## Every wait now looks like every other wait

- The app had five different spinners, drawn in a green that appeared nowhere else. They are
  all gone.
- Waiting for a whole view — the messages around an event, an edit history, the editor — shows
  a sentence and a hairline, the way first sync does.
- Waiting for part of a panel — someone's avatar and devices, the rooms you share, a map, a
  link preview — shows the shape of what is about to appear.
- Loading older history keeps its button; a thin light travels along its lower edge while it
  works. Confirming an action keeps its buttons rather than swapping them for a spinner.
- The "is typing" line lost its bouncing dots. It was never a wait.
- If you run macOS's Reduce Motion, the placeholder shapes hold still instead of sweeping, the
  same as every other animation in echo. The **Ignore reduce motion** setting turns them on.

## Fixes

- Caption text in light mode — the line under the first-sync message, for one — had no colour of
  its own and took the body colour. It has one now.

## Known issue

- Read receipts are not always sent, so a room can stay marked unread after you have read it.
  Marking it read from another client clears it. Still under investigation.
