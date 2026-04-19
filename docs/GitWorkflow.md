# Git Workflow

## Branching
- Protect `main` in GitHub settings.
- Create branches with `codex/` prefix.
- Open PRs for all changes.

## Required checks
- `validate:cases`
- `typecheck`
- `lint`
- `test`
- `build`
- `test:e2e`

## Commit style
- Keep commits small and testable.
- Group by concern (engine, schema, case, UI, tests).
