import { useMemo, useState } from 'react';
import {
  Activity,
  Ambulance,
  BatteryCharging,
  ClipboardList,
  Droplets,
  FlaskConical,
  HeartPulse,
  History,
  Phone,
  RadioTower,
  Siren,
  Stethoscope,
  Syringe,
  Wind,
  Zap,
} from 'lucide-react';
import type { ActionType, SimulationState } from '../engine';
import type { SimulationEnvironmentState } from '../engine/types';
import type { ActionCategory, CaseActionDefinition, GateRule, RequirementKey } from '../types/case';

type CommandTab = 'critical' | 'setup' | 'airway' | 'meds' | 'electrical' | 'team';

interface ActionsPanelProps {
  actions: CaseActionDefinition[];
  gates: GateRule[];
  state: SimulationState;
  outcome: SimulationState['outcome'];
  moduleLabel: string;
  onAction: (actionId: ActionType) => void;
}

const TABS: Array<{ id: CommandTab; label: string }> = [
  { id: 'critical', label: 'Critical' },
  { id: 'setup', label: 'Setup' },
  { id: 'airway', label: 'Airway' },
  { id: 'meds', label: 'Meds' },
  { id: 'electrical', label: 'Electrical' },
  { id: 'team', label: 'Team' },
];

const TAB_CATEGORIES: Record<Exclude<CommandTab, 'critical'>, ActionCategory[]> = {
  setup: ['assessment', 'monitoring', 'access', 'labs', 'source'],
  airway: ['airway'],
  meds: ['medication', 'resuscitation'],
  electrical: ['electrical'],
  team: ['communication'],
};

const ACTION_ICON: Partial<Record<ActionType, typeof Zap>> = {
  start_transfer_to_bed: Ambulance,
  start_ems_handoff: RadioTower,
  attach_monitor_leads: Activity,
  attach_defib_pads: BatteryCharging,
  start_oxygen: Wind,
  establish_iv: Syringe,
  establish_io: Syringe,
  place_arterial_line: Activity,
  attach_capnography: Wind,
  send_lactate: FlaskConical,
  draw_blood_cultures: FlaskConical,
  give_atropine: Syringe,
  give_fluid_bolus: Droplets,
  give_antibiotics: Syringe,
  start_norepinephrine: Syringe,
  reassess_perfusion: Stethoscope,
  call_icu: Phone,
  toggle_sync_on: Activity,
  set_cardioversion_energy_100: Zap,
  deliver_cardioversion: Zap,
  start_pacing_mode: Zap,
  set_pacing_rate_70: Activity,
  set_pacing_current_40: Activity,
  set_pacing_current_70: Activity,
  confirm_capture: HeartPulse,
};

function hasVascularAccess(environment: SimulationEnvironmentState): boolean {
  return environment.ivAccess || environment.ioAccess;
}

function requirementMet(requirement: RequirementKey, environment: SimulationEnvironmentState): boolean {
  switch (requirement) {
    case 'monitorLeadsAttached':
      return environment.monitorLeadsAttached;
    case 'defibPadsAttached':
      return environment.defibPadsAttached;
    case 'hasVascularAccess':
      return hasVascularAccess(environment);
    case 'syncEnabled':
      return environment.syncEnabled;
    case 'pacingModeActive':
      return environment.pacingModeActive;
    case 'pacingRateSet':
      return environment.pacingRate !== null;
    case 'pacingCurrentSet':
      return environment.pacingCurrentMa !== null;
    case 'captureConfirmed':
      return environment.captureConfirmed;
    case 'bloodCulturesDrawn':
      return Boolean(environment.bloodCulturesDrawn);
    case 'lactateSent':
      return Boolean(environment.lactateSent);
    case 'fluidsStarted':
      return Boolean(environment.fluidsStarted);
    case 'antibioticsGiven':
      return Boolean(environment.antibioticsGiven);
    case 'vasopressorStarted':
      return Boolean(environment.vasopressorStarted);
    default:
      return false;
  }
}

function requirementLabel(requirement: RequirementKey): string {
  switch (requirement) {
    case 'defibPadsAttached':
      return 'needs pads';
    case 'hasVascularAccess':
      return 'needs IV/IO';
    case 'syncEnabled':
      return 'needs sync';
    case 'pacingModeActive':
      return 'needs pacing';
    case 'pacingRateSet':
    case 'pacingCurrentSet':
      return 'needs rate + current';
    case 'monitorLeadsAttached':
      return 'needs leads';
    case 'captureConfirmed':
      return 'needs capture';
    case 'bloodCulturesDrawn':
      return 'needs cultures';
    case 'lactateSent':
      return 'needs lactate';
    case 'fluidsStarted':
      return 'needs fluids';
    case 'antibioticsGiven':
      return 'needs antibiotics';
    case 'vasopressorStarted':
      return 'needs pressor';
    default:
      return 'needs setup';
  }
}

function missingRequirements(
  action: ActionType,
  gates: GateRule[],
  environment: SimulationEnvironmentState,
): { hard: string[]; soft: string[] } {
  const hard = new Set<string>();
  const soft = new Set<string>();

  for (const gate of gates.filter((item) => item.action === action)) {
    for (const requirement of gate.requires) {
      if (requirementMet(requirement, environment)) {
        continue;
      }

      if (gate.type === 'hard') {
        hard.add(requirementLabel(requirement));
      } else {
        soft.add(requirementLabel(requirement));
      }
    }
  }

  return { hard: [...hard], soft: [...soft] };
}

function shortLabel(label: string): string {
  return label
    .replace('Defibrillator ', '')
    .replace('Mechanical ', '')
    .replace('Supplemental ', '')
    .replace('Balanced ', '')
    .replace('Broad-Spectrum ', '')
    .replace(' Mode', '')
    .replace(' to 70', '')
    .replace(' 1 mg IV/IO', '');
}

function actionMatchesTab(action: CaseActionDefinition, activeTab: CommandTab): boolean {
  if (activeTab === 'critical') {
    return Boolean(action.majorBeat);
  }

  return TAB_CATEGORIES[activeTab].includes(action.category);
}

export function ActionsPanel({ actions, gates, state, outcome, moduleLabel, onAction }: ActionsPanelProps) {
  const [activeTab, setActiveTab] = useState<CommandTab>('critical');
  const visibleActions = useMemo(() => actions.filter((action) => !action.hidden), [actions]);

  const tabActions = visibleActions.filter((action) => actionMatchesTab(action, activeTab));
  const secondaryActions = activeTab === 'critical'
    ? visibleActions.filter((action) => !action.majorBeat).slice(0, 6)
    : visibleActions.filter((action) => action.majorBeat && !tabActions.some((item) => item.id === action.id)).slice(0, 4);

  function renderAction(action: CaseActionDefinition, compact = false) {
    const Icon = ACTION_ICON[action.id] ?? ClipboardList;
    const missing = missingRequirements(action.id, gates, state.environment);
    const hardBlocked = missing.hard.length > 0;
    const softWarnings = missing.soft.length > 0;
    const disabled = outcome !== 'in_progress' || hardBlocked;

    return (
      <button
        key={action.id}
        type="button"
        onClick={() => onAction(action.id)}
        disabled={disabled}
        data-testid={`action-${action.id}`}
        className={[
          'action-card',
          compact ? 'action-card-compact' : '',
          action.majorBeat ? 'action-card-major' : '',
          hardBlocked ? 'action-card-blocked' : '',
          softWarnings ? 'action-card-caution' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Icon size={compact ? 17 : 22} />
        <span className="action-card-label">{shortLabel(action.label)}</span>
        {[...missing.hard, ...missing.soft].length > 0 ? (
          <span className="action-requirement">{[...missing.hard, ...missing.soft].join(' · ')}</span>
        ) : (
          <span className="action-ready">ready</span>
        )}
      </button>
    );
  }

  return (
    <div className="actions-panel">
      <div className="panel-header-row">
        <div>
          <h2>Command</h2>
          <p className="panel-subtitle">Case actions by workflow priority</p>
        </div>
        <span className="chip">{moduleLabel}</span>
      </div>

      <div className="command-tabs" role="tablist" aria-label="Command groups">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'command-tab-active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="actions-groups" data-testid="actions-panel">
        <div className="critical-action-grid">{tabActions.map((action) => renderAction(action))}</div>

        {secondaryActions.length > 0 ? (
          <section className="secondary-actions">
            <div className="section-label">
              <span>Other actions</span>
            </div>
            <div className="secondary-action-grid">{secondaryActions.map((action) => renderAction(action, true))}</div>
          </section>
        ) : null}

        <section className="secondary-actions">
          <div className="section-label">
            <span>Reference</span>
          </div>
          <div className="secondary-action-grid">
            <button type="button" className="action-card action-card-compact reference-action">
              <Stethoscope size={17} />
              <span className="action-card-label">Primary survey</span>
            </button>
            <button type="button" className="action-card action-card-compact reference-action">
              <History size={17} />
              <span className="action-card-label">History</span>
            </button>
            <button type="button" className="action-card action-card-compact reference-action">
              <Phone size={17} />
              <span className="action-card-label">Call for help</span>
            </button>
            <button type="button" className="action-card action-card-compact reference-action">
              <Siren size={17} />
              <span className="action-card-label">Update team</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
