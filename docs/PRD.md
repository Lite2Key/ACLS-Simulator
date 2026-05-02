# ED Case Lab PRD

## Product Identity

ED Case Lab is a case-based emergency medicine resuscitation leadership simulator. It teaches learners how to lead high-stakes ED cases under time pressure by practicing prioritization, setup discipline, parallel tasking, reassessment, and debrief-driven reflection.

ACLS remains an important module, but it is not the full product identity. ACLS-adjacent cases are the first proof point for a broader EM simulation engine.

## Target Learners

- Emergency medicine residents and medical students
- APPs, nurses, paramedics, and interprofessional resuscitation teams
- Expert clinicians using the app for focused refreshers or teaching

## Core Experience

The first screen is the simulator cockpit. The learner sees a live patient monitor, case context, active team tasks, concise team updates, and a command surface for clinical actions. Cases run on deterministic time and evolve based on what the learner does, delays, or omits.

The app should not feel like a quiz or a checklist. It should feel like leading a room.

## Initial Case Set

1. **Unstable Bradycardia**
   - Flagship ACLS-adjacent case.
   - Focus: leads versus pads, vascular access, atropine, pacing setup, current/rate selection, and mechanical capture.

2. **Septic Shock**
   - First broader EM resuscitation case.
   - Focus: early shock recognition, parallel access/labs/cultures/fluids/antibiotics, pressor escalation, and perfusion reassessment.

## Design Principles

- Dense, credible clinical cockpit rather than marketing page.
- Monitor is the visual anchor.
- Action panel is workflow-oriented, not trivia-oriented.
- Expert play uses minimal guidance: clinically plausible observations only, no “next best action” coaching.
- Teaching happens primarily in debrief.
- Cases should support replayability through competing priorities, changing physiology, and delayed consequences.

## Engine Goals

- Generic patient state and environment readiness.
- Deterministic task queue and scheduled event queue.
- Case-authored actions, gates, effects, narrative beats, metrics, outcomes, and debrief teaching points.
- Multiple case modules loaded from data files.
- Clear support for additional EM case families, including shock, airway, toxicology, trauma, metabolic emergencies, and ACLS arrest variants.

## Acceptance Criteria

- App branding and docs use ED Case Lab.
- Bradycardia and septic shock are selectable and playable.
- Each case has its own debrief metrics and teaching points.
- Expert mode avoids automatic coaching prompts.
- Case validation, typecheck, lint, unit tests, build, and e2e smoke test pass.
