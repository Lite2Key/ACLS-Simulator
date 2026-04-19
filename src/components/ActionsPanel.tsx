import type { ActionType, SimulationState } from '../engine';
import type { ActionCategory, CaseActionDefinition } from '../types/case';

interface ActionsPanelProps {
  actions: CaseActionDefinition[];
  outcome: SimulationState['outcome'];
  onAction: (actionId: ActionType) => void;
}

const CATEGORY_ORDER: ActionCategory[] = [
  'assessment',
  'monitoring',
  'access',
  'airway',
  'electrical',
  'medication',
  'communication',
];

export function ActionsPanel({ actions, outcome, onAction }: ActionsPanelProps) {
  const grouped = actions.reduce<Record<ActionCategory, CaseActionDefinition[]>>(
    (accumulator, action) => {
      accumulator[action.category] = [...accumulator[action.category], action];
      return accumulator;
    },
    {
      assessment: [],
      monitoring: [],
      access: [],
      airway: [],
      electrical: [],
      medication: [],
      communication: [],
    },
  );

  return (
    <div>
      <div className="panel-header-row">
        <h2>Actions</h2>
        <span className="chip">Grouped by workflow</span>
      </div>

      <div className="actions-groups" data-testid="actions-panel">
        {CATEGORY_ORDER.map((category) => {
          const categoryActions = grouped[category].filter((action) => !action.hidden);
          if (categoryActions.length === 0) {
            return null;
          }

          return (
            <section key={category}>
              <h3>{category}</h3>
              <div className="action-buttons">
                {categoryActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => onAction(action.id)}
                    disabled={outcome !== 'in_progress'}
                    data-testid={`action-${action.id}`}
                    className={action.majorBeat ? 'major' : ''}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
