import { Button } from "../../components/Button";
import { CloseIcon, PlusIcon, SettingsIcon, SparkleIcon } from "../../components/icons";
import { Skeleton } from "../../components/Skeleton";
import { ThemeToggle } from "../../components/ThemeToggle";
import type { ThemePreference } from "../useTheme";
import type { RepoNode, Task } from "../../lib/types";
import { RepoTree } from "./RepoTree";
import { TaskListItem } from "./TaskListItem";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  tasks: Task[];
  activeTaskId: string | null;
  onSelectTask: (id: string) => void;
  onNewTask: () => void;
  onRunDemo: () => void;
  repoTree: RepoNode | null;
  activeFile?: string;
  theme: ThemePreference;
  onToggleTheme: () => void;
  isLoading: boolean;
  offline: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  tasks,
  activeTaskId,
  onSelectTask,
  onNewTask,
  onRunDemo,
  repoTree,
  activeFile,
  theme,
  onToggleTheme,
  isLoading,
  offline,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  return (
    <>
      {mobileOpen && <div className={styles.scrim} onClick={onCloseMobile} aria-hidden="true" />}
      <aside className={[styles.sidebar, mobileOpen ? styles.open : ""].filter(Boolean).join(" ")}>
        <div className={styles.header}>
          <div className={styles.wordmark}>
            <span className={styles.mark} aria-hidden="true">
              {"</>"}
            </span>
            SWE-Agent
          </div>
          <button
            type="button"
            className={styles.closeMobile}
            onClick={onCloseMobile}
            aria-label="Close sidebar"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <div className={styles.actions}>
          <Button variant="primary" onClick={onNewTask} disabled={offline} className={styles.fullWidth}>
            <PlusIcon size={13} /> New Task
          </Button>
          <Button variant="secondary" onClick={onRunDemo} disabled={offline} className={styles.fullWidth}>
            <SparkleIcon size={13} /> Run Demo
          </Button>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>Repository</p>
          {isLoading ? (
            <div className={styles.treeSkeleton}>
              <Skeleton width="70%" height="0.85em" />
              <Skeleton width="55%" height="0.85em" />
              <Skeleton width="60%" height="0.85em" />
            </div>
          ) : repoTree ? (
            <RepoTree node={repoTree} activeFile={activeFile} />
          ) : (
            <p className={styles.emptyHint}>
              Connect a repository to give the agent a codebase to work with.
            </p>
          )}
        </div>

        <div className={[styles.section, styles.grow].join(" ")}>
          <p className={styles.sectionLabel}>Recent Tasks</p>
          {isLoading ? (
            <div className={styles.treeSkeleton}>
              <Skeleton width="80%" height="0.85em" />
              <Skeleton width="65%" height="0.85em" />
            </div>
          ) : tasks.length === 0 ? (
            <p className={styles.emptyHint}>Completed agent runs will appear here.</p>
          ) : (
            <div className={styles.taskList}>
              {tasks.map((task) => (
                <TaskListItem
                  key={task.id}
                  task={task}
                  active={task.id === activeTaskId}
                  onSelect={() => onSelectTask(task.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.settingsButton}>
            <SettingsIcon size={14} /> Settings
          </button>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </aside>
    </>
  );
}
