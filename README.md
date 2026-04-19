# ACLS Sim v2

ACLS Sim v2 is a deterministic, guideline-anchored ACLS/ED resuscitation simulator.
This repository implements a greenfield vertical slice for unstable bradycardia.

## Requirements
- Node.js 20+
- npm 10+
- git

## Quick start
```bash
npm install
npm run validate:cases
npm run typecheck
npm run test
npm run dev
```

On PowerShell, if `npm` is blocked by script execution policy, use `npm.cmd`:

```powershell
npm.cmd install
npm.cmd run validate:cases
npm.cmd run typecheck
npm.cmd run test
npm.cmd run dev
```

## Local quality gate
```bash
npm run ci:local
```

## Architecture
- Engine logic lives in `src/engine` and is UI-independent.
- Case content is data-driven (`src/cases/*.json`) and schema-validated (`specs/case.schema.json`).
- UI components consume engine state and dispatch typed actions.

## CI checks
GitHub Actions enforces:
- Case validation
- Typecheck
- Lint
- Unit tests
- Build
- Playwright smoke test
