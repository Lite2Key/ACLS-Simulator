# ED Case Lab

ED Case Lab is a deterministic, case-based emergency medicine resuscitation leadership simulator.

The app teaches the choreography and judgment of emergency care: prioritization, parallel setup, reassessment, and debrief-driven learning under time pressure.

## Current Cases

- Unstable Bradycardia: ACLS-adjacent flagship case focused on pacing setup and capture.
- Septic Shock: general EM resuscitation case focused on early shock care, antibiotics, pressors, and reassessment.

## Requirements

- Node.js 20+
- npm 10+
- git

## Quick Start

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

## Local Quality Gate

```bash
npm run ci:local
```

## Architecture

- Engine logic lives in `src/engine` and is UI-independent.
- Case content is data-driven (`src/cases/*.json`) and schema-validated (`specs/case.schema.json`).
- UI components consume engine state and dispatch case-authored actions.
- Debrief metrics are case-defined rather than ACLS-only.

## CI Checks

GitHub Actions enforces:

- Case validation
- Typecheck
- Lint
- Unit tests
- Build
- Playwright smoke test
