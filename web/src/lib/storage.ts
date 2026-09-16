import type { ConnectedRepo, Task } from "./types";

const KEY = "swe-agent.tasks.v1";
const REPO_KEY = "swe-agent.repo.v1";

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

export function loadConnectedRepo(): ConnectedRepo | null {
  try {
    const raw = localStorage.getItem(REPO_KEY);
    return raw ? (JSON.parse(raw) as ConnectedRepo) : null;
  } catch {
    return null;
  }
}

export function saveConnectedRepo(repo: ConnectedRepo | null): void {
  try {
    if (repo) {
      localStorage.setItem(REPO_KEY, JSON.stringify(repo));
    } else {
      localStorage.removeItem(REPO_KEY);
    }
  } catch {
    // Same as saveCachedTasks — best effort only.
  }
}
