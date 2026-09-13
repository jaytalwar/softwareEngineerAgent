import { Button } from "../../components/Button";
import { StatusBadge } from "../../components/StatusBadge";
import { formatCost, formatDuration, formatTokens } from "../../lib/format";
import type { Task } from "../../lib/types";
import { Timeline } from "./Timeline";
import styles from "./RunView.module.css";

interface RunViewProps {
  task: Task;
  onRetry: (title: string) => void;
}

export function RunView({ task, onRetry }: RunViewProps) {
  const lastFinished = task.timeline.at(-1)?.finishedAt;
  const elapsed = (lastFinished ?? task.updatedAt) - task.createdAt;
  const isActive = task.status === "running" || task.status === "pending";

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>{task.title}</h1>
          <StatusBadge status={task.status} />
        </div>

        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>Iteration</dt>
            <dd>
              {task.iteration} / {task.budgetMaxIterations}
            </dd>
          </div>
          <div className={styles.stat}>
            <dt>Tokens</dt>
            <dd>{formatTokens(task.totalTokens)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Cost</dt>
            <dd>{formatCost(task.totalCostUsd)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Elapsed</dt>
            <dd>{formatDuration(elapsed)}</dd>
          </div>
        </dl>

        <div className={styles.budgetBar} role="progressbar" aria-label="Iteration budget used">
          <div
            className={styles.budgetFill}
            style={{ width: `${Math.min(100, (task.iteration / task.budgetMaxIterations) * 100)}%` }}
          />
        </div>
      </header>

      <Timeline timeline={task.timeline} isActive={isActive} />

      {task.status === "succeeded" && (
        <div className={[styles.banner, styles.bannerSuccess].join(" ")}>
          <strong>Accepted.</strong>&nbsp;All tests pass.
        </div>
      )}

      {task.status === "failed" && (
        <div className={[styles.banner, styles.bannerFailed].join(" ")}>
          <span>
            <strong>Stopped.</strong> {task.failureReason}
          </span>
          <Button variant="secondary" onClick={() => onRetry(task.title)} className={styles.retryButton}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
