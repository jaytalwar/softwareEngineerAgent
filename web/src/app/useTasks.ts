import { useCallback, useEffect, useRef, useState } from "react";
import { buildDemoScenario, buildGenericScenario } from "../lib/demoScript";
import { checkBackendHealth, createRealTask, pollRealTask } from "../lib/realApi";
import { runScenario, type RunHandle } from "../lib/simulationEngine";
import { loadCachedTasks, saveCachedTasks } from "../lib/storage";
import type { Task } from "../lib/types";

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(() => loadCachedTasks());
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const handles = useRef(new Map<string, RunHandle>());

  useEffect(() => {
    // Cached tasks (if any) are already on screen — this only confirms that
    // state, it never blanks it.
    const t = window.setTimeout(() => setIsRefreshing(false), tasks.length ? 380 : 220);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    checkBackendHealth().then(({ ok }) => setBackendAvailable(ok));
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
      const id = makeId();
      const useReal = !isDemo && backendAvailable;

      const task: Task = {
        id,
        title,
        status: "pending",
        createdAt: now,
        updatedAt: now,
        iteration: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        budgetMaxIterations: 20,
        timeline: [],
        repoName: useReal ? "sandbox_fixtures (throwaway copy)" : "acme-store",
        filesModified: [],
        source: isDemo ? "demo" : useReal ? "real" : "generic-mock",
      };
      setTasks((prev) => [task, ...prev]);

      if (useReal) {
        createRealTask(title)
          .then(({ taskId: realId, llmMode }) => {
            updateTask(id, (t) => ({ ...t, llmMode, realTaskId: realId }));
            const handle = pollRealTask(realId, (updater) => updateTask(id, updater));
            handles.current.set(id, handle);
          })
          .catch(() => {
            // The health check passed but the create call itself failed
            // (backend went away mid-request) — fall back rather than
            // leaving the task stuck at "pending" forever.
            const steps = buildGenericScenario(title);
            const handle = runScenario(id, steps, (updater) => updateTask(id, updater));
            handles.current.set(id, handle);
          });
      } else {
        const steps = isDemo ? buildDemoScenario() : buildGenericScenario(title);
        const handle = runScenario(id, steps, (updater) => updateTask(id, updater));
        handles.current.set(id, handle);
      }

      return id;
    },
    [backendAvailable, updateTask],
  );

  const skipTask = useCallback((taskId: string) => {
    handles.current.get(taskId)?.skip();
  }, []);

  return { tasks, isRefreshing, backendAvailable, startTask, skipTask };
}
