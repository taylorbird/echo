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
