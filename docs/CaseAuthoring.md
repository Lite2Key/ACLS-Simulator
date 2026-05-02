# ED Case Lab Case Authoring Guide

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

## Metadata model
- `module`: broad case family, such as `ACLS-adjacent Resuscitation` or `General EM Resuscitation`
- `difficulty`: `foundational`, `intermediate`, or `expert`
- `clinicalStem`: compact ED presentation used by the simulator context UI
- `learningObjectives`: case-specific objectives for debrief and author review

## Gate model
- `hard`: action blocked until prerequisites are met
- `soft`: action allowed but penalized/flagged

## Action effects
Actions are case-authored. Task actions can define `completionEffect`; instant actions can define `effect`. Effects are deterministic engine hooks for clinical state changes, readiness flags, metrics, and debrief events.

## Current cases
- `bradycardia-v1.case.json`
- Demonstrates pads/leads/access/pacing/capture realism
- `septic-shock-v1.case.json`
- Demonstrates broader EM shock resuscitation, antibiotics, pressors, and reassessment
