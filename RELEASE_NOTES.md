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

## Room list

- Unread rooms now carry a red glow bar and a matching badge, in the same lane as the "you are
  here" marker. A room you were named in pulses; everything else glows steadily.
- Rooms you are not in and that do not want you go monochrome, so colour in the list means
  exactly one thing.

## Settings

- Rebuilt around a category rail with search, instead of one long scroll of every preference.
- Each setting shows the value in effect and says what it applies to. The chevron beside a
  control opens per-room and per-device values for just that setting.

## Fixes

- SSO sign-in works again: the session cookie was marked `Secure` and so was never sent back over
  the app's plain-HTTP origin.
- The app no longer shows an unanswerable login form in development builds.
