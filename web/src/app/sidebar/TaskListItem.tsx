import { CheckIcon, CloseIcon } from "../../components/icons";
import type { Task } from "../../lib/types";
import styles from "./TaskListItem.module.css";

interface TaskListItemProps {
  task: Task;
  active: boolean;
  onSelect: () => void;
}

export function TaskListItem({ task, active, onSelect }: TaskListItemProps) {
  return (
    <button
      type="button"
      className={[styles.item, active ? styles.active : ""].filter(Boolean).join(" ")}
      onClick={onSelect}
      aria-current={active ? "page" : undefined}
    >
      <span className={styles.statusIcon}>
        {task.status === "succeeded" && <CheckIcon size={12} className={styles.success} />}
        {task.status === "failed" && <CloseIcon size={11} className={styles.failed} />}
        {(task.status === "running" || task.status === "pending") && (
          <span className={styles.runningDot} aria-hidden="true" />
        )}
        {task.status === "cancelled" && <span className={styles.cancelledDot} aria-hidden="true" />}
      </span>
      <span className={styles.title}>{task.title}</span>
    </button>
  );
}
