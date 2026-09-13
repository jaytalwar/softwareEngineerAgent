import type { ReactNode } from "react";
import { Button } from "../components/Button";
import { OfflineIcon, PlusIcon } from "../components/icons";
import { StatusBadge } from "../components/StatusBadge";
import { formatRelativeTime } from "../lib/format";
import type { Task } from "../lib/types";
import styles from "./Shell.module.css";

interface ShellProps {
  tasks: Task[];
  activeTaskId: string | null;
  onSelectTask: (id: string) => void;
  onNewTask: () => void;
  isOffline: boolean;
  isRefreshing: boolean;
  children: ReactNode;
}

export function Shell({
  tasks,
  activeTaskId,
  onSelectTask,
  onNewTask,
  isOffline,
  isRefreshing,
  children,
}: ShellProps) {
  return (
    <div className={styles.page}>
      {isOffline && (
        <div className={styles.offlineBanner} role="status">
          <OfflineIcon size={13} />
          Offline — showing cached data. New tasks can&apos;t be started right now.
        </div>
      )}

      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.wordmark}>
            <span className={styles.wordmarkMark} aria-hidden="true" />
            ORBIT
          </div>
          <span className={isRefreshing ? styles.syncing : styles.synced}>
            {isRefreshing ? "Syncing…" : "Synced"}
          </span>
        </header>

        <nav className={styles.rail} aria-label="Tasks">
          <Button
            variant="primary"
            onClick={onNewTask}
            disabled={isOffline}
            className={styles.newTaskButton}
          >
            <PlusIcon /> New Task
          </Button>

          {tasks.length === 0 ? (
            <p className={styles.railEmpty}>No tasks yet.</p>
          ) : (
            <ul className={styles.railList}>
              {tasks.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    className={[styles.railItem, task.id === activeTaskId ? styles.railItemActive : ""]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => onSelectTask(task.id)}
                    aria-current={task.id === activeTaskId ? "page" : undefined}
                  >
                    <span className={styles.railItemTitle}>{task.title}</span>
                    <span className={styles.railItemMeta}>
                      <StatusBadge status={task.status} />
                      <span className={styles.railItemTime}>{formatRelativeTime(task.updatedAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>

        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
