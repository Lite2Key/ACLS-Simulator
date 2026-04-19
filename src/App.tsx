import { useEffect, useRef, useState } from 'react';
import { DEFAULT_CASE } from './cases';
import { createSimulationEngine } from './engine';
import type { ActionOutcome, ActionType, SimulationEngine, SimulationState } from './engine';
import { ActionsPanel } from './components/ActionsPanel';
import { DebriefPanel } from './components/DebriefPanel';
import { MonitorPanel } from './components/MonitorPanel';
import { NarrativePanel } from './components/NarrativePanel';
import { TaskQueuePanel } from './components/TaskQueuePanel';
import type { SimMode } from './types/case';

function createEngine(mode: SimMode): SimulationEngine {
  return createSimulationEngine({ caseDef: DEFAULT_CASE, mode });
}

export function App() {
  const [mode, setMode] = useState<SimMode>(DEFAULT_CASE.defaultMode);
  const [runId, setRunId] = useState(1);
  const [lastOutcome, setLastOutcome] = useState<ActionOutcome | null>(null);

  const engineRef = useRef<SimulationEngine>(createEngine(mode));
  const [simState, setSimState] = useState<SimulationState>(engineRef.current.getState());

  useEffect(() => {
    engineRef.current = createEngine(mode);
    setSimState(engineRef.current.getState());
    setLastOutcome(null);
  }, [mode, runId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSimState((prev) => {
        if (prev.outcome !== 'in_progress') {
          return prev;
        }

        const nextTime = prev.now + 1;
        engineRef.current.tick(nextTime);
        return engineRef.current.getState();
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const debrief = engineRef.current.getDebrief();

  const canAcknowledge = simState.pendingAcknowledgementId !== null;

  function dispatch(type: ActionType): void {
    const outcome = engineRef.current.dispatch({ type }, simState.now);
    setLastOutcome(outcome);
    setSimState(engineRef.current.getState());
  }

  function advance(seconds: number): void {
    const nextTime = simState.now + seconds;
    engineRef.current.tick(nextTime);
    setSimState(engineRef.current.getState());
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="kicker">ACLS Sim v2</p>
          <h1>{DEFAULT_CASE.metadata.title}</h1>
          <p className="subtitle">{DEFAULT_CASE.metadata.presentationTitle}</p>
        </div>
        <div className="topbar-controls">
          <label htmlFor="mode-select" className="control-label">
            Mode
          </label>
          <select
            id="mode-select"
            data-testid="mode-select"
            value={mode}
            onChange={(event) => setMode(event.target.value as SimMode)}
          >
            <option value="guided">Guided</option>
            <option value="realistic">Realistic</option>
            <option value="instructor">Instructor</option>
          </select>
          <button type="button" onClick={() => setRunId((value) => value + 1)} data-testid="reset-run">
            Restart Case
          </button>
          <button type="button" onClick={() => advance(10)} data-testid="advance-10s">
            +10s
          </button>
          <button type="button" onClick={() => advance(30)} data-testid="advance-30s">
            +30s
          </button>
        </div>
      </header>

      {lastOutcome ? (
        <div className={`toast toast-${lastOutcome.status}`} role="status">
          {lastOutcome.message}
        </div>
      ) : null}

      <main className="resus-layout">
        <section className="panel panel-monitor">
          <MonitorPanel state={simState} />
        </section>

        <section className="panel panel-actions">
          <ActionsPanel
            actions={simState.availableActions}
            outcome={simState.outcome}
            onAction={(actionId) => dispatch(actionId)}
          />
        </section>

        <section className="panel panel-narrative">
          <NarrativePanel
            now={simState.now}
            narratives={simState.narratives}
            pendingAcknowledgement={canAcknowledge}
            onAcknowledge={() => dispatch('acknowledge_narrative')}
          />
        </section>

        <section className="panel panel-tasks">
          <TaskQueuePanel now={simState.now} tasks={simState.activeTasks} />
        </section>
      </main>

      {simState.outcome !== 'in_progress' ? (
        <section className="panel panel-debrief" data-testid="debrief-panel">
          <DebriefPanel
            debrief={debrief}
            teachingPoints={DEFAULT_CASE.teachingPoints}
            outcome={simState.outcome}
          />
        </section>
      ) : null}
    </div>
  );
}
