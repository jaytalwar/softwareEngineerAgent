import type { ReactNode } from "react";
import { MenuIcon, PanelIcon } from "../components/icons";
import type { RepoNode, Task } from "../lib/types";
import { Inspector } from "./inspector/Inspector";
import { SettingsModal } from "./SettingsModal";
import { Sidebar } from "./sidebar/Sidebar";
import type { ThemePreference } from "./useTheme";
import styles from "./AppShell.module.css";

interface AppShellProps {
  tasks: Task[];
  activeTaskId: string | null;
  activeTask: Task | undefined;
  onSelectTask: (id: string) => void;
  onNewTask: () => void;
  onRunDemo: () => void;
  repoTree: RepoNode | null;
  activeFile?: string;
  theme: ThemePreference;
  onToggleTheme: () => void;
  isLoading: boolean;
  offline: boolean;
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  onOpenSidebar: () => void;
  inspectorOpen: boolean;
  onCloseInspector: () => void;
  onOpenInspector: () => void;
  settingsOpen: boolean;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  children: ReactNode;
}

export function AppShell({
  tasks,
  activeTaskId,
  activeTask,
  onSelectTask,
  onNewTask,
  onRunDemo,
  repoTree,
  activeFile,
  theme,
  onToggleTheme,
  isLoading,
  offline,
  sidebarOpen,
  onCloseSidebar,
  onOpenSidebar,
  inspectorOpen,
  onCloseInspector,
  onOpenInspector,
  settingsOpen,
  onOpenSettings,
  onCloseSettings,
  children,
}: AppShellProps) {
  return (
    <div className={styles.shell}>
      <Sidebar
        tasks={tasks}
        activeTaskId={activeTaskId}
        onSelectTask={onSelectTask}
        onNewTask={onNewTask}
        onRunDemo={onRunDemo}
        repoTree={repoTree}
        activeFile={activeFile}
        theme={theme}
        onToggleTheme={onToggleTheme}
        isLoading={isLoading}
        offline={offline}
        mobileOpen={sidebarOpen}
        onCloseMobile={onCloseSidebar}
        onOpenSettings={onOpenSettings}
      />

      <div className={styles.main}>
        <div className={styles.mobileBar}>
          <button
            type="button"
            className={styles.mobileButton}
            onClick={onOpenSidebar}
            aria-label="Open sidebar"
          >
            <MenuIcon size={18} />
          </button>
          <span className={styles.mobileWordmark}>SWE-Agent</span>
          {activeTask ? (
            <button
              type="button"
              className={styles.mobileButton}
              onClick={onOpenInspector}
              aria-label="Open inspector"
            >
              <PanelIcon size={16} />
            </button>
          ) : (
            <span className={styles.mobileButton} aria-hidden="true" />
          )}
        </div>
        {children}
      </div>

      <Inspector task={activeTask} open={inspectorOpen} onClose={onCloseInspector} />
      {settingsOpen && <SettingsModal onClose={onCloseSettings} />}
    </div>
  );
}
