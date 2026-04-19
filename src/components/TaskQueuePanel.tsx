import type { ActiveTask } from '../engine';

interface TaskQueuePanelProps {
  now: number;
  tasks: ActiveTask[];
}

export function TaskQueuePanel({ now, tasks }: TaskQueuePanelProps) {
  const sorted = [...tasks].sort((a, b) => a.endsAt - b.endsAt);

  return (
    <div>
      <div className="panel-header-row">
        <h2>Task Queue</h2>
        <span className="chip">Parallel workflows</span>
      </div>

      <ul className="task-list" data-testid="task-queue">
        {sorted.length === 0 ? <li>No active tasks.</li> : null}
        {sorted.map((task) => {
          const remaining = Math.max(0, task.endsAt - now);
          return (
            <li key={task.id}>
              <p>{task.label}</p>
              <span>{remaining}s remaining</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
