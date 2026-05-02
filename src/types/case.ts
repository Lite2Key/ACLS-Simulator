import type { ActionType } from '../engine/types';

export type SimMode = 'guided' | 'realistic' | 'instructor';

export type TaskTimingKey = string;

export type ActionCategory =
  | 'assessment'
  | 'monitoring'
  | 'access'
  | 'airway'
  | 'electrical'
  | 'medication'
  | 'communication'
  | 'resuscitation'
  | 'labs'
  | 'source';

export type RequirementKey =
  | 'monitorLeadsAttached'
  | 'defibPadsAttached'
  | 'hasVascularAccess'
  | 'syncEnabled'
  | 'pacingModeActive'
  | 'pacingRateSet'
  | 'pacingCurrentSet'
  | 'captureConfirmed'
  | 'bloodCulturesDrawn'
  | 'lactateSent'
  | 'fluidsStarted'
  | 'antibioticsGiven'
  | 'vasopressorStarted';

export type ActionEffect =
  | 'transfer_to_bed_complete'
  | 'ems_handoff_complete'
  | 'attach_monitor_leads_complete'
  | 'attach_defib_pads_complete'
  | 'start_oxygen_complete'
  | 'establish_iv_complete'
  | 'establish_io_complete'
  | 'place_arterial_line_complete'
  | 'attach_capnography_complete'
  | 'send_lactate_complete'
  | 'draw_blood_cultures_complete'
  | 'give_atropine'
  | 'enable_sync'
  | 'disable_sync'
  | 'set_cardioversion_energy_100'
  | 'deliver_cardioversion'
  | 'start_pacing_mode'
  | 'set_pacing_rate_70'
  | 'set_pacing_current_40'
  | 'set_pacing_current_70'
  | 'confirm_capture'
  | 'give_fluid_bolus'
  | 'give_antibiotics'
  | 'start_norepinephrine'
  | 'reassess_perfusion'
  | 'call_icu'
  | 'acknowledge_narrative';

export interface CaseActionDefinition {
  id: ActionType;
  label: string;
  category: ActionCategory;
  kind: 'task' | 'instant';
  taskTimingKey?: TaskTimingKey;
  effect?: ActionEffect;
  completionEffect?: ActionEffect;
  metricKey?: string;
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
  condition?:
    | 'ifNoPads'
    | 'ifNoAccess'
    | 'ifNoPacingSetup'
    | 'ifNoCapture'
    | 'ifNoFluids'
    | 'ifNoAntibiotics'
    | 'ifNoVasopressor'
    | 'ifShockUnresolved';
}

export interface CaseDefinitionV2 {
  metadata: {
    id: string;
    title: string;
    presentationTitle: string;
    category: string;
    module: string;
    difficulty: 'foundational' | 'intermediate' | 'expert';
    clinicalStem: string;
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
      temperatureC?: number;
      lactate?: number | null;
      rhythm: 'sinus_bradycardia' | 'sinus_tachycardia' | 'paced' | 'unstable_tachyarrhythmia';
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
      lactateSent?: boolean;
      bloodCulturesDrawn?: boolean;
      fluidsStarted?: boolean;
      fluidBolusMl?: number;
      antibioticsGiven?: boolean;
      vasopressorStarted?: boolean;
      icuCalled?: boolean;
      perfusionReassessed?: boolean;
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
    metricLabels: Record<string, string>;
  };
  teachingPoints: string[];
}
