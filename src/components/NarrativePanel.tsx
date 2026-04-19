import type { NarrativeItem } from '../engine/types';

interface NarrativePanelProps {
  now: number;
  narratives: NarrativeItem[];
  pendingAcknowledgement: boolean;
  onAcknowledge: () => void;
}

export function NarrativePanel({
  now,
  narratives,
  pendingAcknowledgement,
  onAcknowledge,
}: NarrativePanelProps) {
  return (
    <div>
      <div className="panel-header-row">
        <h2>Narrative and Team Updates</h2>
        <span className="chip">Time {now}s</span>
      </div>

      {pendingAcknowledgement ? (
        <div className="ack-box" data-testid="ack-box">
          <p>Major update pending. Acknowledge before more hints appear.</p>
          <button type="button" onClick={onAcknowledge} data-testid="ack-button">
            Acknowledge
          </button>
        </div>
      ) : null}

      <ol className="timeline" data-testid="narrative-feed">
        {narratives.length === 0 ? <li>No narrative events yet.</li> : null}
        {[...narratives]
          .sort((a, b) => b.at - a.at)
          .map((entry) => (
            <li key={entry.id}>
              <div className="timeline-meta">
                <span>{entry.priority.toUpperCase()}</span>
                <span>{entry.at}s</span>
              </div>
              <p>{entry.message}</p>
            </li>
          ))}
      </ol>
    </div>
  );
}
