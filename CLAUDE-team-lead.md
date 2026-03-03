# Ralph Team Lead Mode

You are running in **team mode**. Instead of working on one story at a time, coordinate multiple agents working in parallel.

## Your Task

1. Read `prd.json` to find ALL user stories where `passes: false`
2. Read `progress.txt` (check the Codebase Patterns section first for important context)
3. Ensure you're on the correct branch from PRD `branchName`. If not, check it out or create from main.
4. Group the failing stories by dependency — stories that touch the same files should run sequentially, independent stories can run in parallel
5. Spawn worker agents using the Agent tool with `isolation: "worktree"` for each story (or group)
6. After workers complete, merge their worktree branches into the working branch one at a time, resolving any conflicts
7. Run quality checks (typecheck, lint, test) on the merged result
8. Update `prd.json` to set `passes: true` for each completed story
9. Append progress for each completed story to `progress.txt` (see Progress Report Format below)
10. Update CLAUDE.md files if you discover reusable patterns

## Spawning Workers

For each failing story, use the Agent tool like this:

- `subagent_type`: `"general-purpose"`
- `isolation`: `"worktree"`
- `mode`: `"bypassPermissions"`
- `prompt`: Include the full story details (ID, title, acceptance criteria), the codebase patterns from progress.txt, and clear instructions

### Worker Prompt Must Include

- The exact story to implement (paste the full story object from the PRD)
- Any codebase patterns from progress.txt
- Instruction to commit with message: `feat: [Story ID] - [Story Title]`
- Instruction to run quality checks before committing (typecheck, lint, test — whatever the project uses)
- Instruction to keep changes focused and minimal
- Instruction to follow existing code patterns

## After Workers Complete

1. For each worker that made changes, merge its worktree branch into the working branch:
   ```
   git merge <worktree-branch> --no-edit
   ```
2. If a merge has conflicts, resolve them carefully
3. After all merges, run the full quality check suite
4. If checks fail, fix the issues and commit the fix
5. Update `prd.json` — set `passes: true` for each successfully completed story
6. Commit the prd.json update: `git commit -m "chore: mark completed stories as passing"`

## Progress Report Format

APPEND to progress.txt for each completed story (never replace existing content):
```
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- Mode: team (parallel)
- **Learnings for future iterations:**
  - Patterns discovered
  - Gotchas encountered
  - Useful context
---
```

## Stop Condition

After all work is merged and quality checks pass, check if ALL stories have `passes: true`.

If ALL stories are complete and passing, reply with:
<promise>COMPLETE</promise>

If some stories could not be completed, document why in progress.txt and end your response normally.

## Important

- Use `isolation: "worktree"` for ALL workers to avoid git conflicts
- Merge worktree branches one at a time to catch conflicts early
- ALL commits must pass quality checks — do NOT merge broken code
- Keep the working branch green at all times
- Read Codebase Patterns in progress.txt BEFORE spawning workers — share these with every worker
