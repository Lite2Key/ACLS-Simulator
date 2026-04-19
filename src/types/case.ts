import type { ActionType } from '../engine/types';

export type SimMode = 'guided' | 'realistic' | 'instructor';

export type TaskTimingKey =
  | 'transferToBed'
  | 'emsHandoff'
  | 'attachLeads'
  | 'attachPads'
  | 'startOxygen'
  | 'establishIV'
  | 'establishIO'
  | 'placeArterialLine'
  | 'attachCapnography';

export type ActionCategory =
  | 'assessment'
  | 'monitoring'
  | 'access'
  | 'airway'
  | 'electrical'
  | 'medication'
  | 'communication';

export type RequirementKey =
  | 'monitorLeadsAttached'
  | 'defibPadsAttached'
  | 'hasVascularAccess'
  | 'syncEnabled'
  | 'pacingModeActive'
  | 'pacingRateSet'
  | 'pacingCurrentSet'
  | 'captureConfirmed';

export interface CaseActionDefinition {
  id: ActionType;
  label: string;
  category: ActionCategory;
  kind: 'task' | 'instant';
  taskTimingKey?: TaskTimingKey;
  description?: string;
  majorBeat?: boolean;
  hidden?: boolean;
}

export interface GateRule {
  id: string;
  type: 'hard' | 'soft';
  action: ActionType;
  requires: RequirementKey[];
  message: string;
  penalty?: number;
  onFailureEffect?: 'none' | 'worsen_hemodynamics';
}

export interface NarrativeBeat {
  id: string;
  atSeconds: number;
  message: string;
  priority: 'info' | 'urgent';
  requiresAcknowledgement?: boolean;
  condition?: 'ifNoPads' | 'ifNoAccess' | 'ifNoPacingSetup' | 'ifNoCapture';
}

export interface CaseDefinitionV2 {
  metadata: {
    id: string;
    title: string;
    presentationTitle: string;
    category: string;
    estimatedMinutes: number;
    learningObjectives: string[];
  };
  defaultMode: SimMode;
  modes: SimMode[];
  timings: Record<TaskTimingKey, Record<SimMode, number>>;
  initialState: {
    patient: {
      hr: number;
      systolicBP: number;
      diastolicBP: number;
      spo2: number;
      rr: number;
      etco2: number | null;
      rhythm: 'sinus_bradycardia' | 'paced' | 'unstable_tachyarrhythmia';
      hasPulse: boolean;
      mentalStatus: 'alert' | 'verbal' | 'pain' | 'unresponsive';
      statusText: string;
    };
    environment: {
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
    };
  };
  actions: CaseActionDefinition[];
  gates: GateRule[];
  narrativeBeats: NarrativeBeat[];
  outcomes: {
    deteriorateAfterSeconds: number;
    maxPenaltyBeforeDeterioration: number;
  };
  debriefRules: {
    criticalActions: ActionType[];
    goodDecisionActions: ActionType[];
    algorithmDeviationActions: ActionType[];
  };
  teachingPoints: string[];
}
