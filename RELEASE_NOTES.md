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

## Signing in

- Signing in now happens in your browser. Enter your address, choose **Continue in your browser**, and approve the sign-in on the page that opens.
- The sign-in page names echo instead of showing a localhost address.
- The old sign-in method has been removed. If you're already signed in, you stay signed in.

## Search

- New message search, from the search button in the room header.
- The first launch after updating can take a few minutes while echo builds the search index.

## Messages

- Polls now show in the timeline.
- Failed messages are easier to spot, and **Undo** puts a failed message back in the composer.
- A message's menu can show everyone who reacted to it.
- You can tick to-do checkboxes in your own messages.
- In the composer, Tab accepts macOS inline suggestions and no longer moves you out of the text box.
- **Request key** on a message that couldn't be decrypted shows its result in echo instead of a system alert.

## Rooms and settings

- Settings open without a room selected.
- Room settings can change a room's name, topic, history visibility and who can join.
- Your devices are listed under Encryption.
- New room list options under Appearance: **Compact room list**, **Previews in room list**, **Alphabetical room list**, **Pin favorites to top**, **Pin low priority to bottom** and **No unreads in low priority**.
- New **Notification sound** and **Notification sound volume** settings, including per room.
- **Send as file** in the upload dialog.
- Escape now clears a reply or closes the side panel before it closes the room.

## Other changes

- Profiles can show a bio.
- The GIF picker uses Klipy by default. Giphy and Tenor are still available under **GIF provider**.
- Messages you send now say they came from echo. **Hide fingerprint** turns this off.
- Inter is now included with echo instead of loaded from the web.
- Image packs saved to your account, rather than to a room, are no longer supported.
- Long lines in the "What's new" panel no longer run under the scrollbar.

## Known issue

- Read receipts aren't always sent, so a room can stay unread after you've read it. Marking it read in another client clears it.
