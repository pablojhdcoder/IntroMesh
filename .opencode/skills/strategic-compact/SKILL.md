---
name: strategic-compact
description: Suggests manual context compaction at logical intervals to preserve context through task phases rather than arbitrary auto-compaction. Use when a session is approaching a context limit and a task phase is a natural place to compact.
---

Solo-session compaction discipline for long IntroMesh tasks.

- Compact at phase boundaries (explore done, milestone green, switching layers), never mid-task.
- At each boundary run `/checkpoint`: `npm test` plus `npm run lint` green, then a `type(module): what changed and why` commit message proposal. Committed work is the real context backup.
- When resuming, state in 5 lines max: current goal, files touched, last green command output, next step, open risks. Drop everything else.
- Keep one contract per delegation: the lead agent defines types and order; subagents (`ui-design-engineer`, `meta-ai-matching-engineer`, reviewers) never share files.
