---
description: Save current session state (run before breaks)
---

Update the work files to capture current state:

## 1. Update .claude/work/current.md

- **Project**: Keep existing
- **Objective**: Keep existing (update if refined)
- **Current Focus**: What we were just working on
- **Last Checkpoint**: Current date and time
- **Next Actions**: 2-5 concrete next steps, in priority order

## 2. Append to .claude/work/log.md

Add entry at the top:
```
## {YYYY-MM-DD HH:MM}

**Session Summary**: One paragraph of what we did

**Decisions Made**:
- {decision}: {rationale} (or "None" if none)

**Actions Taken**:
- {what was done}

**Context/Thoughts**:
- {anything important for future sessions}
```

## 3. Update .claude/work/questions.md

- Add any new open questions
- Remove resolved ones
- Note blockers

## 4. Capture learnings

Review what was done this session. If any durable technical knowledge was discovered (API behaviors, integration patterns, gotchas, things that work):
- Create or update the relevant file in .claude/learnings/{topic}.md
- If nothing new was learned, skip this step

Ask: "Any learnings to capture? (API quirks, gotchas, patterns discovered — or skip)"

## 5. Confirm

Say: "Checkpointed. Next session: {first next action}"
