# ACLS Sim v2 Design Language

Primary reference mockup: `docs/design/acls-sim-v2-ui-mockup-v2.png`

Earlier exploration: `docs/design/acls-sim-v2-ui-mockup.png`

## Product Feel

ACLS Sim v2 should feel like a clinical resuscitation cockpit: focused, credible, time-aware, and dense enough for repeated practice. The interface should help the learner lead a case without turning the experience into a trivia prompt or a game board.

The monitor is the visual anchor. Everything else should feel like the surrounding command surface: clear, compact, and optimized for quick scanning under pressure.

## Layout Model

- Top command bar: case identity, mode selector, simulation time, pause, time advance, restart, and compact utility controls.
- Left primary zone: live ED monitor with waveforms, numeric vitals, and device/readiness status.
- Center workflow zone: active tasks, time remaining, team updates, and acknowledgement flow.
- Right command zone: critical actions first, then setup, airway, meds, and team actions behind compact tabs.
- Bottom context zone: patient identity, rhythm/scenario summary, and quiet debrief preview.

The app should avoid a marketing-page shape. The first screen is the simulator.

## Visual System

- Background: warm clinical off-white with subtle cool gray panel boundaries.
- Monitor: near-black green-tinted surface with grid lines, glowing waveforms, and tabular numeric vitals.
- Accents:
  - Green: active/ready, ECG, completion.
  - Cyan/teal: primary command emphasis and selected state.
  - Red: unstable vitals, danger, symptomatic state.
  - Amber: pending, caution, capture not confirmed.
- Borders: crisp 1px lines with restrained shadows.
- Radius: 6-8px for panels and buttons.
- Typography: compact sans for UI; tabular/mono treatment for times, vitals, and waveform labels.

Avoid decorative gradients, oversized cards, rounded pill-heavy SaaS styling, and single-hue palettes.

## Components

- Action buttons should be grouped by workflow: Assessment, Monitoring, Access, Airway, Electrical, Medication, Communication.
- The primary command surface should default to the most time-sensitive category for the case, such as `Critical`.
- Major actions should be visually stronger but not cartoonish.
- Gated actions should remain visible with concise prerequisite text, such as `requires pads` or `requires IV/IO`.
- Blocked/gated actions should include inline prerequisite chips or status indicators so users understand why the action is unavailable.
- Readiness chips should show real prerequisites: Leads, Pads, Sync, Pacer, Capture.
- Active tasks should use progress bars and role/source labels where useful.
- Narrative updates should stay short, timestamped, and scannable.
- Patient state should use compact alert chips rather than long explanatory text.
- In-case debrief/adherence UI should stay quiet. Avoid making active play feel like a score chase.

## Implementation Target

The current app already has the right conceptual panels. The next UI pass should mostly reshape the existing components into this structure:

- `MonitorPanel`: become the visual anchor with richer status chips and tighter numeric vitals.
- `ActionsPanel`: move to a tabbed command-panel layout with critical actions first, icon-led grouped buttons, and gated microcopy.
- `TaskQueuePanel`: add task progress bars and assigned-role metadata.
- `NarrativePanel`: tighten timestamps, priority styling, and acknowledgement handling.
- `App`: replace the current broad header and grid with the cockpit layout shown in the mockup.
