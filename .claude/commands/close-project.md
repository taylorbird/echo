---
description: Archive project and generate documentation
---

Archive the current project and generate final documentation.

## 1. Get project name

From .claude/work/current.md, slugify the project name (lowercase, hyphens, no spaces).

## 2. Create archive

Create directory: .claude/archive/{project-slug}/

## 3. Generate documentation

### .claude/archive/{project-slug}/summary.md
- Project name and objective
- Duration (first log entry to last)
- Key outcomes
- Final state

### .claude/archive/{project-slug}/decisions.md
- Extract all decisions from .claude/work/log.md
- Organize by theme/category
- Include rationale

### .claude/archive/{project-slug}/lessons-learned.md
- What worked well
- What didn't
- What to do differently next time
- Reusable patterns discovered

### .claude/archive/{project-slug}/architecture.md
- System overview
- Component diagram (mermaid)
- Key technical decisions
- Data flows
- Integration points

## 4. Consolidate learnings

### .claude/archive/{project-slug}/learnings.md
- Merge all files from .claude/learnings/ into a single organized document
- Group by topic, remove duplicates, clean up language
- This becomes the permanent reference for this project's technical knowledge

Then clear .claude/learnings/ (keep README.md only).

## 5. Archive the log

Move .claude/work/log.md to .claude/archive/{project-slug}/full-log.md

## 6. Reset work files

Reset .claude/work/current.md to empty template:
```markdown
# Current State

## Project
(none active)

## Objective
(not set)

## Current Focus
(none)

## Last Checkpoint
(none)

## Next Actions
(none)
```

Create fresh empty .claude/work/log.md and .claude/work/questions.md (headers only).

## 7. Confirm

Say: "Archived '{project}' to .claude/archive/{slug}/. Generated: summary.md, decisions.md, lessons-learned.md, learnings.md, architecture.md"
