import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadCachedTasks, loadConnectedRepo, saveCachedTasks, saveConnectedRepo } from "./storage";
import type { ConnectedRepo, Task } from "./types";

function makeTask(id: string): Task {
  return {
    id,
    title: "Fix the bug",
    status: "succeeded",
    createdAt: 0,
    updatedAt: 0,
    iteration: 1,
    totalTokens: 100,
    totalCostUsd: 0.01,
    budgetMaxIterations: 20,
    timeline: [],
    repoName: "acme-store",
    filesModified: [],
    source: "demo",
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("cached tasks", () => {
  it("round-trips through localStorage", () => {
    const tasks = [makeTask("a"), makeTask("b")];

    saveCachedTasks(tasks);

    expect(loadCachedTasks()).toEqual(tasks);
  });

  it("returns an empty array when nothing has been saved yet", () => {
    expect(loadCachedTasks()).toEqual([]);
  });

  it("returns an empty array for corrupted JSON instead of throwing", () => {
    localStorage.setItem("swe-agent.tasks.v1", "{not json");

    expect(loadCachedTasks()).toEqual([]);
  });

  it("does not throw when localStorage.setItem fails (quota, private mode)", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });

    expect(() => saveCachedTasks([makeTask("a")])).not.toThrow();

    spy.mockRestore();
  });
});

describe("connected repo", () => {
  const repo: ConnectedRepo = { path: "/tmp/x", name: "x", isGitRepo: true };

  it("round-trips through localStorage", () => {
    saveConnectedRepo(repo);

    expect(loadConnectedRepo()).toEqual(repo);
  });

  it("returns null when nothing has been connected yet", () => {
    expect(loadConnectedRepo()).toBeNull();
  });

  it("clears the stored value when saved with null", () => {
    saveConnectedRepo(repo);
    saveConnectedRepo(null);

    expect(loadConnectedRepo()).toBeNull();
  });

  it("returns null for corrupted JSON instead of throwing", () => {
    localStorage.setItem("swe-agent.repo.v1", "{not json");

    expect(loadConnectedRepo()).toBeNull();
  });
});
