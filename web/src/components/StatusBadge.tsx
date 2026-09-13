import type { TaskStatus } from "../lib/types";
import styles from "./StatusBadge.module.css";

const LABEL: Record<TaskStatus, string> = {
  pending: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <span className={[styles.badge, styles[status], className].filter(Boolean).join(" ")}>
      <span className={styles.dot} aria-hidden="true" />
      {LABEL[status]}
    </span>
  );
}
