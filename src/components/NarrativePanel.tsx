import { Bell } from 'lucide-react';
import type { NarrativeItem } from '../engine/types';

interface NarrativePanelProps {
  now: number;
  narratives: NarrativeItem[];
  pendingAcknowledgement: boolean;
  onAcknowledge: () => void;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
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
        <div>
          <h2>Team Updates</h2>
          <p className="panel-subtitle">Latest case cues and handoff notes</p>
        </div>
        <span className="chip">Time {formatTime(now)}</span>
      </div>

      {pendingAcknowledgement ? (
        <div className="ack-box" data-testid="ack-box">
          <Bell size={20} />
          <p>Major update pending.</p>
          <button type="button" onClick={onAcknowledge} data-testid="ack-button">
            Acknowledge
          </button>
        </div>
      ) : null}

      <ol className="timeline" data-testid="narrative-feed">
        {narratives.length === 0 ? <li className="timeline-empty">No team updates yet.</li> : null}
        {[...narratives]
          .sort((a, b) => b.at - a.at)
          .map((entry) => (
            <li key={entry.id} className={`timeline-item timeline-${entry.priority}`}>
              <div className="timeline-meta">
                <span>{formatTime(entry.at)}</span>
                <span>{entry.priority}</span>
              </div>
              <p>{entry.message}</p>
            </li>
          ))}
      </ol>
    </div>
  );
}
