import { useState } from "react";
import { AppShell } from "./app/AppShell";
import { useHashRoute } from "./app/useHashRoute";
import { useTasks } from "./app/useTasks";
import { useTheme } from "./app/useTheme";
import { Landing } from "./features/landing/Landing";
import { Workspace } from "./features/workspace/Workspace";
import { ACME_STORE_TREE } from "./lib/repoTree";
import { useOnline } from "./lib/useOnline";

const DEMO_TASK_TITLE = "Fix the authentication bug and make sure all tests pass.";

export default function App() {
  const { theme, toggle } = useTheme();
  const { tasks, isRefreshing, startTask, skipTask } = useTasks();
  const [route, navigate] = useHashRoute();
  const isOffline = !useOnline();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const match = /^\/task\/(.+)$/.exec(route);
  const activeTaskId = match ? match[1] : null;
  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) : undefined;

  const hasConnectedRepo = tasks.length > 0;
  const lastTouch = activeTask ? [...activeTask.timeline].reverse().find((e) => e.fileContent || e.diff) : undefined;
  const activeFile = lastTouch?.fileContent?.path ?? lastTouch?.diff?.path;

  function handleStart(title: string, isDemo: boolean) {
    const id = startTask(title, isDemo);
    navigate(`/task/${id}`);
    setSidebarOpen(false);
  }

  return (
    <AppShell
      tasks={tasks}
      activeTaskId={activeTaskId}
      activeTask={activeTask}
      onSelectTask={(id) => {
        navigate(`/task/${id}`);
        setSidebarOpen(false);
      }}
      onNewTask={() => {
        navigate("/");
        setSidebarOpen(false);
      }}
      onRunDemo={() => handleStart(DEMO_TASK_TITLE, true)}
      repoTree={hasConnectedRepo ? ACME_STORE_TREE : null}
      activeFile={activeFile}
      theme={theme}
      onToggleTheme={toggle}
      isLoading={isRefreshing}
      offline={isOffline}
      sidebarOpen={sidebarOpen}
      onCloseSidebar={() => setSidebarOpen(false)}
      onOpenSidebar={() => setSidebarOpen(true)}
      inspectorOpen={inspectorOpen}
      onCloseInspector={() => setInspectorOpen(false)}
      onOpenInspector={() => setInspectorOpen(true)}
    >
      {activeTask ? (
        <Workspace task={activeTask} onSkip={() => skipTask(activeTask.id)} />
      ) : (
        <Landing
          onSubmit={(title) => handleStart(title, false)}
          onRunDemo={() => handleStart(DEMO_TASK_TITLE, true)}
          disabled={isOffline}
          disabledReason={isOffline ? "Reconnect to start a new task." : undefined}
        />
      )}
    </AppShell>
  );
}
