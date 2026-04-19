import type { CaseActionDefinition, CaseDefinitionV2, SimMode } from '../types/case';

export type ActionType =
  | 'start_transfer_to_bed'
  | 'start_ems_handoff'
  | 'attach_monitor_leads'
  | 'attach_defib_pads'
  | 'start_oxygen'
  | 'establish_iv'
  | 'establish_io'
  | 'give_atropine'
  | 'toggle_sync_on'
  | 'toggle_sync_off'
  | 'set_cardioversion_energy_100'
  | 'deliver_cardioversion'
  | 'start_pacing_mode'
  | 'set_pacing_rate_70'
  | 'set_pacing_current_40'
  | 'set_pacing_current_70'
  | 'confirm_capture'
  | 'acknowledge_narrative';

export interface UserAction {
  type: ActionType;
}

export interface ActionOutcome {
  status: 'accepted' | 'hard_blocked' | 'accepted_with_penalty' | 'task_started' | 'state_changed';
  message: string;
  penaltyDelta?: number;
  startedTaskId?: string;
}

export interface SimulationPatientState {
  hr: number;
  systolicBP: number;
  diastolicBP: number;
  spo2: number;
  rr: number;
  rhythm: 'sinus_bradycardia' | 'paced' | 'unstable_tachyarrhythmia';
  hasPulse: boolean;
  mentalStatus: 'alert' | 'verbal' | 'pain' | 'unresponsive';
  statusText: string;
}

export interface SimulationEnvironmentState {
  onBed: boolean;
  monitorLeadsAttached: boolean;
  defibPadsAttached: boolean;
  syncEnabled: boolean;
  oxygenOn: boolean;
  ivAccess: boolean;
  ioAccess: boolean;
  pacingModeActive: boolean;
  pacingRate: number | null;
  pacingCurrentMa: number | null;
  captureConfirmed: boolean;
  cardioversionEnergyJ: number | null;
}

export interface ActiveTask {
  id: string;
  action: ActionType;
  label: string;
  startedAt: number;
  endsAt: number;
}

export interface ScheduledEvent {
  id: string;
  type: 'task_complete' | 'narrative_beat' | 'deterioration_check';
  at: number;
  payload?: {
    action?: ActionType;
    beatId?: string;
  };
}

export interface TimelineEntry {
  at: number;
  type: 'action' | 'result' | 'warning' | 'critical' | 'narrative';
  message: string;
  action?: ActionType;
}

export interface DebriefMetrics {
  timeToMonitor: number | null;
  timeToPads: number | null;
  timeToPacingInitiation: number | null;
  timeToCapture: number | null;
  algorithmDeviationCount: number;
}

export interface DebriefReport {
  caseId: string;
  mode: SimMode;
  outcome: 'in_progress' | 'stabilized' | 'deteriorated';
  timeline: TimelineEntry[];
  criticalMisses: string[];
  goodDecisions: string[];
  metrics: DebriefMetrics;
}

export interface NarrativeItem {
  id: string;
  at: number;
  message: string;
  priority: 'info' | 'urgent';
  requiresAcknowledgement: boolean;
}

export interface SimulationState {
  now: number;
  mode: SimMode;
  caseId: string;
  outcome: 'in_progress' | 'stabilized' | 'deteriorated';
  patient: SimulationPatientState;
  environment: SimulationEnvironmentState;
  availableActions: CaseActionDefinition[];
  activeTasks: ActiveTask[];
  pendingEvents: ScheduledEvent[];
  narratives: NarrativeItem[];
  pendingAcknowledgementId: string | null;
  penalties: number;
}

export interface SimulationEngine {
  dispatch(action: UserAction, now: number): ActionOutcome;
  tick(toTime: number): void;
  getState(): SimulationState;
  getDebrief(): DebriefReport;
}

export interface CreateSimulationEngineOptions {
  caseDef: CaseDefinitionV2;
  mode?: SimMode;
}