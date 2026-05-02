import { getModeConfig } from './modes';
import type {
  ActionOutcome,
  ActionType,
  CreateSimulationEngineOptions,
  DebriefReport,
  SimulationEngine,
  SimulationState,
  TimelineEntry,
  UserAction,
} from './types';
import type {
  ActionEffect,
  CaseActionDefinition,
  CaseDefinitionV2,
  NarrativeBeat,
  RequirementKey,
  SimMode,
} from '../types/case';

interface GateEvaluationResult {
  blocked: boolean;
  blockedMessage?: string;
  softPenaltyTotal: number;
  softMessages: string[];
}

function cloneInitialState(caseDef: CaseDefinitionV2, mode: SimMode): SimulationState {
  return {
    now: 0,
    mode,
    caseId: caseDef.metadata.id,
    outcome: 'in_progress',
    patient: { ...caseDef.initialState.patient },
    environment: { ...caseDef.initialState.environment },
    availableActions: caseDef.actions.filter((action) => !action.hidden),
    activeTasks: [],
    pendingEvents: [],
    narratives: [],
    pendingAcknowledgementId: null,
    penalties: 0,
  };
}

function createDebrief(caseDef: CaseDefinitionV2, mode: SimMode): DebriefReport {
  const metrics = Object.fromEntries(
    Object.keys(caseDef.debriefRules.metricLabels).map((metricKey) => [
      metricKey,
      metricKey === 'algorithmDeviationCount' ? 0 : null,
    ]),
  );

  return {
    caseId: caseDef.metadata.id,
    mode,
    outcome: 'in_progress',
    timeline: [],
    criticalMisses: [],
    goodDecisions: [],
    metrics,
    metricLabels: { ...caseDef.debriefRules.metricLabels },
  };
}

export function createSimulationEngine(options: CreateSimulationEngineOptions): SimulationEngine {
  const { caseDef } = options;
  const mode = options.mode ?? caseDef.defaultMode;
  const modeConfig = getModeConfig(mode);

  const debrief = createDebrief(caseDef, mode);
  const completedActions = new Set<ActionType>();
  const firedNarrativeBeats = new Set<string>();
  const state = cloneInitialState(caseDef, mode);
  let eventSequence = 0;
  let taskSequence = 0;
  let atropineDoseCount = 0;
  let autoHintCount = 0;

  addTimelineEntry({
    at: 0,
    type: 'narrative',
    message: caseDef.initialState.patient.statusText,
  });

  for (const beat of caseDef.narrativeBeats) {
    queueEvent({
      id: `beat-${beat.id}`,
      type: 'narrative_beat',
      at: beat.atSeconds,
      payload: { beatId: beat.id },
    });
  }

  queueEvent({
    id: 'deterioration-check',
    type: 'deterioration_check',
    at: caseDef.outcomes.deteriorateAfterSeconds,
  });

  function nextEventId(prefix: string): string {
    eventSequence += 1;
    return `${prefix}-${eventSequence}`;
  }

  function nextTaskId(actionType: ActionType): string {
    taskSequence += 1;
    return `${actionType}-${taskSequence}`;
  }

  function queueEvent(event: SimulationState['pendingEvents'][number]): void {
    state.pendingEvents.push(event);
    state.pendingEvents.sort((a, b) => {
      if (a.at === b.at) {
        return a.id.localeCompare(b.id);
      }

      return a.at - b.at;
    });
  }

  function addTimelineEntry(entry: TimelineEntry): void {
    debrief.timeline.push(entry);
  }

  function addNarrative(
    at: number,
    message: string,
    priority: 'info' | 'urgent',
    requiresAcknowledgement: boolean,
  ): void {
    const id = `narrative-${nextEventId('item')}`;

    state.narratives = [...state.narratives, { id, at, message, priority, requiresAcknowledgement }].slice(-12);

    addTimelineEntry({
      at,
      type: 'narrative',
      message,
    });

    if (requiresAcknowledgement) {
      state.pendingAcknowledgementId = id;
    }
  }

  function hasVascularAccess(): boolean {
    return state.environment.ivAccess || state.environment.ioAccess;
  }

  function requirementSatisfied(requirement: RequirementKey): boolean {
    switch (requirement) {
      case 'monitorLeadsAttached':
        return state.environment.monitorLeadsAttached;
      case 'defibPadsAttached':
        return state.environment.defibPadsAttached;
      case 'hasVascularAccess':
        return hasVascularAccess();
      case 'syncEnabled':
        return state.environment.syncEnabled;
      case 'pacingModeActive':
        return state.environment.pacingModeActive;
      case 'pacingRateSet':
        return state.environment.pacingRate !== null;
      case 'pacingCurrentSet':
        return state.environment.pacingCurrentMa !== null;
      case 'captureConfirmed':
        return state.environment.captureConfirmed;
      case 'bloodCulturesDrawn':
        return Boolean(state.environment.bloodCulturesDrawn);
      case 'lactateSent':
        return Boolean(state.environment.lactateSent);
      case 'fluidsStarted':
        return Boolean(state.environment.fluidsStarted);
      case 'antibioticsGiven':
        return Boolean(state.environment.antibioticsGiven);
      case 'vasopressorStarted':
        return Boolean(state.environment.vasopressorStarted);
      default:
        return false;
    }
  }

  function markCriticalMiss(message: string): void {
    if (!debrief.criticalMisses.includes(message)) {
      debrief.criticalMisses.push(message);
    }
  }

  function incrementAlgorithmDeviation(): void {
    debrief.metrics.algorithmDeviationCount = (debrief.metrics.algorithmDeviationCount ?? 0) + 1;
  }

  function applyPenalty(at: number, amount: number, message: string, action: ActionType): void {
    if (amount <= 0) {
      return;
    }

    state.penalties += amount;
    incrementAlgorithmDeviation();

    addTimelineEntry({
      at,
      type: 'warning',
      message: `${message} (-${amount})`,
      action,
    });
  }

  function worsenHemodynamics(): void {
    state.patient.systolicBP = Math.max(48, state.patient.systolicBP - 8);
    state.patient.diastolicBP = Math.max(24, state.patient.diastolicBP - 5);
    state.patient.hr = state.patient.rhythm === 'sinus_tachycardia'
      ? Math.min(160, state.patient.hr + 8)
      : Math.max(20, state.patient.hr - 2);
    state.patient.mentalStatus = state.patient.systolicBP < 70 ? 'pain' : 'verbal';
    state.patient.statusText = 'Hemodynamics worsen after unsafe or delayed intervention.';
  }

  function evaluateGates(actionType: ActionType, now: number): GateEvaluationResult {
    const actionGates = caseDef.gates.filter((gate) => gate.action === actionType);
    let softPenaltyTotal = 0;
    const softMessages: string[] = [];

    for (const gate of actionGates) {
      const missingRequirement = gate.requires.some((requirement) => !requirementSatisfied(requirement));
      if (!missingRequirement) {
        continue;
      }

      if (gate.type === 'hard') {
        markCriticalMiss(gate.message);

        addTimelineEntry({
          at: now,
          type: 'critical',
          message: gate.message,
          action: actionType,
        });

        return {
          blocked: true,
          blockedMessage: gate.message,
          softPenaltyTotal: 0,
          softMessages: [],
        };
      }

      softMessages.push(gate.message);
      softPenaltyTotal += gate.penalty ?? 0;

      if (gate.onFailureEffect === 'worsen_hemodynamics') {
        worsenHemodynamics();
      }
    }

    return {
      blocked: false,
      blockedMessage: undefined,
      softPenaltyTotal,
      softMessages,
    };
  }

  function setMetricIfEmpty(metric: string | undefined, value: number): void {
    if (!metric) {
      return;
    }

    if (!(metric in debrief.metrics)) {
      debrief.metrics[metric] = null;
      debrief.metricLabels[metric] = metric;
    }

    if (debrief.metrics[metric] === null) {
      debrief.metrics[metric] = value;
    }
  }

  function maybeRecordGoodDecision(actionType: ActionType): void {
    if (!caseDef.debriefRules.goodDecisionActions.includes(actionType)) {
      return;
    }

    const label = getActionDefinition(actionType)?.label ?? actionType;
    if (!debrief.goodDecisions.includes(label)) {
      debrief.goodDecisions.push(label);
    }
  }

  function startTask(actionDef: CaseActionDefinition, now: number): ActionOutcome {
    const existingTask = state.activeTasks.find((task) => task.action === actionDef.id);
    if (existingTask) {
      return {
        status: 'accepted_with_penalty',
        message: `${actionDef.label} is already in progress.`,
        penaltyDelta: 0,
      };
    }

    if (!actionDef.taskTimingKey) {
      return {
        status: 'hard_blocked',
        message: `Task timing key missing for ${actionDef.id}.`,
      };
    }

    const timing = caseDef.timings[actionDef.taskTimingKey];
    if (!timing) {
      return {
        status: 'hard_blocked',
        message: `Task timing missing for ${actionDef.taskTimingKey}.`,
      };
    }

    const baseDuration = timing[mode];
    const duration = Math.max(1, Math.round(baseDuration * modeConfig.timingMultiplier));
    const taskId = nextTaskId(actionDef.id);

    state.activeTasks.push({
      id: taskId,
      action: actionDef.id,
      label: actionDef.label,
      startedAt: now,
      endsAt: now + duration,
    });

    queueEvent({
      id: nextEventId('task-complete'),
      type: 'task_complete',
      at: now + duration,
      payload: { action: actionDef.id },
    });

    addTimelineEntry({
      at: now,
      type: 'action',
      message: `${actionDef.label} started.`,
      action: actionDef.id,
    });

    return {
      status: 'task_started',
      message: `${actionDef.label} started (${duration}s).`,
      startedTaskId: taskId,
    };
  }

  function applyCompletionEffect(effect: ActionEffect | undefined, actionDef: CaseActionDefinition, at: number): void {
    switch (effect) {
      case 'transfer_to_bed_complete':
        state.environment.onBed = true;
        break;
      case 'ems_handoff_complete':
        addNarrative(at, 'EMS: Recent details added to the working problem representation.', 'info', false);
        break;
      case 'attach_monitor_leads_complete':
        state.environment.monitorLeadsAttached = true;
        break;
      case 'attach_defib_pads_complete':
        state.environment.defibPadsAttached = true;
        addNarrative(at, 'Pads are on. Electrical therapy hardware is ready.', 'info', false);
        break;
      case 'start_oxygen_complete':
        state.environment.oxygenOn = true;
        state.patient.spo2 = Math.min(99, state.patient.spo2 + 3);
        break;
      case 'establish_iv_complete':
        state.environment.ivAccess = true;
        break;
      case 'establish_io_complete':
        state.environment.ioAccess = true;
        break;
      case 'place_arterial_line_complete':
        state.environment.arterialLine = true;
        break;
      case 'attach_capnography_complete':
        state.environment.capnography = true;
        state.patient.etco2 = state.patient.etco2 ?? 34;
        break;
      case 'send_lactate_complete':
        state.environment.lactateSent = true;
        state.patient.lactate = state.patient.lactate ?? 5.4;
        addNarrative(at, 'Lab: Lactate returns elevated at 5.4 mmol/L.', 'urgent', false);
        break;
      case 'draw_blood_cultures_complete':
        state.environment.bloodCulturesDrawn = true;
        break;
      default:
        break;
    }

    setMetricIfEmpty(actionDef.metricKey, at);
  }

  function processTaskCompletion(actionType: ActionType, at: number): void {
    const actionDef = getActionDefinition(actionType);
    state.activeTasks = state.activeTasks.filter((task) => task.action !== actionType);

    if (!actionDef) {
      return;
    }

    applyCompletionEffect(actionDef.completionEffect ?? actionDef.effect, actionDef, at);
    completedActions.add(actionType);
    maybeRecordGoodDecision(actionType);

    addTimelineEntry({
      at,
      type: 'result',
      message: `${actionDef.label} complete.`,
      action: actionType,
    });

    maybeFinalizeOutcome(at);
  }

  function meetsNarrativeCondition(beat: NarrativeBeat): boolean {
    switch (beat.condition) {
      case 'ifNoPads':
        return !state.environment.defibPadsAttached;
      case 'ifNoAccess':
        return !hasVascularAccess();
      case 'ifNoPacingSetup':
        return !(
          state.environment.pacingModeActive &&
          state.environment.pacingRate === 70 &&
          (state.environment.pacingCurrentMa ?? 0) >= 70
        );
      case 'ifNoCapture':
        return !state.environment.captureConfirmed;
      case 'ifNoFluids':
        return !state.environment.fluidsStarted;
      case 'ifNoAntibiotics':
        return !state.environment.antibioticsGiven;
      case 'ifNoVasopressor':
        return state.patient.systolicBP < 90 && !state.environment.vasopressorStarted;
      case 'ifShockUnresolved':
        return state.patient.systolicBP < 90 || state.patient.mentalStatus !== 'alert';
      default:
        return true;
    }
  }

  function triggerDeterioration(now: number, message: string): void {
    if (state.outcome !== 'in_progress') {
      return;
    }

    state.outcome = 'deteriorated';
    debrief.outcome = 'deteriorated';
    state.patient.systolicBP = Math.max(48, state.patient.systolicBP - 20);
    state.patient.diastolicBP = Math.max(24, state.patient.diastolicBP - 10);
    state.patient.hr = state.patient.rhythm === 'sinus_tachycardia' ? 148 : 22;
    state.patient.mentalStatus = 'unresponsive';
    state.patient.statusText = 'Patient has deteriorated toward peri-arrest physiology.';

    addTimelineEntry({
      at: now,
      type: 'critical',
      message,
    });

    addNarrative(now, 'Team: Hemodynamics are collapsing. Immediate escalation needed.', 'urgent', true);
  }

  function bradycardiaStabilized(): boolean {
    return state.environment.captureConfirmed && state.patient.rhythm === 'paced' && state.patient.systolicBP >= 90;
  }

  function septicShockStabilized(): boolean {
    return Boolean(
      state.environment.fluidsStarted &&
        (state.environment.fluidBolusMl ?? 0) >= 2000 &&
        state.environment.antibioticsGiven &&
        state.environment.vasopressorStarted &&
        state.environment.perfusionReassessed &&
        state.patient.systolicBP >= 90,
    );
  }

  function maybeFinalizeOutcome(now: number): void {
    if (state.outcome !== 'in_progress') {
      return;
    }

    const stabilized = caseDef.metadata.id.includes('septic-shock')
      ? septicShockStabilized()
      : bradycardiaStabilized();

    if (stabilized) {
      state.outcome = 'stabilized';
      debrief.outcome = 'stabilized';

      addTimelineEntry({
        at: now,
        type: 'result',
        message: caseDef.metadata.id.includes('septic-shock')
          ? 'Shock physiology is improving after fluids, antibiotics, vasopressor support, and reassessment.'
          : 'Patient stabilized with confirmed mechanical capture.',
      });

      return;
    }

    if (state.penalties >= caseDef.outcomes.maxPenaltyBeforeDeterioration) {
      triggerDeterioration(now, 'Patient deteriorated due to repeated unsafe actions.');
    }
  }

  function applyAtropine(now: number, actionType: ActionType): ActionOutcome {
    atropineDoseCount += 1;

    if (atropineDoseCount === 1) {
      state.patient.hr = 42;
      state.patient.systolicBP = 82;
      state.patient.diastolicBP = 52;
      state.patient.statusText = 'Minimal response to atropine. Patient remains unstable.';

      addNarrative(
        now,
        'Nurse: Slight heart rate bump, but BP is still low. We should prepare to pace.',
        'urgent',
        true,
      );
    } else {
      state.patient.hr = Math.min(46, state.patient.hr + 2);
      state.patient.statusText = 'Additional atropine gives limited benefit. Escalation still required.';

      addNarrative(now, 'Nurse: Repeat atropine had limited effect. Pacing remains priority.', 'info', false);
    }

    addTimelineEntry({
      at: now,
      type: 'action',
      message: 'Atropine administered.',
      action: actionType,
    });

    return {
      status: 'state_changed',
      message: 'Atropine administered. Minimal hemodynamic improvement.',
    };
  }

  function applySepsisEffect(effect: ActionEffect, now: number, actionType: ActionType): ActionOutcome {
    switch (effect) {
      case 'give_fluid_bolus': {
        state.environment.fluidsStarted = true;
        state.environment.fluidBolusMl = (state.environment.fluidBolusMl ?? 0) + 1000;
        state.patient.systolicBP = Math.min(92, state.patient.systolicBP + 12);
        state.patient.diastolicBP = Math.min(56, state.patient.diastolicBP + 6);
        state.patient.hr = Math.max(112, state.patient.hr - 8);
        state.patient.statusText = `${state.environment.fluidBolusMl} mL crystalloid in. Perfusion is only partially improved.`;
        addNarrative(now, 'RN: Pressure is a little better after the bolus, but still marginal.', 'info', false);
        addTimelineEntry({ at: now, type: 'action', message: 'Crystalloid bolus started.', action: actionType });
        return { status: 'state_changed', message: 'Fluid bolus started. Reassess perfusion and pressure.' };
      }

      case 'give_antibiotics':
        state.environment.antibioticsGiven = true;
        state.patient.temperatureC = state.patient.temperatureC ? Math.max(38.3, state.patient.temperatureC - 0.2) : undefined;
        state.patient.statusText = 'Broad-spectrum antibiotics are running; shock physiology still needs reassessment.';
        addTimelineEntry({ at: now, type: 'action', message: 'Broad-spectrum antibiotics started.', action: actionType });
        return { status: 'state_changed', message: 'Antibiotics started.' };

      case 'start_norepinephrine':
        state.environment.vasopressorStarted = true;
        state.patient.systolicBP = Math.max(96, state.patient.systolicBP + 18);
        state.patient.diastolicBP = Math.max(58, state.patient.diastolicBP + 10);
        state.patient.hr = Math.max(104, state.patient.hr - 6);
        state.patient.mentalStatus = 'verbal';
        state.patient.statusText = 'Norepinephrine is improving MAP while definitive care continues.';
        addNarrative(now, 'RN: Norepinephrine is running peripherally while central access is prepared.', 'info', false);
        addTimelineEntry({ at: now, type: 'action', message: 'Norepinephrine started.', action: actionType });
        return { status: 'state_changed', message: 'Norepinephrine started. MAP improving.' };

      case 'reassess_perfusion':
        state.environment.perfusionReassessed = true;
        state.patient.mentalStatus = state.patient.systolicBP >= 90 ? 'alert' : 'verbal';
        state.patient.statusText = state.patient.systolicBP >= 90
          ? 'Perfusion reassessment shows improving mentation and pressure.'
          : 'Perfusion reassessment shows persistent shock.';
        addTimelineEntry({ at: now, type: 'result', message: 'Perfusion reassessed.', action: actionType });
        maybeFinalizeOutcome(now);
        return { status: 'state_changed', message: 'Perfusion reassessed.' };

      case 'call_icu':
        state.environment.icuCalled = true;
        addNarrative(now, 'ICU: We are preparing a bed; keep resuscitation moving.', 'info', false);
        addTimelineEntry({ at: now, type: 'action', message: 'ICU consulted for septic shock admission.', action: actionType });
        return { status: 'state_changed', message: 'ICU consulted.' };

      default:
        return { status: 'accepted', message: 'Action accepted.' };
    }
  }

  function applyInstantAction(actionDef: CaseActionDefinition, now: number): ActionOutcome {
    const actionType = actionDef.id;
    const effect = actionDef.effect;
    setMetricIfEmpty(actionDef.metricKey, now);

    switch (effect) {
      case 'give_atropine':
        return applyAtropine(now, actionType);

      case 'enable_sync':
        state.environment.syncEnabled = true;
        addTimelineEntry({ at: now, type: 'action', message: 'Sync mode enabled.', action: actionType });
        return { status: 'state_changed', message: 'Sync mode enabled.' };

      case 'disable_sync':
        state.environment.syncEnabled = false;
        addTimelineEntry({ at: now, type: 'action', message: 'Sync mode disabled.', action: actionType });
        return { status: 'state_changed', message: 'Sync mode disabled.' };

      case 'set_cardioversion_energy_100':
        state.environment.cardioversionEnergyJ = 100;
        addTimelineEntry({ at: now, type: 'action', message: 'Cardioversion energy set to 100J.', action: actionType });
        return { status: 'state_changed', message: 'Energy set to 100J.' };

      case 'deliver_cardioversion':
        state.patient.hr = Math.max(24, state.patient.hr - 5);
        state.patient.systolicBP = Math.max(52, state.patient.systolicBP - 10);
        state.patient.diastolicBP = Math.max(28, state.patient.diastolicBP - 6);
        state.patient.mentalStatus = 'pain';
        state.patient.statusText = 'Cardioversion was inappropriate for this bradycardia scenario.';
        addTimelineEntry({ at: now, type: 'warning', message: 'Cardioversion delivered in bradycardia with pulse.', action: actionType });
        addNarrative(now, 'Team: This rhythm needed pacing support, not cardioversion.', 'urgent', false);
        return {
          status: 'accepted_with_penalty',
          message: 'Cardioversion was inappropriate and worsened hemodynamics.',
          penaltyDelta: 0,
        };

      case 'start_pacing_mode':
        state.environment.pacingModeActive = true;
        addTimelineEntry({ at: now, type: 'action', message: 'Pacing mode activated.', action: actionType });
        return { status: 'state_changed', message: 'Pacing mode active. Set rate and current.' };

      case 'set_pacing_rate_70':
        state.environment.pacingRate = 70;
        addTimelineEntry({ at: now, type: 'action', message: 'Pacing rate set to 70 bpm.', action: actionType });
        return { status: 'state_changed', message: 'Pacing rate configured at 70 bpm.' };

      case 'set_pacing_current_40':
        state.environment.pacingCurrentMa = 40;
        addTimelineEntry({ at: now, type: 'warning', message: 'Current set to 40 mA. Capture unlikely.', action: actionType });
        applyPenalty(now, 3, 'Pacing current too low for likely capture in this patient.', actionType);
        return {
          status: 'accepted_with_penalty',
          message: '40 mA selected. Capture may fail.',
          penaltyDelta: 3,
        };

      case 'set_pacing_current_70':
        state.environment.pacingCurrentMa = 70;
        addTimelineEntry({ at: now, type: 'action', message: 'Pacing current set to 70 mA.', action: actionType });
        return { status: 'state_changed', message: 'Pacing current configured at 70 mA.' };

      case 'confirm_capture': {
        const hasExpectedSetup = state.environment.pacingRate === 70 && (state.environment.pacingCurrentMa ?? 0) >= 70;

        if (!hasExpectedSetup) {
          markCriticalMiss('Capture was checked without adequate pacing settings.');
          applyPenalty(now, 4, 'Capture confirmation attempted before adequate pacer settings.', actionType);

          return {
            status: 'accepted_with_penalty',
            message: 'No reliable mechanical capture at current settings.',
            penaltyDelta: 4,
          };
        }

        state.environment.captureConfirmed = true;
        state.patient.rhythm = 'paced';
        state.patient.hr = 70;
        state.patient.systolicBP = 102;
        state.patient.diastolicBP = 62;
        state.patient.mentalStatus = 'alert';
        state.patient.statusText = 'Pacing capture confirmed. Perfusion improves and symptoms ease.';
        addTimelineEntry({ at: now, type: 'result', message: 'Mechanical capture confirmed with pacing at 70/70.', action: actionType });
        addNarrative(now, 'Nurse: Strong pulse now. Blood pressure is recovering. Capture confirmed.', 'info', true);
        maybeFinalizeOutcome(now);
        return { status: 'state_changed', message: 'Mechanical capture confirmed. Patient stabilizing.' };
      }

      case 'give_fluid_bolus':
      case 'give_antibiotics':
      case 'start_norepinephrine':
      case 'reassess_perfusion':
      case 'call_icu':
        return applySepsisEffect(effect, now, actionType);

      default:
        addTimelineEntry({ at: now, type: 'action', message: `${actionDef.label} completed.`, action: actionType });
        return { status: 'accepted', message: `${actionDef.label} completed.` };
    }
  }

  function processEvent(event: SimulationState['pendingEvents'][number]): void {
    switch (event.type) {
      case 'task_complete': {
        const action = event.payload?.action;
        if (action) {
          processTaskCompletion(action, event.at);
        }
        break;
      }

      case 'narrative_beat': {
        const beatId = event.payload?.beatId;
        if (!beatId || firedNarrativeBeats.has(beatId) || autoHintCount >= modeConfig.maxAutoHints) {
          break;
        }

        const beat = caseDef.narrativeBeats.find((item) => item.id === beatId);
        if (!beat) {
          break;
        }

        if (!meetsNarrativeCondition(beat)) {
          firedNarrativeBeats.add(beat.id);
          break;
        }

        if (state.pendingAcknowledgementId) {
          queueEvent({
            id: nextEventId('deferred-beat'),
            type: 'narrative_beat',
            at: state.now + modeConfig.hintIntervalSeconds,
            payload: { beatId: beat.id },
          });
          break;
        }

        addNarrative(event.at, beat.message, beat.priority, Boolean(beat.requiresAcknowledgement));
        autoHintCount += 1;
        firedNarrativeBeats.add(beat.id);
        break;
      }

      case 'deterioration_check':
        if (state.outcome === 'in_progress') {
          triggerDeterioration(event.at, 'Case time limit reached before stabilization.');
        }
        break;

      default:
        break;
    }
  }

  function finalizeDebriefCriticalMisses(): void {
    for (const actionType of caseDef.debriefRules.criticalActions) {
      if (!completedActions.has(actionType)) {
        const actionDef = caseDef.actions.find((action) => action.id === actionType);
        const label = actionDef?.label ?? actionType;
        markCriticalMiss(`Critical action missed: ${label}`);
      }
    }

    if (caseDef.gates.some((gate) => gate.requires.includes('hasVascularAccess')) && !hasVascularAccess()) {
      markCriticalMiss('No vascular access was established.');
    }
  }

  function acknowledgeNarrative(now: number): ActionOutcome {
    const pendingId = state.pendingAcknowledgementId;
    if (!pendingId) {
      return {
        status: 'accepted',
        message: 'No pending narrative to acknowledge.',
      };
    }

    state.pendingAcknowledgementId = null;
    addTimelineEntry({ at: now, type: 'action', message: 'Narrative acknowledged.', action: 'acknowledge_narrative' });

    return {
      status: 'accepted',
      message: 'Narrative acknowledged.',
    };
  }

  function getActionDefinition(actionType: ActionType): CaseActionDefinition | undefined {
    return caseDef.actions.find((action) => action.id === actionType);
  }

  function tick(toTime: number): void {
    if (toTime < state.now) {
      throw new Error(`tick cannot go backward: current=${state.now}, requested=${toTime}`);
    }

    while (state.pendingEvents.length > 0 && state.pendingEvents[0].at <= toTime) {
      const event = state.pendingEvents.shift();
      if (!event) {
        break;
      }

      state.now = event.at;
      processEvent(event);
      maybeFinalizeOutcome(event.at);
    }

    state.now = toTime;
  }

  function dispatch(action: UserAction, now: number): ActionOutcome {
    tick(now);

    if (action.type === 'acknowledge_narrative') {
      return acknowledgeNarrative(now);
    }

    if (state.outcome !== 'in_progress') {
      return {
        status: 'hard_blocked',
        message: 'Case is complete. Start a new run to continue.',
      };
    }

    const actionDef = getActionDefinition(action.type);
    if (!actionDef) {
      return {
        status: 'hard_blocked',
        message: `Unknown action: ${action.type}`,
      };
    }

    const gateResult = evaluateGates(action.type, now);
    if (gateResult.blocked) {
      return {
        status: 'hard_blocked',
        message: `Blocked: ${gateResult.blockedMessage ?? 'requirements not met'}`,
      };
    }

    let outcome = actionDef.kind === 'task' ? startTask(actionDef, now) : applyInstantAction(actionDef, now);

    if (outcome.status !== 'hard_blocked') {
      completedActions.add(action.type);
      maybeRecordGoodDecision(action.type);
    }

    if (gateResult.softMessages.length > 0) {
      for (const softMessage of gateResult.softMessages) {
        markCriticalMiss(softMessage);
      }

      applyPenalty(now, gateResult.softPenaltyTotal, gateResult.softMessages.join(' | '), action.type);
    }

    if (gateResult.softPenaltyTotal > 0 && outcome.status !== 'hard_blocked') {
      outcome = {
        ...outcome,
        status: 'accepted_with_penalty',
        penaltyDelta: (outcome.penaltyDelta ?? 0) + gateResult.softPenaltyTotal,
      };
    }

    maybeFinalizeOutcome(now);
    return outcome;
  }

  function getState(): SimulationState {
    return {
      ...state,
      patient: { ...state.patient },
      environment: { ...state.environment },
      availableActions: [...state.availableActions],
      activeTasks: state.activeTasks.map((task) => ({ ...task })),
      pendingEvents: state.pendingEvents.map((event) => ({
        ...event,
        payload: event.payload ? { ...event.payload } : undefined,
      })),
      narratives: state.narratives.map((item) => ({ ...item })),
    };
  }

  function getDebrief(): DebriefReport {
    if (state.outcome !== 'in_progress') {
      finalizeDebriefCriticalMisses();
    }

    return {
      ...debrief,
      timeline: debrief.timeline.map((entry) => ({ ...entry })),
      criticalMisses: [...debrief.criticalMisses],
      goodDecisions: [...debrief.goodDecisions],
      metrics: { ...debrief.metrics },
      metricLabels: { ...debrief.metricLabels },
    };
  }

  return {
    dispatch,
    tick,
    getState,
    getDebrief,
  };
}
