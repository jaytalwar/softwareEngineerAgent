import type { Task } from "./types";

const KEY = "orbit.tasks.v1";

export function loadCachedTasks(): Task[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Task[]) : [];
  } catch {
    return [];
  }
}

export function saveCachedTasks(tasks: Task[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(tasks));
  } catch {
    // Caching is a convenience, not a requirement — ignore quota/private-mode errors.
  }
}
