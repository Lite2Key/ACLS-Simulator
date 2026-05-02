import { ClipboardList } from 'lucide-react';
import type { ActiveTask, ActionType } from '../engine';

interface TaskQueuePanelProps {
  now: number;
  tasks: ActiveTask[];
}

function taskRole(action: ActionType): string {
  switch (action) {
    case 'establish_iv':
    case 'establish_io':
    case 'draw_blood_cultures':
      return 'RN';
    case 'start_oxygen':
    case 'attach_capnography':
      return 'RT';
    case 'attach_monitor_leads':
    case 'attach_defib_pads':
    case 'place_arterial_line':
      return 'Tech';
    case 'send_lactate':
      return 'Lab';
    case 'start_ems_handoff':
    case 'start_transfer_to_bed':
    default:
      return 'Team';
  }
}

function taskProgress(task: ActiveTask, now: number): number {
  const total = Math.max(1, task.endsAt - task.startedAt);
  const elapsed = Math.min(total, Math.max(0, now - task.startedAt));
  return Math.round((elapsed / total) * 100);
}

export function TaskQueuePanel({ now, tasks }: TaskQueuePanelProps) {
  const sorted = [...tasks].sort((a, b) => a.endsAt - b.endsAt);

  return (
    <div>
      <div className="panel-header-row">
        <div>
          <h2>Active Workflow</h2>
          <p className="panel-subtitle">Parallel tasks in progress</p>
        </div>
        <span className="chip">{sorted.length}</span>
      </div>

      <ul className="task-list" data-testid="task-queue">
        {sorted.length === 0 ? (
          <li className="task-empty">
            <ClipboardList size={18} />
            <span>No active tasks.</span>
          </li>
        ) : null}
        {sorted.map((task) => {
          const remaining = Math.max(0, task.endsAt - now);
          const progress = taskProgress(task, now);

          return (
            <li key={task.id} className="task-row">
              <div className="task-row-top">
                <p>{task.label}</p>
                <strong>{remaining}s</strong>
              </div>
              <div className="task-progress" aria-label={`${task.label} ${progress}% complete`}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <div className="task-row-meta">
                <span>In progress</span>
                <span>{taskRole(task.action)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
