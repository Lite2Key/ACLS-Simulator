import { describe, expect, it } from 'vitest';
import { CASES, DEFAULT_CASE } from '../src/cases';
import { createSimulationEngine } from '../src/engine';
import type { ActionType } from '../src/engine';

const SEPTIC_SHOCK_CASE = CASES.find((caseDef) => caseDef.metadata.id === 'septic-shock-v1');

function runDeterministicScenario() {
  const engine = createSimulationEngine({
    caseDef: DEFAULT_CASE,
    mode: 'realistic',
  });

  const timeline: Array<{ action: ActionType; at: number }> = [
    { action: 'start_transfer_to_bed', at: 0 },
    { action: 'start_ems_handoff', at: 0 },
    { action: 'attach_monitor_leads', at: 0 },
    { action: 'attach_defib_pads', at: 0 },
    { action: 'start_oxygen', at: 0 },
    { action: 'establish_iv', at: 0 },
    { action: 'give_atropine', at: 35 },
    { action: 'start_pacing_mode', at: 36 },
    { action: 'set_pacing_rate_70', at: 37 },
    { action: 'set_pacing_current_70', at: 38 },
    { action: 'confirm_capture', at: 39 },
  ];

  for (const step of timeline) {
    engine.dispatch({ type: step.action }, step.at);
  }

  return {
    state: engine.getState(),
    debrief: engine.getDebrief(),
  };
}

describe('simulation engine', () => {
  it('blocks pacing mode when pads are not attached', () => {
    const engine = createSimulationEngine({ caseDef: DEFAULT_CASE, mode: 'realistic' });
    const outcome = engine.dispatch({ type: 'start_pacing_mode' }, 0);

    expect(outcome.status).toBe('hard_blocked');
    expect(outcome.message).toContain('Attach defibrillator pads');
  });

  it('blocks atropine before IV or IO access', () => {
    const engine = createSimulationEngine({ caseDef: DEFAULT_CASE, mode: 'realistic' });
    const outcome = engine.dispatch({ type: 'give_atropine' }, 0);

    expect(outcome.status).toBe('hard_blocked');
    expect(outcome.message).toContain('vascular access');
  });

  it('applies soft penalty for cardioversion without sync', () => {
    const engine = createSimulationEngine({ caseDef: DEFAULT_CASE, mode: 'realistic' });

    const outcome = engine.dispatch({ type: 'deliver_cardioversion' }, 10);
    const debrief = engine.getDebrief();

    expect(outcome.status).toBe('accepted_with_penalty');
    expect(debrief.metrics.algorithmDeviationCount).toBeGreaterThan(0);
  });

  it('supports parallel tasks and completes them by tick progression', () => {
    const engine = createSimulationEngine({ caseDef: DEFAULT_CASE, mode: 'realistic' });

    engine.dispatch({ type: 'attach_monitor_leads' }, 0);
    engine.dispatch({ type: 'establish_iv' }, 0);
    engine.tick(40);

    const state = engine.getState();
    expect(state.environment.monitorLeadsAttached).toBe(true);
    expect(state.environment.ivAccess).toBe(true);
    expect(state.activeTasks).toHaveLength(0);
  });

  it('activates invasive and capnography monitor channels after setup tasks complete', () => {
    const engine = createSimulationEngine({ caseDef: DEFAULT_CASE, mode: 'realistic' });

    engine.dispatch({ type: 'place_arterial_line' }, 0);
    engine.dispatch({ type: 'attach_capnography' }, 0);
    engine.tick(60);

    const state = engine.getState();
    expect(state.environment.arterialLine).toBe(true);
    expect(state.environment.capnography).toBe(true);
    expect(state.patient.etco2).toBe(34);
  });

  it('is deterministic for identical action/time sequences', () => {
    const runA = runDeterministicScenario();
    const runB = runDeterministicScenario();

    expect(runA.state).toEqual(runB.state);
    expect(runA.debrief).toEqual(runB.debrief);
  });

  it('reaches stabilized outcome on correct pacing sequence and records debrief metrics', () => {
    const engine = createSimulationEngine({ caseDef: DEFAULT_CASE, mode: 'realistic' });

    engine.dispatch({ type: 'attach_defib_pads' }, 0);
    engine.dispatch({ type: 'establish_iv' }, 0);
    engine.tick(35);

    engine.dispatch({ type: 'give_atropine' }, 35);
    engine.dispatch({ type: 'start_pacing_mode' }, 36);
    engine.dispatch({ type: 'set_pacing_rate_70' }, 37);
    engine.dispatch({ type: 'set_pacing_current_70' }, 38);
    engine.dispatch({ type: 'confirm_capture' }, 39);

    const state = engine.getState();
    const debrief = engine.getDebrief();

    expect(state.outcome).toBe('stabilized');
    expect(debrief.metrics.timeToPads).not.toBeNull();
    expect(debrief.metrics.timeToPacingInitiation).not.toBeNull();
    expect(debrief.metrics.timeToCapture).not.toBeNull();
  });

  it('limits automatic narrative beats to avoid prompt spam', () => {
    const engine = createSimulationEngine({ caseDef: DEFAULT_CASE, mode: 'instructor' });

    engine.tick(400);
    const state = engine.getState();

    expect(state.narratives).toHaveLength(0);
  });

  it('loads the septic shock case and reaches stabilized outcome after resuscitation sequence', () => {
    expect(SEPTIC_SHOCK_CASE).toBeDefined();
    const engine = createSimulationEngine({ caseDef: SEPTIC_SHOCK_CASE!, mode: 'realistic' });

    engine.dispatch({ type: 'start_transfer_to_bed' }, 0);
    engine.dispatch({ type: 'attach_monitor_leads' }, 0);
    engine.dispatch({ type: 'establish_iv' }, 0);
    engine.tick(35);

    engine.dispatch({ type: 'send_lactate' }, 35);
    engine.dispatch({ type: 'draw_blood_cultures' }, 35);
    engine.tick(70);

    engine.dispatch({ type: 'give_fluid_bolus' }, 70);
    engine.dispatch({ type: 'give_fluid_bolus' }, 71);
    engine.dispatch({ type: 'give_antibiotics' }, 72);
    engine.dispatch({ type: 'start_norepinephrine' }, 73);
    engine.dispatch({ type: 'reassess_perfusion' }, 74);

    const state = engine.getState();
    const debrief = engine.getDebrief();

    expect(state.outcome).toBe('stabilized');
    expect(state.environment.fluidBolusMl).toBe(2000);
    expect(debrief.metrics.timeToAntibiotics).toBe(72);
    expect(debrief.metrics.timeToVasopressor).toBe(73);
  });

  it('deteriorates septic shock when initial stabilization is missed', () => {
    expect(SEPTIC_SHOCK_CASE).toBeDefined();
    const engine = createSimulationEngine({ caseDef: SEPTIC_SHOCK_CASE!, mode: 'realistic' });

    engine.tick(800);

    expect(engine.getState().outcome).toBe('deteriorated');
  });

  it('keeps expert septic shock play free of automatic coaching prompts', () => {
    expect(SEPTIC_SHOCK_CASE).toBeDefined();
    const engine = createSimulationEngine({ caseDef: SEPTIC_SHOCK_CASE!, mode: 'instructor' });

    engine.tick(500);

    expect(engine.getState().narratives).toHaveLength(0);
  });
});
