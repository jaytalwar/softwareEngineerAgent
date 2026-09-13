import { useCallback, useEffect, useRef, useState } from "react";
import { buildDemoScenario, buildGenericScenario } from "../lib/demoScript";
import { runScenario, type RunHandle } from "../lib/simulationEngine";
import { loadCachedTasks, saveCachedTasks } from "../lib/storage";
import type { Task } from "../lib/types";

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(() => loadCachedTasks());
  const [isRefreshing, setIsRefreshing] = useState(true);
  const handles = useRef(new Map<string, RunHandle>());

  useEffect(() => {
    // Cached tasks (if any) are already on screen — this only confirms that
    // state, it never blanks it.
    const t = window.setTimeout(() => setIsRefreshing(false), tasks.length ? 380 : 220);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveCachedTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    const map = handles.current;
    return () => {
      map.forEach((h) => h.cancel());
    };
  }, []);

  const updateTask = useCallback((taskId: string, updater: (t: Task) => Task) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? updater(t) : t)));
  }, []);

  const startTask = useCallback(
    (title: string, isDemo: boolean): string => {
      const now = Date.now();
      const task: Task = {
        id: makeId(),
        title,
        status: "pending",
        createdAt: now,
        updatedAt: now,
        iteration: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        budgetMaxIterations: 20,
        timeline: [],
        repoName: "acme-store",
        filesModified: [],
      };
      setTasks((prev) => [task, ...prev]);
      const steps = isDemo ? buildDemoScenario() : buildGenericScenario(title);
      const handle = runScenario(task.id, steps, (updater) => updateTask(task.id, updater));
      handles.current.set(task.id, handle);
      return task.id;
    },
    [updateTask],
  );

  const skipTask = useCallback((taskId: string) => {
    handles.current.get(taskId)?.skip();
  }, []);

  return { tasks, isRefreshing, startTask, skipTask };
}
