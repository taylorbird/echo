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

## The title bar is gone

- The separate strip across the top of the window has been removed. The macOS window controls
  now sit in the space rail, alongside the search field and the room header, the way Mail and
  Messages seat theirs. The panes run to the top edge and the app gets that band back as
  reading space.
- The app's name no longer appears inside the window. It is in the menu bar and the Dock,
  which is where macOS puts it.

## One typeface

- Every name, title and username is now Inter. Space Grotesk has been dropped entirely.
- Room names in the sidebar are mixed case rather than tracked-out capitals, a step larger,
  and white.

## Unread and being named now look different

- A room with unread messages shows a small blue dot. A room where someone used your name
  shows a red badge with an **@**.
- Both were previously the same red, separated only by a pulse on the mention badge — and that
  pulse is switched off by macOS's Reduce Motion setting. Anyone running Reduce Motion could
  not tell the two apart at all. The difference is now carried by colour and by the shape of
  the badge, neither of which an accessibility setting can disable.

## Recent

- The space rail's sub-filters gain **Recent**, next to All chats, Rooms and Direct messages.
  It shows everything — rooms and direct messages together — most recent first, so the
  conversation you were last in is at the top whether or not it is unread.

## Per-room colours have been removed

- Room names no longer take a colour derived from the room. They are the same white in the
  sidebar, the room header, the quick switcher and the space view.
- The **Uniform room list color** setting has gone with them. With one name colour it no longer
  had a second state to switch to.
- The sidebar accent colour still colours the small room glyphs, and the colours people's names
  take in the timeline are unchanged.

## Fixes

- Being signed in now always means being in a space. There was a state where a space could look
  selected in the rail while its sub-filters sat collapsed, which left the room list looking
  like it belonged to nothing.

## Known issue

- Read receipts are not always sent, so a room can stay marked unread after you have read it.
  Marking it read from another client clears it. Still under investigation.
