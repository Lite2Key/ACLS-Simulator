# ED Case Lab Simulation Engine Contract

## Deterministic API
- `createSimulationEngine(caseDef, modeConfig)`
- `dispatch(action, now)`
- `tick(toTime)`
- `getState()`
- `getDebrief()`

## Core responsibilities
- Hold patient/environment/team state
- Track task queue and event queue
- Enforce hard and soft realism gates
- Emit timeline events for UI and debrief
- Record case-defined metrics and misses
- Support multiple EM case families from validated case JSON

## Determinism guarantees
- All state changes depend only on case data + action sequence + timestamps.
- No random branches in current implementation.
- `tick` processes queued events in chronological order.

## Modes
- Guided: shorter task durations, more hints
- Realistic (default): balanced tempo and limited hints
- Expert: strict tempo and no automatic coaching prompts
