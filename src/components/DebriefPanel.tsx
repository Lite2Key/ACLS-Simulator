import type { DebriefReport } from '../engine';

interface DebriefPanelProps {
  debrief: DebriefReport;
  teachingPoints: string[];
  outcome: 'in_progress' | 'stabilized' | 'deteriorated';
}

function metricValue(value: number | null): string {
  return value === null ? 'N/A' : `${value}s`;
}

function isCountMetric(metricKey: string): boolean {
  return metricKey.toLowerCase().includes('count');
}

export function DebriefPanel({ debrief, teachingPoints, outcome }: DebriefPanelProps) {
  return (
    <div>
      <div className="panel-header-row">
        <h2>Debrief</h2>
        <span className={`chip chip-${outcome}`}>Outcome: {outcome.replace('_', ' ')}</span>
      </div>

      <div className="debrief-grid">
        <section>
          <h3>Key Metrics</h3>
          <ul>
            {Object.entries(debrief.metricLabels).map(([metricKey, label]) => (
              <li key={metricKey}>
                {label}: {isCountMetric(metricKey) ? (debrief.metrics[metricKey] ?? 0) : metricValue(debrief.metrics[metricKey] ?? null)}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3>Critical Misses</h3>
          <ul>
            {debrief.criticalMisses.length === 0 ? <li>None recorded.</li> : null}
            {debrief.criticalMisses.map((miss) => (
              <li key={miss}>{miss}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3>Good Decisions</h3>
          <ul>
            {debrief.goodDecisions.length === 0 ? <li>None recorded yet.</li> : null}
            {debrief.goodDecisions.map((decision) => (
              <li key={decision}>{decision}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3>Teaching Points</h3>
          <ul>
            {teachingPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>
      </div>

      <section>
        <h3>Timeline</h3>
        <ol className="timeline timeline-debrief" data-testid="debrief-timeline">
          {[...debrief.timeline]
            .sort((a, b) => a.at - b.at)
            .map((entry, index) => (
              <li key={`${entry.at}-${entry.message}-${index}`}>
                <div className="timeline-meta">
                  <span>{entry.type.toUpperCase()}</span>
                  <span>{entry.at}s</span>
                </div>
                <p>{entry.message}</p>
              </li>
            ))}
        </ol>
      </section>
    </div>
  );
}
