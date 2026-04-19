import type { SimulationState } from '../engine';

interface MonitorPanelProps {
  state: SimulationState;
}

function flagLabel(value: boolean): string {
  return value ? 'Yes' : 'No';
}

export function MonitorPanel({ state }: MonitorPanelProps) {
  const { patient, environment } = state;

  return (
    <div>
      <div className="panel-header-row">
        <h2>Monitor and Status</h2>
        <span className={`chip chip-${state.outcome}`}>{state.outcome.replace('_', ' ')}</span>
      </div>

      <div className="vitals-grid" data-testid="monitor-panel">
        <div>
          <span>Rhythm</span>
          <strong>{patient.rhythm}</strong>
        </div>
        <div>
          <span>HR</span>
          <strong>{patient.hr} bpm</strong>
        </div>
        <div>
          <span>BP</span>
          <strong>
            {patient.systolicBP}/{patient.diastolicBP}
          </strong>
        </div>
        <div>
          <span>SpO2</span>
          <strong>{patient.spo2}%</strong>
        </div>
        <div>
          <span>Mental Status</span>
          <strong>{patient.mentalStatus}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>{patient.statusText}</strong>
        </div>
      </div>

      <div className="status-flags">
        <h3>Setup Flags</h3>
        <ul>
          <li>On ED bed: {flagLabel(environment.onBed)}</li>
          <li>Leads attached: {flagLabel(environment.monitorLeadsAttached)}</li>
          <li>Pads attached: {flagLabel(environment.defibPadsAttached)}</li>
          <li>Vascular access: {flagLabel(environment.ivAccess || environment.ioAccess)}</li>
          <li>Sync mode: {flagLabel(environment.syncEnabled)}</li>
          <li>Pacing mode: {flagLabel(environment.pacingModeActive)}</li>
          <li>
            Pacing settings: rate {environment.pacingRate ?? '-'} / current {environment.pacingCurrentMa ?? '-'}
          </li>
          <li>Capture confirmed: {flagLabel(environment.captureConfirmed)}</li>
        </ul>
      </div>
    </div>
  );
}
