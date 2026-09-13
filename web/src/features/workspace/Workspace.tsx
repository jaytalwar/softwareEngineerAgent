import { Button } from "../../components/Button";
import { StatusPill } from "../../components/StatusPill";
import { deriveActivity } from "../../lib/activity";
import type { Task } from "../../lib/types";
import { Timeline } from "../timeline/Timeline";
import styles from "./Workspace.module.css";

interface WorkspaceProps {
  task: Task;
  onSkip: () => void;
}

export function Workspace({ task, onSkip }: WorkspaceProps) {
  const activity = deriveActivity(task);
  const isActive = task.status === "running" || task.status === "pending";

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{task.title}</h1>
          <p className={styles.subtitle}>
            {task.repoName} <span className={styles.branch}>/ main</span>
          </p>
        </div>
        <div className={styles.headerRight}>
          <StatusPill state={activity.state} label={activity.label} className={styles.pill} />
          {isActive && (
            <Button variant="ghost" size="md" onClick={onSkip}>
              Skip animation
            </Button>
          )}
        </div>
      </header>

      <div className={styles.scroll}>
        <Timeline timeline={task.timeline} />
      </div>
    </div>
  );
}
