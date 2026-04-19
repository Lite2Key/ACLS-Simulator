import type { SimulationState } from '../engine';

interface MonitorPanelProps {
  state: SimulationState;
}

type WaveformKind = 'ecg-brady' | 'ecg-paced' | 'pleth' | 'aline' | 'etco2';

interface WaveformChannelProps {
  label: string;
  value: string;
  color: string;
  active: boolean;
  kind: WaveformKind;
  mutedLabel?: string;
}

function buildWavePath(kind: WaveformKind): string {
  switch (kind) {
    case 'ecg-paced':
      return 'M0 46 L18 46 L20 8 L22 46 L48 46 L51 28 L55 64 L60 46 L112 46 L114 8 L116 46 L143 46 L146 28 L150 64 L155 46 L208 46 L210 8 L212 46 L240 46 L243 28 L247 64 L252 46 L300 46';
    case 'pleth':
      return 'M0 58 C10 56 14 52 18 42 C23 25 32 24 38 40 C44 58 55 62 70 57 C86 52 90 47 96 36 C104 20 116 24 121 43 C126 61 143 63 160 56 C176 49 182 45 188 35 C197 19 208 25 213 44 C218 61 238 62 254 55 C272 48 278 44 286 35 C294 23 302 27 310 43';
    case 'aline':
      return 'M0 64 C8 62 13 58 17 47 L23 18 C25 9 34 9 37 18 L43 44 C49 66 73 70 91 60 C104 54 112 50 122 51 C135 52 145 66 163 62 C173 60 178 55 183 44 L190 18 C192 9 201 9 204 18 L210 45 C216 67 240 70 258 60 C272 52 283 50 300 60';
    case 'etco2':
      return 'M0 72 L18 72 L18 50 C18 38 24 28 38 28 L92 28 C102 28 110 36 110 50 L110 72 L142 72 L142 50 C142 38 148 28 162 28 L216 28 C226 28 234 36 234 50 L234 72 L300 72';
    case 'ecg-brady':
    default:
      return 'M0 48 L40 48 L44 36 L48 62 L53 48 L122 48 L126 36 L130 62 L135 48 L205 48 L209 36 L213 62 L218 48 L300 48';
  }
}

function WaveformChannel({ label, value, color, active, kind, mutedLabel }: WaveformChannelProps) {
  const path = buildWavePath(kind);

  return (
    <div className={`wave-channel ${active ? '' : 'wave-channel-off'}`} data-testid={`wave-${label.toLowerCase()}`}>
      <div className="wave-label">
        <span style={{ color }}>{label}</span>
        <strong>{active ? value : (mutedLabel ?? 'STANDBY')}</strong>
      </div>
      <svg viewBox="0 0 300 86" role="img" aria-label={`${label} waveform`}>
        <defs>
          <linearGradient id={`fade-${label}`} x1="0" x2="1">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="12%" stopColor={color} />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <g className="monitor-grid-lines">
          <path d="M0 22 H300 M0 48 H300 M0 74 H300 M60 0 V86 M120 0 V86 M180 0 V86 M240 0 V86" />
        </g>
        {active ? (
          <path
            className="wave-path"
            d={path}
            stroke={`url(#fade-${label})`}
            style={{ animationDuration: kind === 'ecg-brady' ? '3.5s' : '2.4s' }}
          />
        ) : (
          <path className="wave-flat" d="M0 48 H300" />
        )}
      </svg>
    </div>
  );
}

function rhythmLabel(state: SimulationState): string {
  if (!state.environment.monitorLeadsAttached) {
    return 'LEADS OFF';
  }

  if (state.patient.rhythm === 'paced') {
    return 'PACED';
  }

  return 'SINUS BRADY';
}

export function MonitorPanel({ state }: MonitorPanelProps) {
  const { patient, environment } = state;
  const ecgActive = environment.monitorLeadsAttached;
  const plethActive = environment.monitorLeadsAttached;
  const alineActive = environment.arterialLine;
  const etco2Active = environment.capnography;
  const ecgKind: WaveformKind = patient.rhythm === 'paced' ? 'ecg-paced' : 'ecg-brady';

  return (
    <div className="monitor-shell" data-testid="monitor-panel">
      <div className="monitor-topline">
        <span>ED MONITOR</span>
        <span>{rhythmLabel(state)}</span>
        <span>{state.now}s</span>
      </div>

      <div className="monitor-body">
        <div className="wave-stack">
          <WaveformChannel
            label="ECG"
            value={`${patient.hr} bpm`}
            color="#7cff5b"
            active={ecgActive}
            kind={ecgKind}
            mutedLabel="LEADS OFF"
          />
          <WaveformChannel
            label="PLETH"
            value={`${patient.spo2}%`}
            color="#54a9ff"
            active={plethActive}
            kind="pleth"
            mutedLabel="NO PULSE OX"
          />
          <WaveformChannel
            label="A-LINE"
            value={`${patient.systolicBP}/${patient.diastolicBP}`}
            color="#ff3f3f"
            active={alineActive}
            kind="aline"
            mutedLabel="NOT ZEROED"
          />
          <WaveformChannel
            label="EtCO2"
            value={patient.etco2 === null ? '-- mmHg' : `${patient.etco2} mmHg`}
            color="#ffd84d"
            active={etco2Active}
            kind="etco2"
            mutedLabel="NO SAMPLE"
          />
        </div>

        <aside className="numeric-stack" aria-label="numeric vitals">
          <div className="numeric-tile numeric-green">
            <span>HR</span>
            <strong>{ecgActive ? patient.hr : '--'}</strong>
          </div>
          <div className="numeric-tile numeric-blue">
            <span>SpO2</span>
            <strong>{plethActive ? patient.spo2 : '--'}</strong>
          </div>
          <div className="numeric-tile numeric-red">
            <span>BP</span>
            <strong>
              {alineActive ? `${patient.systolicBP}/${patient.diastolicBP}` : `${patient.systolicBP}/${patient.diastolicBP}`}
            </strong>
          </div>
          <div className="numeric-tile numeric-yellow">
            <span>EtCO2</span>
            <strong>{etco2Active && patient.etco2 !== null ? patient.etco2 : '--'}</strong>
          </div>
        </aside>
      </div>

      <div className="monitor-footer">
        <span className={environment.defibPadsAttached ? 'status-on' : ''}>Pads</span>
        <span className={environment.syncEnabled ? 'status-on' : ''}>Sync</span>
        <span className={environment.pacingModeActive ? 'status-on' : ''}>Pacer</span>
        <span className={environment.captureConfirmed ? 'status-on' : ''}>Capture</span>
        <span>{patient.statusText}</span>
      </div>
    </div>
  );
}
