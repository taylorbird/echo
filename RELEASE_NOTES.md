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

## Spaces

- Inside a space, **Direct messages** now shows your DMs with people who are in that space or its subspaces. **Rooms** shows only the space's rooms.
- A space's unread badge now includes those DMs.
- Spaces in the sidebar are separated by a thin line.
- Opening and closing a space's filters animates more slowly.

## Messages

- Custom emoji send as emoji again instead of as text.
- A formatting bar appears above the message box when you select text, with bold, italic, strikethrough, code and link. Hover a button to see the markdown it adds.
- The list of who reacted no longer gets cut off at the top.

## Files and images

- Files in the chat show as a card with the file type, name and size.
- Clicking a file opens a window with its details and a **Download** button. Downloads go to your Downloads folder. Documents, audio and video open when they finish, and other files are shown in Finder.
- Enlarged images open in a window with the controls along the top.
- Drop files anywhere on the chat to upload them.
- You can attach several files to one message. Each file is sent as its own message, and your text goes with the last one.
- The upload window has a new layout, and large images no longer fill the screen.

## Profile

- Click your avatar at the bottom of the sidebar to change your display name, picture and bio. It works with or without a room open.

## Known issue

- Read receipts aren't always sent, so a room can stay unread after you've read it. Marking it read in another client clears it.
