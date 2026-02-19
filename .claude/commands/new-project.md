---
description: Initialize a new project
argument-hint: <project name and description>
---

Starting a new project. Set up the work state:

## 1. Check for existing work

Read .claude/work/current.md. If there's an active project (Project field is not "(none active)"):
- Ask if I want to archive it first with /close-project
- Or confirm I want to abandon it

## 2. Initialize work files

Update .claude/work/current.md:
```markdown
# Current State

## Project
{project name from argument}

## Objective
{extract or ask for 1-2 sentence objective}

## Current Focus
Initial planning and setup

## Last Checkpoint
{current date and time} - Project initialized

## Next Actions
1. {suggest 2-3 initial actions based on the project description}
```

## 3. Start the log

Prepend to .claude/work/log.md:
```
## {YYYY-MM-DD HH:MM} - Project Started

**Project**: {name}
**Objective**: {objective}

**Initial Context**:
- {any context provided}

**Planned Approach**:
- {high-level approach if discernible}
```

## 4. Clear questions

Reset .claude/work/questions.md to empty (keep header).

## 5. Confirm

Tell me: "Project '{name}' initialized. Ready to start with: {first next action}"
