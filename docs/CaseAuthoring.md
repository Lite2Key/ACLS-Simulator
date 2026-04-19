# Case Authoring Guide (MVP)

Case files are JSON documents validated by `specs/case.schema.json`.

## Required sections
- `metadata`
- `modes`
- `timings`
- `initialState`
- `actions`
- `gates`
- `narrativeBeats`
- `outcomes`
- `debriefRules`

## Gate model
- `hard`: action blocked until prerequisites are met
- `soft`: action allowed but penalized/flagged

## Current vertical slice
- `bradycardia-v1.case.json`
- Demonstrates pads/leads/access/pacing/capture realism