import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock3,
  GraduationCap,
  Moon,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Stethoscope,
  Sun,
} from 'lucide-react';
import { CASES, DEFAULT_CASE } from './cases';
import { createSimulationEngine } from './engine';
import type { ActionOutcome, ActionType, SimulationEngine, SimulationState } from './engine';
import { ActionsPanel } from './components/ActionsPanel';
import { DebriefPanel } from './components/DebriefPanel';
import { MonitorPanel } from './components/MonitorPanel';
import { NarrativePanel } from './components/NarrativePanel';
import { TaskQueuePanel } from './components/TaskQueuePanel';
import type { SimMode } from './types/case';
import type { CaseDefinitionV2 } from './types/case';

type ThemeMode = 'dark' | 'light';

function createEngine(caseDef: CaseDefinitionV2, mode: SimMode): SimulationEngine {
  return createSimulationEngine({ caseDef, mode });
}

function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  return window.localStorage.getItem('acls-sim-theme') === 'light' ? 'light' : 'dark';
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function modeLabel(mode: SimMode): string {
  if (mode === 'instructor') {
    return 'Expert';
  }

  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function rhythmDisplay(state: SimulationState): string {
  if (!state.environment.monitorLeadsAttached) {
    return 'Awaiting monitor leads';
  }

  if (state.patient.rhythm === 'paced') {
    return 'Paced rhythm';
  }

  if (state.patient.rhythm === 'sinus_tachycardia') {
    return 'Sinus tachycardia';
  }

  return 'Junctional bradycardia';
}

function patientDisplay(caseDef: CaseDefinitionV2): { name: string; age: string } {
  if (caseDef.metadata.id.includes('septic-shock')) {
    return { name: 'Mary Ellis', age: '74y female' };
  }

  return { name: 'John Doe', age: '68y male' };
}

function stateChips(state: SimulationState): Array<{ label: string; tone: 'danger' | 'warning' | 'stable' }> {
  if (state.caseId.includes('septic-shock')) {
    return [
      { label: 'Septic shock', tone: 'danger' },
      { label: state.patient.mentalStatus === 'alert' ? 'Mentation improved' : 'Confused', tone: 'warning' },
      { label: state.environment.antibioticsGiven ? 'Antibiotics running' : 'Antibiotics pending', tone: state.environment.antibioticsGiven ? 'stable' : 'danger' },
      { label: state.environment.vasopressorStarted ? 'Pressor on' : 'Pressor standby', tone: state.environment.vasopressorStarted ? 'stable' : 'warning' },
    ];
  }

  return [
    { label: 'Symptomatic', tone: 'danger' },
    { label: state.patient.mentalStatus === 'alert' ? 'Alert' : 'Altered', tone: state.patient.mentalStatus === 'alert' ? 'stable' : 'danger' },
    { label: 'Poor perfusion', tone: state.patient.systolicBP >= 90 ? 'stable' : 'warning' },
  ];
}

export function App() {
  const [selectedCaseId, setSelectedCaseId] = useState(DEFAULT_CASE.metadata.id);
  const selectedCase = useMemo(
    () => CASES.find((caseDef) => caseDef.metadata.id === selectedCaseId) ?? DEFAULT_CASE,
    [selectedCaseId],
  );
  const [mode, setMode] = useState<SimMode>(DEFAULT_CASE.defaultMode);
  const [runId, setRunId] = useState(1);
  const [lastOutcome, setLastOutcome] = useState<ActionOutcome | null>(null);
  const [paused, setPaused] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme());

  const engineRef = useRef<SimulationEngine>(createEngine(selectedCase, mode));
  const [simState, setSimState] = useState<SimulationState>(engineRef.current.getState());
  const patient = patientDisplay(selectedCase);

  useEffect(() => {
    engineRef.current = createEngine(selectedCase, mode);
    setSimState(engineRef.current.getState());
    setLastOutcome(null);
    setPaused(false);
  }, [mode, runId, selectedCase]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('acls-sim-theme', theme);
  }, [theme]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSimState((prev) => {
        if (paused || prev.outcome !== 'in_progress') {
          return prev;
        }

        const nextTime = prev.now + 1;
        engineRef.current.tick(nextTime);
        return engineRef.current.getState();
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [paused]);

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
      <header className="topbar cockpit-topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <Stethoscope size={24} />
          </div>
          <div>
            <p className="kicker">Simulator</p>
            <h1>ED Case Lab</h1>
          </div>
        </div>

        <div className="case-block">
          <span className="control-label">Case</span>
          <select
            className="case-select-native"
            data-testid="case-select"
            value={selectedCaseId}
            onChange={(event) => {
              setSelectedCaseId(event.target.value);
              setMode((CASES.find((caseDef) => caseDef.metadata.id === event.target.value) ?? DEFAULT_CASE).defaultMode);
              setRunId((value) => value + 1);
            }}
            aria-label="Case"
          >
            {CASES.map((caseDef) => (
              <option key={caseDef.metadata.id} value={caseDef.metadata.id}>
                {caseDef.metadata.category}: {caseDef.metadata.presentationTitle}
              </option>
            ))}
          </select>
          <strong>{selectedCase.metadata.title}</strong>
          <small>{selectedCase.metadata.module}</small>
        </div>

        <div className="mode-block" role="group" aria-label="Simulation mode">
          <span className="control-label">Mode</span>
          <select
            id="mode-select"
            className="mode-select-native"
            data-testid="mode-select"
            value={mode}
            onChange={(event) => setMode(event.target.value as SimMode)}
            aria-label="Simulation mode"
          >
            <option value="guided">Guided</option>
            <option value="realistic">Realistic</option>
            <option value="instructor">Expert</option>
          </select>
          <div className="segmented-control" aria-hidden="true">
            {selectedCase.modes.map((option) => (
              <button
                key={option}
                type="button"
                className={option === mode ? 'segment-active' : ''}
                onClick={() => setMode(option)}
                tabIndex={-1}
              >
                {modeLabel(option)}
              </button>
            ))}
          </div>
        </div>

        <div className="sim-clock" aria-label="Simulation time">
          <span>Sim Time</span>
          <strong>{formatClock(simState.now)}</strong>
        </div>

        <div className="topbar-controls">
          <button type="button" className="icon-button command-button" onClick={() => setPaused((value) => !value)}>
            {paused ? <Play size={18} /> : <Pause size={18} />}
            <span>{paused ? 'Resume' : 'Pause'}</span>
          </button>
          <button type="button" className="icon-button command-button">
            <GraduationCap size={18} />
            <span>Teach</span>
          </button>
          <button type="button" className="icon-button command-button" onClick={() => advance(10)} data-testid="advance-10s">
            <Clock3 size={18} />
            <span>+10s</span>
          </button>
          <button type="button" className="icon-button command-button desktop-only" onClick={() => advance(30)} data-testid="advance-30s">
            <SkipForward size={18} />
            <span>+30s</span>
          </button>
          <button type="button" className="icon-button command-button" onClick={() => setRunId((value) => value + 1)} data-testid="reset-run">
            <RotateCcw size={18} />
            <span>Restart</span>
          </button>
          <button
            type="button"
            className="icon-button theme-toggle"
            onClick={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
            data-testid="theme-toggle"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </header>

      {lastOutcome ? (
        <div className={`toast toast-${lastOutcome.status}`} role="status">
          {lastOutcome.message}
        </div>
      ) : null}

      <main className="cockpit-layout">
        <section className="panel panel-monitor">
          <MonitorPanel state={simState} />
        </section>

        <section className="panel patient-state-panel" aria-label="Patient state">
          <div className="panel-title-inline">
            <h2>Patient State</h2>
          </div>
          <div className="patient-state-strip">
            {stateChips(simState).map((chip) => (
              <span key={chip.label} className={`patient-state-chip ${chip.tone}`}>
                {chip.label}
              </span>
            ))}
          </div>
        </section>

        <section className="panel panel-workflow">
          <TaskQueuePanel now={simState.now} tasks={simState.activeTasks} />
        </section>

        <section className="panel panel-narrative">
          <NarrativePanel
            now={simState.now}
            narratives={simState.narratives}
            pendingAcknowledgement={canAcknowledge}
            onAcknowledge={() => dispatch('acknowledge_narrative')}
          />
        </section>

        <section className="panel panel-actions">
          <ActionsPanel
            actions={simState.availableActions}
            gates={selectedCase.gates}
            state={simState}
            outcome={simState.outcome}
            moduleLabel={selectedCase.metadata.module}
            onAction={(actionId) => dispatch(actionId)}
          />
        </section>

        <section className="panel case-context-panel">
          <div className="context-card">
            <span>Patient</span>
            <strong>{patient.name}</strong>
            <small>{patient.age}</small>
          </div>
          <div className="context-card">
            <span>Rhythm</span>
            <strong>{rhythmDisplay(simState)}</strong>
            <small>{simState.patient.hr} bpm</small>
          </div>
          <div className="context-card">
            <span>Scenario</span>
            <strong>ED / {selectedCase.metadata.category}</strong>
            <small>{selectedCase.metadata.clinicalStem}</small>
          </div>
        </section>

        <section className="panel debrief-preview-panel">
          <div>
            <div className="panel-title-inline">
              <h2>Debrief Preview</h2>
              <span className="quiet-link">Review later</span>
            </div>
            <p>Debrief ready when case ends.</p>
          </div>
          <span className={`chip chip-${simState.outcome}`}>{simState.outcome.replace('_', ' ')}</span>
        </section>
      </main>

      {simState.outcome !== 'in_progress' ? (
        <section className="panel panel-debrief" data-testid="debrief-panel">
          <DebriefPanel
            debrief={debrief}
            teachingPoints={selectedCase.teachingPoints}
            outcome={simState.outcome}
          />
        </section>
      ) : null}
    </div>
  );
}
