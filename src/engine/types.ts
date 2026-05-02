import type { CaseActionDefinition, CaseDefinitionV2, SimMode } from '../types/case';

export type ActionType = string;

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
  etco2: number | null;
  temperatureC?: number;
  lactate?: number | null;
  rhythm: 'sinus_bradycardia' | 'sinus_tachycardia' | 'paced' | 'unstable_tachyarrhythmia';
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
  arterialLine: boolean;
  capnography: boolean;
  pacingModeActive: boolean;
  pacingRate: number | null;
  pacingCurrentMa: number | null;
  captureConfirmed: boolean;
  cardioversionEnergyJ: number | null;
  lactateSent?: boolean;
  bloodCulturesDrawn?: boolean;
  fluidsStarted?: boolean;
  fluidBolusMl?: number;
  antibioticsGiven?: boolean;
  vasopressorStarted?: boolean;
  icuCalled?: boolean;
  perfusionReassessed?: boolean;
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

export type DebriefMetrics = Record<string, number | null>;

export interface DebriefReport {
  caseId: string;
  mode: SimMode;
  outcome: 'in_progress' | 'stabilized' | 'deteriorated';
  timeline: TimelineEntry[];
  criticalMisses: string[];
  goodDecisions: string[];
  metrics: DebriefMetrics;
  metricLabels: Record<string, string>;
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
