import { Button } from "../../components/Button";
import { StatusPill } from "../../components/StatusPill";
import { deriveActivity } from "../../lib/activity";
import type { Task } from "../../lib/types";
import { Timeline } from "../timeline/Timeline";
import styles from "./Workspace.module.css";

interface WorkspaceProps {
  task: Task;
  onSkip: () => void;
  onStop: () => void;
}

const SOURCE_LABEL: Record<Task["source"], string> = {
  real: "Live agent",
  demo: "Scripted demo",
  "generic-mock": "Simulated",
};

export function Workspace({ task, onSkip, onStop }: WorkspaceProps) {
  const activity = deriveActivity(task);
  const isActive = task.status === "running" || task.status === "pending";
  const canSkip = isActive && task.source !== "real";
  const canStop = isActive && task.source === "real";

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{task.title}</h1>
          <p className={styles.subtitle}>
            {task.repoName} <span className={styles.branch}>/ main</span>
            <span className={[styles.sourceTag, styles[`source-${task.source}`]].join(" ")}>
              {SOURCE_LABEL[task.source]}
              {task.llmMode === "scripted-fallback" && " · no API key"}
            </span>
          </p>
        </div>
        <div className={styles.headerRight}>
          <StatusPill state={activity.state} label={activity.label} className={styles.pill} />
          {canSkip && (
            <Button variant="ghost" size="md" onClick={onSkip}>
              Skip animation
            </Button>
          )}
          {canStop && (
            <Button variant="ghost" size="md" onClick={onStop}>
              Stop
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
