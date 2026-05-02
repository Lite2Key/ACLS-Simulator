import { useEffect, useMemo, useRef, useState } from 'react';
import type { SimulationState } from '../engine';
import type { SimulationEnvironmentState, SimulationPatientState } from '../engine/types';

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
  patient: SimulationPatientState;
  environment: SimulationEnvironmentState;
  traceTime: number;
  mutedLabel?: string;
}

const TRACE_WIDTH = 720;
const TRACE_HEIGHT = 96;
const TRACE_SECONDS = 8;
const TRACE_STEP = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function gaussian(phase: number, center: number, width: number, amplitude: number): number {
  const direct = Math.abs(phase - center);
  const wrapped = Math.min(direct, 1 - direct);
  return amplitude * Math.exp(-(wrapped * wrapped) / (2 * width * width));
}

function phaseAt(seconds: number, ratePerMinute: number): number {
  const period = 60 / Math.max(ratePerMinute, 1);
  return ((seconds % period) + period) / period;
}

function monitorNoise(seconds: number, amount: number): number {
  return (
    Math.sin(seconds * 31.7) * amount +
    Math.sin(seconds * 9.13 + 1.8) * amount * 0.45 +
    Math.sin(seconds * 55.1 + 0.2) * amount * 0.2
  );
}

function ecgSample(phase: number, patient: SimulationPatientState, seconds: number): number {
  const bradyDepth = patient.hr < 45 ? 2 : 0;
  const pWave = gaussian(phase, 0.17, 0.025, -5);
  const qWave = gaussian(phase, 0.352, 0.01, 9);
  const rWave = gaussian(phase, 0.38, 0.008, -31 - bradyDepth);
  const sWave = gaussian(phase, 0.405, 0.012, 16);
  const tWave = gaussian(phase, 0.64, 0.055, -8);
  return 52 + pWave + qWave + rWave + sWave + tWave + monitorNoise(seconds, 0.45);
}

function pacedEcgSample(patient: SimulationPatientState, environment: SimulationEnvironmentState, seconds: number): number {
  const pacerRate = environment.pacingRate ?? 70;
  const pacedPhase = phaseAt(seconds, pacerRate);
  const pacingSpike = gaussian(pacedPhase, 0.08, 0.003, -44) + gaussian(pacedPhase, 0.086, 0.003, 32);

  if (!environment.captureConfirmed) {
    return 52 + pacingSpike + monitorNoise(seconds, 0.5);
  }

  return pacingSpike + ecgSample(phaseAt(seconds - 0.1, patient.hr), patient, seconds) + gaussian(pacedPhase, 0.2, 0.018, -6);
}

function plethSample(phase: number, patient: SimulationPatientState, seconds: number): number {
  const perfusion = clamp((patient.systolicBP - 60) / 55, 0.32, 1.15);
  const upstroke = gaussian(phase, 0.18, 0.045, -28 * perfusion);
  const shoulder = gaussian(phase, 0.3, 0.075, -11 * perfusion);
  const notch = gaussian(phase, 0.43, 0.018, 7 * perfusion);
  const runoff = gaussian(phase, 0.58, 0.11, -5 * perfusion);
  return 66 + upstroke + shoulder + notch + runoff + monitorNoise(seconds, 0.65);
}

function alineSample(phase: number, patient: SimulationPatientState, seconds: number): number {
  const pulsePressure = clamp(patient.systolicBP - patient.diastolicBP, 18, 75);
  const amplitude = clamp(pulsePressure / 42, 0.55, 1.5);
  const systolicPeak = gaussian(phase, 0.16, 0.028, -36 * amplitude);
  const systolicShoulder = gaussian(phase, 0.24, 0.055, -14 * amplitude);
  const dicroticNotch = gaussian(phase, 0.39, 0.018, 9 * amplitude);
  const diastolicRunoff = gaussian(phase, 0.58, 0.16, -7 * amplitude);
  return 70 + systolicPeak + systolicShoulder + dicroticNotch + diastolicRunoff + monitorNoise(seconds, 0.5);
}

function etco2Sample(phase: number, patient: SimulationPatientState, seconds: number): number {
  const etco2 = patient.etco2 ?? 0;
  const height = clamp(etco2 / 45, 0.18, 1.2);

  if (phase < 0.14) {
    return 78 + monitorNoise(seconds, 0.25);
  }

  if (phase < 0.24) {
    const rise = (phase - 0.14) / 0.1;
    return 78 - rise * 41 * height + monitorNoise(seconds, 0.2);
  }

  if (phase < 0.78) {
    const plateau = (phase - 0.24) / 0.54;
    return 37 - plateau * 4 * height + monitorNoise(seconds, 0.18);
  }

  const fall = (phase - 0.78) / 0.08;
  return fall > 1 ? 78 + monitorNoise(seconds, 0.22) : 33 + fall * 45 * height + monitorNoise(seconds, 0.22);
}

function sampleWaveform(
  kind: WaveformKind,
  seconds: number,
  patient: SimulationPatientState,
  environment: SimulationEnvironmentState,
): number {
  const cardiacPhase = phaseAt(seconds, patient.hr);

  switch (kind) {
    case 'ecg-paced':
      return pacedEcgSample(patient, environment, seconds);
    case 'pleth':
      return plethSample(phaseAt(seconds - 0.18, patient.hr), patient, seconds);
    case 'aline':
      return alineSample(phaseAt(seconds - 0.06, patient.hr), patient, seconds);
    case 'etco2':
      return etco2Sample(phaseAt(seconds, patient.rr), patient, seconds);
    case 'ecg-brady':
    default:
      return ecgSample(cardiacPhase, patient, seconds);
  }
}

function buildWavePath(
  kind: WaveformKind,
  patient: SimulationPatientState,
  environment: SimulationEnvironmentState,
  traceTime: number,
): string {
  const points: string[] = [];

  for (let x = 0; x <= TRACE_WIDTH; x += TRACE_STEP) {
    const seconds = traceTime - TRACE_SECONDS + (x / TRACE_WIDTH) * TRACE_SECONDS;
    const y = clamp(sampleWaveform(kind, seconds, patient, environment), 5, TRACE_HEIGHT - 6);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  return `M${points.join(' L')}`;
}

function flatlinePath(traceTime: number): string {
  const points: string[] = [];

  for (let x = 0; x <= TRACE_WIDTH; x += TRACE_STEP) {
    const seconds = traceTime - TRACE_SECONDS + (x / TRACE_WIDTH) * TRACE_SECONDS;
    const y = 52 + monitorNoise(seconds, 0.18);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  return `M${points.join(' L')}`;
}

function useTraceClock(): number {
  const [traceTime, setTraceTime] = useState(0);

  useEffect(() => {
    const startedAt = performance.now();
    const intervalId = window.setInterval(() => {
      setTraceTime((performance.now() - startedAt) / 1000);
    }, 80);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return traceTime;
}

function WaveformChannel({
  label,
  value,
  color,
  active,
  kind,
  patient,
  environment,
  traceTime,
  mutedLabel,
}: WaveformChannelProps) {
  const path = useMemo(
    () => (active ? buildWavePath(kind, patient, environment, traceTime) : flatlinePath(traceTime)),
    [active, environment, kind, patient, traceTime],
  );
  const gradientId = `fade-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

  return (
    <div className={`wave-channel ${active ? '' : 'wave-channel-off'}`} data-testid={`wave-${label.toLowerCase()}`}>
      <div className="wave-label">
        <span style={{ color }}>{label}</span>
        <strong>{active ? value : (mutedLabel ?? 'STANDBY')}</strong>
      </div>
      <svg viewBox={`0 0 ${TRACE_WIDTH} ${TRACE_HEIGHT}`} role="img" aria-label={`${label} waveform`}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="1">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="9%" stopColor={color} stopOpacity="0.55" />
            <stop offset="18%" stopColor={color} />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <g className="monitor-grid-lines">
          <path d="M0 24 H720 M0 48 H720 M0 72 H720 M60 0 V96 M120 0 V96 M180 0 V96 M240 0 V96 M300 0 V96 M360 0 V96 M420 0 V96 M480 0 V96 M540 0 V96 M600 0 V96 M660 0 V96" />
        </g>
        <path className="calibration-pulse" d="M10 72 H22 V32 H42 V72 H54" />
        {active ? (
          <>
            <path className="wave-glow" d={path} stroke={color} />
            <path className="wave-path" d={path} stroke={`url(#${gradientId})`} />
            <line className="trace-cursor" x1={TRACE_WIDTH - 8} y1="7" x2={TRACE_WIDTH - 8} y2={TRACE_HEIGHT - 7} />
          </>
        ) : (
          <path className="wave-flat" d={path} />
        )}
      </svg>
    </div>
  );
}

function usePreviousPatient(patient: SimulationPatientState): SimulationPatientState {
  const previousRef = useRef(patient);

  useEffect(() => {
    previousRef.current = patient;
  }, [patient]);

  return previousRef.current;
}

function trendFor(current: number | null, previous: number | null): 'up' | 'down' | 'same' {
  if (current === null || previous === null || Math.abs(current - previous) < 1) {
    return 'same';
  }

  return current > previous ? 'up' : 'down';
}

function trendGlyph(trend: 'up' | 'down' | 'same'): string {
  if (trend === 'up') {
    return 'UP';
  }

  if (trend === 'down') {
    return 'DN';
  }

  return 'ST';
}

interface NumericTileProps {
  label: string;
  value: string | number;
  colorClass: string;
  trend: 'up' | 'down' | 'same';
}

function NumericTile({ label, value, colorClass, trend }: NumericTileProps) {
  return (
    <div className={`numeric-tile ${colorClass} ${trend !== 'same' ? 'numeric-changed' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <em className={`trend trend-${trend}`}>{trendGlyph(trend)}</em>
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

  if (state.patient.rhythm === 'sinus_tachycardia') {
    return 'SINUS TACH';
  }

  return 'SINUS BRADY';
}

export function MonitorPanel({ state }: MonitorPanelProps) {
  const { patient, environment } = state;
  const traceTime = useTraceClock();
  const previousPatient = usePreviousPatient(patient);
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
            patient={patient}
            environment={environment}
            traceTime={traceTime}
            mutedLabel="LEADS OFF"
          />
          <WaveformChannel
            label="PLETH"
            value={`${patient.spo2}%`}
            color="#54a9ff"
            active={plethActive}
            kind="pleth"
            patient={patient}
            environment={environment}
            traceTime={traceTime}
            mutedLabel="NO PULSE OX"
          />
          <WaveformChannel
            label="A-LINE"
            value={`${patient.systolicBP}/${patient.diastolicBP}`}
            color="#ff3f3f"
            active={alineActive}
            kind="aline"
            patient={patient}
            environment={environment}
            traceTime={traceTime}
            mutedLabel="NOT ZEROED"
          />
          <WaveformChannel
            label="EtCO2"
            value={patient.etco2 === null ? '-- mmHg' : `${patient.etco2} mmHg`}
            color="#ffd84d"
            active={etco2Active}
            kind="etco2"
            patient={patient}
            environment={environment}
            traceTime={traceTime}
            mutedLabel="NO SAMPLE"
          />
        </div>

        <aside className="numeric-stack" aria-label="numeric vitals">
          <NumericTile
            label="HR"
            value={ecgActive ? patient.hr : '--'}
            colorClass="numeric-green"
            trend={trendFor(patient.hr, previousPatient.hr)}
          />
          <NumericTile
            label="SpO2"
            value={plethActive ? patient.spo2 : '--'}
            colorClass="numeric-blue"
            trend={trendFor(patient.spo2, previousPatient.spo2)}
          />
          <NumericTile
            label="BP"
            value={`${patient.systolicBP}/${patient.diastolicBP}`}
            colorClass="numeric-red"
            trend={trendFor(patient.systolicBP, previousPatient.systolicBP)}
          />
          <NumericTile
            label="EtCO2"
            value={etco2Active && patient.etco2 !== null ? patient.etco2 : '--'}
            colorClass="numeric-yellow"
            trend={trendFor(patient.etco2, previousPatient.etco2)}
          />
        </aside>
      </div>

      <div className="monitor-footer">
        <span className={environment.monitorLeadsAttached ? 'status-on' : ''}>
          {environment.monitorLeadsAttached ? 'Leads On' : 'Leads Off'}
        </span>
        <span className={environment.defibPadsAttached ? 'status-on' : ''}>
          {environment.defibPadsAttached ? 'Pads On' : 'Pads Off'}
        </span>
        <span className={environment.syncEnabled ? 'status-on' : ''}>
          {environment.syncEnabled ? 'Sync On' : 'Sync Off'}
        </span>
        <span className={environment.pacingModeActive ? 'status-on' : ''}>
          {environment.pacingModeActive ? 'Pacer Armed' : 'Pacer Standby'}
        </span>
        <span className={environment.captureConfirmed ? 'status-on' : 'status-waiting'}>
          {environment.captureConfirmed ? 'Capture Confirmed' : 'Capture Needed'}
        </span>
        {patient.temperatureC ? <span>Temp {patient.temperatureC.toFixed(1)}C</span> : null}
        {patient.lactate !== null && patient.lactate !== undefined ? <span>Lactate {patient.lactate.toFixed(1)}</span> : null}
        <span>{patient.statusText}</span>
      </div>
    </div>
  );
}
