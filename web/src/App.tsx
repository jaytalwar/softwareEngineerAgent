import { Shell } from "./app/Shell";
import { useHashRoute } from "./app/useHashRoute";
import { useTasks } from "./app/useTasks";
import { NewTaskPanel } from "./features/dashboard/NewTaskPanel";
import { RunView } from "./features/run/RunView";
import { useOnline } from "./lib/useOnline";

export default function App() {
  const { tasks, isRefreshing, createTask } = useTasks();
  const [route, navigate] = useHashRoute();
  const isOffline = !useOnline();

  const match = /^\/task\/(.+)$/.exec(route);
  const activeTaskId = match ? match[1] : null;
  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) : undefined;

  function handleCreate(title: string) {
    const id = createTask(title);
    navigate(`/task/${id}`);
  }

  return (
    <Shell
      tasks={tasks}
      activeTaskId={activeTaskId}
      onSelectTask={(id) => navigate(`/task/${id}`)}
      onNewTask={() => navigate("/")}
      isOffline={isOffline}
      isRefreshing={isRefreshing}
    >
      {activeTask ? (
        <RunView task={activeTask} onRetry={handleCreate} />
      ) : (
        <NewTaskPanel onCreate={handleCreate} isOffline={isOffline} hasTasks={tasks.length > 0} />
      )}
    </Shell>
  );
}
