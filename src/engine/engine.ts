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

type NullableMetricKey =
  | 'timeToMonitor'
  | 'timeToPads'
  | 'timeToPacingInitiation'
  | 'timeToCapture';

const TASK_START_MESSAGES: Record<ActionType, string> = {
  start_transfer_to_bed: 'Team starts transferring the patient from stretcher to bed.',
  start_ems_handoff: 'EMS handoff starts. Team receives prehospital details.',
  attach_monitor_leads: 'Monitor leads are being attached.',
  attach_defib_pads: 'Defibrillator pads are being applied.',
  start_oxygen: 'Oxygen setup started.',
  establish_iv: 'IV placement attempt is in progress.',
  establish_io: 'IO placement attempt is in progress.',
  give_atropine: 'Atropine requested.',
  toggle_sync_on: 'Sync mode enabled.',
  toggle_sync_off: 'Sync mode disabled.',
  set_cardioversion_energy_100: 'Cardioversion energy set to 100J.',
  deliver_cardioversion: 'Cardioversion delivered.',
  start_pacing_mode: 'Pacing mode enabled.',
  set_pacing_rate_70: 'Pacing rate set to 70 bpm.',
  set_pacing_current_40: 'Pacing current set to 40 mA.',
  set_pacing_current_70: 'Pacing current set to 70 mA.',
  confirm_capture: 'Capture check requested.',
  acknowledge_narrative: 'Narrative acknowledged.',
};

const TASK_COMPLETE_MESSAGES: Partial<Record<ActionType, string>> = {
  start_transfer_to_bed: 'Patient transferred to ED bed.',
  start_ems_handoff: 'EMS handoff complete: new beta-blocker started one week ago.',
  attach_monitor_leads: 'Leads attached. Rhythm visible as sinus bradycardia.',
  attach_defib_pads: 'Pads attached. Electrical therapy is now available.',
  start_oxygen: 'Supplemental oxygen applied.',
  establish_iv: 'IV access established.',
  establish_io: 'IO access established.',
};

const TASK_ACTIONS = new Set<ActionType>([
  'start_transfer_to_bed',
  'start_ems_handoff',
  'attach_monitor_leads',
  'attach_defib_pads',
  'start_oxygen',
  'establish_iv',
  'establish_io',
]);

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
  return {
    caseId: caseDef.metadata.id,
    mode,
    outcome: 'in_progress',
    timeline: [],
    criticalMisses: [],
    goodDecisions: [],
    metrics: {
      timeToMonitor: null,
      timeToPads: null,
      timeToPacingInitiation: null,
      timeToCapture: null,
      algorithmDeviationCount: 0,
    },
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
      default:
        return false;
    }
  }

  function markCriticalMiss(message: string): void {
    if (!debrief.criticalMisses.includes(message)) {
      debrief.criticalMisses.push(message);
    }
  }

  function applyPenalty(at: number, amount: number, message: string, action: ActionType): void {
    if (amount <= 0) {
      return;
    }

    state.penalties += amount;
    debrief.metrics.algorithmDeviationCount += 1;

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
    state.patient.hr = Math.max(20, state.patient.hr - 2);
    state.patient.mentalStatus = state.patient.systolicBP < 70 ? 'pain' : 'verbal';
    state.patient.statusText = 'Hemodynamics worsen after unsafe intervention.';
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

  function setMetricIfEmpty(metric: NullableMetricKey, value: number): void {
    if (debrief.metrics[metric] === null) {
      debrief.metrics[metric] = value;
    }
  }

  function maybeRecordGoodDecision(actionType: ActionType): void {
    if (
      caseDef.debriefRules.goodDecisionActions.includes(actionType) &&
      !debrief.goodDecisions.includes(actionType)
    ) {
      debrief.goodDecisions.push(actionType);
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

    const baseDuration = caseDef.timings[actionDef.taskTimingKey][mode];
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
      message: TASK_START_MESSAGES[actionDef.id],
      action: actionDef.id,
    });

    return {
      status: 'task_started',
      message: `${actionDef.label} started (${duration}s).`,
      startedTaskId: taskId,
    };
  }

  function processTaskCompletion(actionType: ActionType, at: number): void {
    state.activeTasks = state.activeTasks.filter((task) => task.action !== actionType);

    switch (actionType) {
      case 'start_transfer_to_bed':
        state.environment.onBed = true;
        break;
      case 'attach_monitor_leads':
        state.environment.monitorLeadsAttached = true;
        setMetricIfEmpty('timeToMonitor', at);
        break;
      case 'attach_defib_pads':
        state.environment.defibPadsAttached = true;
        setMetricIfEmpty('timeToPads', at);
        break;
      case 'start_oxygen':
        state.environment.oxygenOn = true;
        state.patient.spo2 = Math.min(99, state.patient.spo2 + 3);
        break;
      case 'establish_iv':
        state.environment.ivAccess = true;
        break;
      case 'establish_io':
        state.environment.ioAccess = true;
        break;
      case 'start_ems_handoff':
      default:
        break;
    }

    completedActions.add(actionType);
    maybeRecordGoodDecision(actionType);

    const completionMessage = TASK_COMPLETE_MESSAGES[actionType] ?? `${actionType} completed.`;
    addTimelineEntry({
      at,
      type: 'result',
      message: completionMessage,
      action: actionType,
    });

    if (actionType === 'start_ems_handoff') {
      addNarrative(at, 'EMS: New metoprolol started one week ago.', 'info', false);
    }

    if (actionType === 'attach_defib_pads') {
      addNarrative(at, 'Pads are on. Pacing and cardioversion hardware is ready.', 'info', false);
    }

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
    state.patient.hr = 22;
    state.patient.systolicBP = 58;
    state.patient.diastolicBP = 30;
    state.patient.mentalStatus = 'unresponsive';
    state.patient.statusText = 'Patient has deteriorated toward peri-arrest state.';

    addTimelineEntry({
      at: now,
      type: 'critical',
      message,
    });

    addNarrative(now, 'Team: Hemodynamics are collapsing. Immediate escalation needed.', 'urgent', true);
  }

  function maybeFinalizeOutcome(now: number): void {
    if (state.outcome !== 'in_progress') {
      return;
    }

    const stabilized =
      state.environment.captureConfirmed && state.patient.rhythm === 'paced' && state.patient.systolicBP >= 90;

    if (stabilized) {
      state.outcome = 'stabilized';
      debrief.outcome = 'stabilized';

      addTimelineEntry({
        at: now,
        type: 'result',
        message: 'Patient stabilized with confirmed mechanical capture.',
      });

      return;
    }

    if (state.penalties >= caseDef.outcomes.maxPenaltyBeforeDeterioration) {
      triggerDeterioration(now, 'Patient deteriorated due to repeated unsafe actions.');
    }
  }

  function applyInstantAction(actionType: ActionType, now: number): ActionOutcome {
    switch (actionType) {
      case 'give_atropine': {
        atropineDoseCount += 1;
        completedActions.add(actionType);
        maybeRecordGoodDecision(actionType);

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

      case 'toggle_sync_on':
        state.environment.syncEnabled = true;
        addTimelineEntry({ at: now, type: 'action', message: 'Sync mode enabled.', action: actionType });
        return { status: 'state_changed', message: 'Sync mode enabled.' };

      case 'toggle_sync_off':
        state.environment.syncEnabled = false;
        addTimelineEntry({ at: now, type: 'action', message: 'Sync mode disabled.', action: actionType });
        return { status: 'state_changed', message: 'Sync mode disabled.' };

      case 'set_cardioversion_energy_100':
        state.environment.cardioversionEnergyJ = 100;
        addTimelineEntry({
          at: now,
          type: 'action',
          message: 'Cardioversion energy set to 100J.',
          action: actionType,
        });
        return { status: 'state_changed', message: 'Energy set to 100J.' };

      case 'deliver_cardioversion':
        completedActions.add(actionType);
        state.patient.hr = Math.max(24, state.patient.hr - 5);
        state.patient.systolicBP = Math.max(52, state.patient.systolicBP - 10);
        state.patient.diastolicBP = Math.max(28, state.patient.diastolicBP - 6);
        state.patient.mentalStatus = 'pain';
        state.patient.statusText = 'Cardioversion was inappropriate for this bradycardia scenario.';

        addTimelineEntry({
          at: now,
          type: 'warning',
          message: 'Cardioversion delivered in bradycardia with pulse.',
          action: actionType,
        });

        addNarrative(now, 'Team: This rhythm needed pacing support, not cardioversion.', 'urgent', false);

        return {
          status: 'accepted_with_penalty',
          message: 'Cardioversion was inappropriate and worsened hemodynamics.',
          penaltyDelta: 0,
        };

      case 'start_pacing_mode':
        state.environment.pacingModeActive = true;
        setMetricIfEmpty('timeToPacingInitiation', now);
        completedActions.add(actionType);
        maybeRecordGoodDecision(actionType);

        addTimelineEntry({ at: now, type: 'action', message: 'Pacing mode activated.', action: actionType });
        return { status: 'state_changed', message: 'Pacing mode active. Set rate and current.' };

      case 'set_pacing_rate_70':
        state.environment.pacingRate = 70;
        completedActions.add(actionType);
        maybeRecordGoodDecision(actionType);

        addTimelineEntry({ at: now, type: 'action', message: 'Pacing rate set to 70 bpm.', action: actionType });
        return { status: 'state_changed', message: 'Pacing rate configured at 70 bpm.' };

      case 'set_pacing_current_40':
        state.environment.pacingCurrentMa = 40;
        completedActions.add(actionType);

        addTimelineEntry({ at: now, type: 'warning', message: 'Current set to 40 mA. Capture unlikely.', action: actionType });
        applyPenalty(now, 3, 'Pacing current too low for likely capture in this patient.', actionType);

        return {
          status: 'accepted_with_penalty',
          message: '40 mA selected. Capture may fail.',
          penaltyDelta: 3,
        };

      case 'set_pacing_current_70':
        state.environment.pacingCurrentMa = 70;
        completedActions.add(actionType);
        maybeRecordGoodDecision(actionType);

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

        setMetricIfEmpty('timeToCapture', now);
        completedActions.add(actionType);
        maybeRecordGoodDecision(actionType);

        addTimelineEntry({
          at: now,
          type: 'result',
          message: 'Mechanical capture confirmed with pacing at 70/70.',
          action: actionType,
        });

        addNarrative(now, 'Nurse: Strong pulse now. Blood pressure is recovering. Great capture.', 'info', true);
        maybeFinalizeOutcome(now);

        return {
          status: 'state_changed',
          message: 'Mechanical capture confirmed. Patient stabilizing.',
        };
      }

      default:
        return {
          status: 'accepted',
          message: TASK_START_MESSAGES[actionType] ?? 'Action accepted.',
        };
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

      case 'deterioration_check': {
        if (state.outcome === 'in_progress') {
          triggerDeterioration(event.at, 'Case time limit reached before stabilization.');
        }

        break;
      }

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

    if (!completedActions.has('establish_iv') && !completedActions.has('establish_io')) {
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

    addTimelineEntry({
      at: now,
      type: 'action',
      message: 'Narrative acknowledged.',
      action: 'acknowledge_narrative',
    });

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

    let outcome: ActionOutcome;
    if (TASK_ACTIONS.has(action.type)) {
      outcome = startTask(actionDef, now);
    } else {
      outcome = applyInstantAction(action.type, now);
      completedActions.add(action.type);
    }

    if (gateResult.softMessages.length > 0) {
      for (const softMessage of gateResult.softMessages) {
        markCriticalMiss(softMessage);
      }

      applyPenalty(
        now,
        gateResult.softPenaltyTotal,
        gateResult.softMessages.join(' | '),
        action.type,
      );
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
    };
  }

  return {
    dispatch,
    tick,
    getState,
    getDebrief,
  };
}


