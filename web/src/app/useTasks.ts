import { useCallback, useEffect, useRef, useState } from "react";
import { runMockAgentTask, type RunHandle } from "../lib/mockApi";
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
    // Cached tasks (if any) are already on screen — this only ever confirms
    // that state, it never blanks it, so a brief simulated round-trip is
    // safe here.
    const initialCount = tasks.length;
    const t = window.setTimeout(() => setIsRefreshing(false), initialCount ? 380 : 220);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveCachedTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    const handleMap = handles.current;
    return () => {
      handleMap.forEach((h) => h.cancel());
    };
  }, []);

  const updateTask = useCallback((taskId: string, updater: (t: Task) => Task) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? updater(t) : t)));
  }, []);

  const createTask = useCallback(
    (title: string): string => {
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
        budgetMaxIterations: 12,
        timeline: [],
      };
      setTasks((prev) => [task, ...prev]);
      const handle = runMockAgentTask(task, (updater) => updateTask(task.id, updater));
      handles.current.set(task.id, handle);
      return task.id;
    },
    [updateTask],
  );

  return { tasks, isRefreshing, createTask };
}
