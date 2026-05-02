import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  GraduationCap,
  Menu,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
  Star,
  Stethoscope,
} from 'lucide-react';
import { CASES, DEFAULT_CASE } from './cases';
import { createSimulationEngine } from './engine';
import type { ActionOutcome, ActionType, DebriefReport, SimulationEngine, SimulationState } from './engine';
import { ActionsPanel } from './components/ActionsPanel';
import { DebriefPanel } from './components/DebriefPanel';
import { MonitorPanel } from './components/MonitorPanel';
import { NarrativePanel } from './components/NarrativePanel';
import { TaskQueuePanel } from './components/TaskQueuePanel';
import type { CaseDefinitionV2, SimMode } from './types/case';

type Screen = 'home' | 'simulation';

interface RecentRun {
  id: string;
  caseTitle: string;
  outcome: SimulationState['outcome'];
  mode: SimMode;
  duration: number;
}

function createEngine(caseDef: CaseDefinitionV2, mode: SimMode): SimulationEngine {
  return createSimulationEngine({ caseDef, mode });
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function modeLabel(mode: SimMode): string {
  return mode === 'instructor' ? 'Expert' : mode.charAt(0).toUpperCase() + mode.slice(1);
}

function patientDisplay(caseDef: CaseDefinitionV2): { name: string; age: string; weight: string; allergies: string } {
  if (caseDef.metadata.id.includes('septic-shock')) {
    return { name: 'Mary Ellis', age: '74 / F', weight: '62 kg', allergies: 'NKDA' };
  }

  return { name: 'John Davis', age: '68 / M', weight: '85 kg', allergies: 'NKDA' };
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

function caseFocus(caseDef: CaseDefinitionV2): string[] {
  return caseDef.metadata.id.includes('septic-shock')
    ? ['Shock recognition', 'Cultures, lactate, antibiotics', 'Fluid and pressor reassessment']
    : ['Leads versus therapy pads', 'Atropine versus pacing', 'Mechanical capture confirmation'];
}

function modeDescription(mode: SimMode): string {
  if (mode === 'guided') {
    return 'More coaching and shorter task durations.';
  }

  if (mode === 'instructor') {
    return 'Minimal guidance and stricter room tempo.';
  }

  return 'Balanced tempo with limited team cues.';
}

interface HomeScreenProps {
  cases: CaseDefinitionV2[];
  selectedCase: CaseDefinitionV2;
  selectedMode: SimMode;
  recentRuns: RecentRun[];
  onSelectCase: (caseId: string) => void;
  onSelectMode: (mode: SimMode) => void;
  onStart: () => void;
}

function HomeScreen({
  cases,
  selectedCase,
  selectedMode,
  recentRuns,
  onSelectCase,
  onSelectMode,
  onStart,
}: HomeScreenProps) {
  return (
    <div className="home-shell">
      <header className="home-header">
        <div className="home-brand">
          <div className="home-brand-mark" aria-hidden="true">
            <Star size={30} />
          </div>
          <div>
            <p className="kicker">Training Hub</p>
            <h1>ED Case Lab</h1>
            <span>Lead the Room</span>
          </div>
        </div>

        <div className="home-mode-panel" aria-label="Training mode">
          <span className="control-label">Mode</span>
          <div className="mode-choice-row">
            {selectedCase.modes.map((modeOption) => (
              <button
                key={modeOption}
                type="button"
                className={selectedMode === modeOption ? 'mode-choice-active' : ''}
                onClick={() => onSelectMode(modeOption)}
                data-testid={`home-mode-${modeOption}`}
              >
                {modeLabel(modeOption)}
              </button>
            ))}
          </div>
          <p>{modeDescription(selectedMode)}</p>
        </div>

        <button type="button" className="home-primary-action" onClick={onStart} data-testid="start-case">
          <Play size={18} />
          Start Case
        </button>
      </header>

      <main className="home-grid">
        <section className="home-panel case-library-panel">
          <div className="home-section-heading">
            <div>
              <p className="kicker">Case Library</p>
              <h2>Choose a resuscitation room</h2>
            </div>
            <span className="home-count">{cases.length} active cases</span>
          </div>

          <div className="case-card-grid">
            {cases.map((caseDef) => (
              <button
                key={caseDef.metadata.id}
                type="button"
                className={`case-card ${selectedCase.metadata.id === caseDef.metadata.id ? 'case-card-selected' : ''}`}
                onClick={() => onSelectCase(caseDef.metadata.id)}
                data-testid={`case-card-${caseDef.metadata.id}`}
              >
                <div className="case-card-top">
                  <span className="case-module">{caseDef.metadata.module}</span>
                  <span className={`difficulty difficulty-${caseDef.metadata.difficulty}`}>
                    {caseDef.metadata.difficulty}
                  </span>
                </div>
                <h3>{caseDef.metadata.title}</h3>
                <p>{caseDef.metadata.clinicalStem}</p>
                <div className="case-meta-row">
                  <span>
                    <Clock3 size={15} />
                    {caseDef.metadata.estimatedMinutes} min
                  </span>
                  <span>
                    <GraduationCap size={15} />
                    {modeLabel(selectedMode)}
                  </span>
                </div>
                <ul>
                  {caseFocus(caseDef).map((focus) => (
                    <li key={focus}>{focus}</li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        </section>

        <aside className="home-panel selected-case-panel">
          <div className="home-section-heading">
            <div>
              <p className="kicker">Selected Case</p>
              <h2>{selectedCase.metadata.presentationTitle}</h2>
            </div>
            <span className="status-dot-label">
              <span />
              Ready
            </span>
          </div>
          <p>{selectedCase.metadata.clinicalStem}</p>
          <div className="selected-case-stats">
            <div>
              <span>Module</span>
              <strong>{selectedCase.metadata.module}</strong>
            </div>
            <div>
              <span>Guidance</span>
              <strong>{selectedMode === 'instructor' ? 'Minimal' : modeLabel(selectedMode)}</strong>
            </div>
            <div>
              <span>Estimated</span>
              <strong>{selectedCase.metadata.estimatedMinutes} min</strong>
            </div>
          </div>
          <div className="objective-list">
            <span className="control-label">Learning Focus</span>
            {selectedCase.metadata.learningObjectives.slice(0, 4).map((objective) => (
              <div key={objective}>
                <CheckCircle2 size={16} />
                <span>{objective}</span>
              </div>
            ))}
          </div>
          <button type="button" className="home-primary-action home-primary-wide" onClick={onStart}>
            Start Case
            <ChevronRight size={18} />
          </button>
        </aside>

        <section className="home-panel training-activity-panel">
          <div className="home-section-heading">
            <div>
              <p className="kicker">Training Activity</p>
              <h2>Recent debriefs</h2>
            </div>
            <BookOpenCheck size={20} />
          </div>
          <div className="activity-list">
            {recentRuns.length === 0 ? (
              <div className="activity-empty">
                <Sparkles size={18} />
                <span>Complete a case to populate debrief history for this session.</span>
              </div>
            ) : null}
            {recentRuns.map((run) => (
              <div key={run.id} className="activity-row">
                <span className={`activity-outcome activity-${run.outcome}`} />
                <div>
                  <strong>{run.caseTitle}</strong>
                  <span>{modeLabel(run.mode)} · {formatClock(run.duration)} · {run.outcome.replace('_', ' ')}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

interface SimulationScreenProps {
  selectedCase: CaseDefinitionV2;
  mode: SimMode;
  simState: SimulationState;
  lastOutcome: ActionOutcome | null;
  debrief: DebriefReport;
  paused: boolean;
  onBack: () => void;
  onModeChange: (mode: SimMode) => void;
  onPauseToggle: () => void;
  onAdvance: (seconds: number) => void;
  onRestart: () => void;
  onAction: (action: ActionType) => void;
}

function VitalsTrend({ state }: { state: SimulationState }) {
  const rows = [
    ['HR', state.patient.hr, state.patient.hr + 4, state.patient.hr + 2, state.patient.hr],
    ['BP', `${state.patient.systolicBP + 8}/${state.patient.diastolicBP + 4}`, `${state.patient.systolicBP + 4}/${state.patient.diastolicBP + 2}`, `${state.patient.systolicBP}/${state.patient.diastolicBP}`, `${state.patient.systolicBP}/${state.patient.diastolicBP}`],
    ['SpO2', Math.max(88, state.patient.spo2 - 1), state.patient.spo2, state.patient.spo2, state.patient.spo2],
    ['RR', state.patient.rr, state.patient.rr, state.patient.rr, state.patient.rr],
  ];

  return (
    <table className="vitals-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>-6m</th>
          <th>-3m</th>
          <th>Now</th>
          <th>Trend</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]}>
            {row.map((cell, index) => (
              <td key={`${row[0]}-${index}`}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LabsPanel({ state }: { state: SimulationState }) {
  const septic = state.caseId.includes('septic-shock');
  const labs = septic
    ? [
        ['WBC', '18.7 K/uL'],
        ['Lactate', state.patient.lactate ? `${state.patient.lactate.toFixed(1)} mmol/L` : 'pending'],
        ['Cr', '1.6 mg/dL'],
        ['Glucose', '132 mg/dL'],
      ]
    : [
        ['K', '4.6 mmol/L'],
        ['Mg', '2.0 mg/dL'],
        ['Troponin', 'pending'],
        ['Glucose', '118 mg/dL'],
      ];

  return (
    <div className="compact-list">
      {labs.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function MedicationsPanel({ state }: { state: SimulationState }) {
  const meds = state.caseId.includes('septic-shock')
    ? [
        ['Norepinephrine', state.environment.vasopressorStarted ? 'running' : '--'],
        ['IV Fluids', `${state.environment.fluidBolusMl ?? 0} mL`],
        ['Antibiotics', state.environment.antibioticsGiven ? 'started' : '--'],
      ]
    : [
        ['Atropine', state.patient.hr > 34 ? 'given' : '--'],
        ['Pacer', state.environment.pacingModeActive ? 'armed' : '--'],
        ['Capture', state.environment.captureConfirmed ? 'confirmed' : '--'],
      ];

  return (
    <div className="compact-list">
      {meds.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function SimulationScreen({
  selectedCase,
  mode,
  simState,
  lastOutcome,
  debrief,
  paused,
  onBack,
  onModeChange,
  onPauseToggle,
  onAdvance,
  onRestart,
  onAction,
}: SimulationScreenProps) {
  const patient = patientDisplay(selectedCase);
  const debriefReady = simState.outcome !== 'in_progress';

  return (
    <div className="sim-shell">
      <header className="sim-topbar">
        <button type="button" className="library-button" onClick={onBack} data-testid="back-library">
          <ArrowLeft size={18} />
          Case Library
        </button>

        <div className="sim-brand">
          <div className="home-brand-mark small" aria-hidden="true">
            <Star size={22} />
          </div>
          <div>
            <h1>ED Case Lab</h1>
            <span>Lead the Room</span>
          </div>
        </div>

        <div className="sim-case-tabs">
          {CASES.map((caseDef) => (
            <span key={caseDef.metadata.id} className={caseDef.metadata.id === selectedCase.metadata.id ? 'sim-case-active' : ''}>
              {caseDef.metadata.category === 'Bradycardia' ? 'Unstable Bradycardia' : caseDef.metadata.title.split(':')[0]}
            </span>
          ))}
        </div>

        <div className="sim-mode-control">
          <span className="control-label">Mode</span>
          <select value={mode} onChange={(event) => onModeChange(event.target.value as SimMode)} data-testid="mode-select">
            {selectedCase.modes.map((option) => (
              <option key={option} value={option}>
                {modeLabel(option)}
              </option>
            ))}
          </select>
          <span className="minimal-guidance">
            <GraduationCap size={16} />
            {mode === 'instructor' ? 'Minimal Guidance' : 'Limited Guidance'}
          </span>
        </div>

        <div className="sim-clock-block">
          <span>Sim Clock</span>
          <strong>{formatClock(simState.now)}</strong>
          <em>/ {selectedCase.metadata.estimatedMinutes}:00</em>
        </div>

        <div className="sim-controls">
          <button type="button" onClick={onPauseToggle}>
            {paused ? <Play size={17} /> : <Pause size={17} />}
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" onClick={onRestart} data-testid="reset-run">
            <RotateCcw size={17} />
            Restart
          </button>
          <button type="button" onClick={() => onAdvance(10)} data-testid="advance-10s">
            <Clock3 size={17} />
            +10s
          </button>
          <button type="button" onClick={() => onAdvance(30)} data-testid="advance-30s">
            <SkipForward size={17} />
            +30s
          </button>
          <button type="button" aria-label="Menu">
            <Menu size={18} />
          </button>
        </div>
      </header>

      {lastOutcome ? (
        <div className={`toast toast-${lastOutcome.status}`} role="status">
          {lastOutcome.message}
        </div>
      ) : null}

      <main className="sim-grid">
        <section className="panel panel-monitor">
          <MonitorPanel state={simState} />
        </section>

        <section className="panel panel-workflow">
          <TaskQueuePanel now={simState.now} tasks={simState.activeTasks} />
        </section>

        <section className="panel panel-narrative">
          <NarrativePanel
            now={simState.now}
            narratives={simState.narratives}
            pendingAcknowledgement={simState.pendingAcknowledgementId !== null}
            onAcknowledge={() => onAction('acknowledge_narrative')}
          />
        </section>

        <section className="panel panel-actions">
          <ActionsPanel
            actions={simState.availableActions}
            gates={selectedCase.gates}
            state={simState}
            outcome={simState.outcome}
            moduleLabel={selectedCase.metadata.module}
            onAction={onAction}
          />
        </section>

        <section className="panel patient-snapshot-panel">
          <div className="panel-title-inline">
            <Stethoscope size={17} />
            <h2>Patient Snapshot</h2>
          </div>
          <div className="snapshot-grid">
            <span>Name</span><strong>{patient.name}</strong>
            <span>Age / Sex</span><strong>{patient.age}</strong>
            <span>Weight</span><strong>{patient.weight}</strong>
            <span>Allergies</span><strong>{patient.allergies}</strong>
          </div>
          <p>{selectedCase.metadata.clinicalStem}</p>
          <div className="patient-state-strip">
            {stateChips(simState).map((chip) => (
              <span key={chip.label} className={`patient-state-chip ${chip.tone}`}>
                {chip.label}
              </span>
            ))}
          </div>
        </section>

        <section className="panel vitals-panel">
          <h2>Vitals Trend</h2>
          <VitalsTrend state={simState} />
        </section>

        <section className="panel labs-panel">
          <h2>Labs</h2>
          <LabsPanel state={simState} />
        </section>

        <section className="panel meds-panel">
          <h2>Medications / Infusions</h2>
          <MedicationsPanel state={simState} />
        </section>

        <section className="panel debrief-preview-panel">
          <div className="panel-title-inline">
            <h2>Debrief Preview</h2>
            <span className="quiet-link">{debriefReady ? 'Open debrief' : 'Review later'}</span>
          </div>
          <p>{debriefReady ? 'Debrief is ready for review.' : 'Key moments will populate as the case evolves.'}</p>
          <span className={`chip chip-${simState.outcome}`}>{simState.outcome.replace('_', ' ')}</span>
        </section>
      </main>

      {debriefReady ? (
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

export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedCaseId, setSelectedCaseId] = useState(DEFAULT_CASE.metadata.id);
  const selectedCase = useMemo(
    () => CASES.find((caseDef) => caseDef.metadata.id === selectedCaseId) ?? DEFAULT_CASE,
    [selectedCaseId],
  );
  const [mode, setMode] = useState<SimMode>(DEFAULT_CASE.defaultMode);
  const [runId, setRunId] = useState(1);
  const [lastOutcome, setLastOutcome] = useState<ActionOutcome | null>(null);
  const [paused, setPaused] = useState(false);
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
  const recordedRunRef = useRef<string | null>(null);

  const engineRef = useRef<SimulationEngine>(createEngine(selectedCase, mode));
  const [simState, setSimState] = useState<SimulationState>(engineRef.current.getState());
  const debrief = engineRef.current.getDebrief();

  useEffect(() => {
    document.documentElement.dataset.theme = 'light';
  }, []);

  useEffect(() => {
    engineRef.current = createEngine(selectedCase, mode);
    setSimState(engineRef.current.getState());
    setLastOutcome(null);
    setPaused(false);
    recordedRunRef.current = null;
  }, [mode, runId, selectedCase]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSimState((prev) => {
        if (screen !== 'simulation' || paused || prev.outcome !== 'in_progress') {
          return prev;
        }

        const nextTime = prev.now + 1;
        engineRef.current.tick(nextTime);
        return engineRef.current.getState();
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [paused, screen]);

  useEffect(() => {
    if (simState.outcome === 'in_progress') {
      return;
    }

    const recordId = `${runId}-${simState.outcome}`;
    if (recordedRunRef.current === recordId) {
      return;
    }

    recordedRunRef.current = recordId;
    setRecentRuns((runs) => [
      {
        id: recordId,
        caseTitle: selectedCase.metadata.title,
        outcome: simState.outcome,
        mode,
        duration: simState.now,
      },
      ...runs,
    ].slice(0, 4));
  }, [mode, runId, selectedCase.metadata.title, simState.now, simState.outcome]);

  function launchCase(): void {
    setScreen('simulation');
    setRunId((value) => value + 1);
  }

  function selectCase(caseId: string): void {
    const nextCase = CASES.find((caseDef) => caseDef.metadata.id === caseId) ?? DEFAULT_CASE;
    setSelectedCaseId(nextCase.metadata.id);
    setMode(nextCase.defaultMode);
  }

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

  if (screen === 'home') {
    return (
      <HomeScreen
        cases={CASES}
        selectedCase={selectedCase}
        selectedMode={mode}
        recentRuns={recentRuns}
        onSelectCase={selectCase}
        onSelectMode={setMode}
        onStart={launchCase}
      />
    );
  }

  return (
    <SimulationScreen
      selectedCase={selectedCase}
      mode={mode}
      simState={simState}
      lastOutcome={lastOutcome}
      debrief={debrief}
      paused={paused}
      onBack={() => setScreen('home')}
      onModeChange={setMode}
      onPauseToggle={() => setPaused((value) => !value)}
      onAdvance={advance}
      onRestart={() => setRunId((value) => value + 1)}
      onAction={dispatch}
    />
  );
}
