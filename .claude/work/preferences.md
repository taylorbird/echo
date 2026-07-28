# Candidate Preferences

This file holds candidate standing preferences about how the user likes to work, observed by Claude during sessions. These are OBSERVATIONS, not confirmed rules — they have not been reviewed or approved by the user. Treat them as hypotheses to weigh, not instructions to follow blindly. The user should review and can confirm, correct, or discard any of these.

<!-- Entries appended, newest first -->

## 2026-07-28

- Works by rapid visual iteration: makes one change, looks at it, gives short directional feedback ("more contrast", "too clunky", "not distinct enough") rather than specifying values. Prefers a change shipped and shown over options presented.
- Explicitly grants latitude to deviate from a stated earlier constraint when the design calls for it ("We can deviate from the Ferra color scheme. That's fine.") — but expects to be told when it happens.
- Reverses direction freely and expects prior states preserved rather than lost (asked for the warm palette to be remembered as a possible future theme before switching away from it).
- Uses speech-to-text, so terms arrive garbled ("Faro"/"Farah" for Ferra, "the pen" for the pin icon, "candy" for the colour direction). Interpret intent rather than the literal words.
- Values native-platform behaviour: asked for Cmd+, specifically as "the Mac native keyboard shortcut".
- Notices and flags things twice if not addressed the first time (the modal's sharp edges) — treat a repeat mention as a firm request rather than a passing remark.
- Wants root causes, not just fixes: responded well to being told WHY drag-and-drop and the missing animation were broken (a Tauri default and an OS accessibility setting) rather than just that they were fixed.

## 2026-07-27

- The user iterates visually in tight loops: they look at the live app and give short, specific corrective feedback ("too close", "scoot it left five pixels", "don't want it curved"). Small tunable CSS tokens with the exact value named in the response seem to work well for them.
- They share annotated screenshots of reference apps (e.g. Reeder) and of their own app to communicate design intent, and respond well to having the STRUCTURAL insight extracted from the reference rather than surface styling copied wholesale.
- They pushed back on a real bug Claude introduced/missed (the dev-server port collision) with a terse correction — direct and low-ceremony, not a long explanation.
- They explicitly waived the App Store / private-API concern because this is a personal app, suggesting a general preference for capability over distribution constraints on this particular project.
- They interject new requests mid-turn rather than waiting for the current one to fully complete.
