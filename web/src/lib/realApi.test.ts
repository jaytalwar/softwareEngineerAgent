import { afterEach, describe, expect, it, vi } from "vitest";
import {
  API_BASE,
  cancelRealTask,
  checkBackendHealth,
  createRealTask,
  fetchRepoTree,
  pollRealTask,
  validateRepoPath,
} from "./realApi";
import type { Task } from "./types";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => body,
  } as Response;
}

function baseTask(): Task {
  return {
    id: "local-1",
    title: "Fix the bug",
    status: "pending",
    createdAt: 0,
    updatedAt: 0,
    iteration: 0,
    totalTokens: 0,
    totalCostUsd: 0,
    budgetMaxIterations: 20,
    timeline: [],
    repoName: "sandbox",
    filesModified: [],
    source: "real",
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("checkBackendHealth", () => {
  it("reports ok and the llm mode when the backend responds", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: "ok", llm_mode: "anthropic" })));

    expect(await checkBackendHealth()).toEqual({ ok: true, llmMode: "anthropic" });
  });

  it("reports not-ok on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, false)));

    expect(await checkBackendHealth()).toEqual({ ok: false });
  });

  it("reports not-ok when the backend is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    expect(await checkBackendHealth()).toEqual({ ok: false });
  });
});

describe("validateRepoPath", () => {
  it("maps a valid, git-tracked path to camelCase", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ valid: true, name: "AISoftware", is_git_repo: true, error: null }),
      ),
    );

    expect(await validateRepoPath("/repo")).toEqual({
      valid: true,
      name: "AISoftware",
      isGitRepo: true,
      error: undefined,
    });
  });

  it("maps an invalid path's error message through", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ valid: false, name: null, is_git_repo: false, error: "No such path" }),
      ),
    );

    expect(await validateRepoPath("/nope")).toEqual({
      valid: false,
      name: undefined,
      isGitRepo: false,
      error: "No such path",
    });
  });

  it("reports invalid with a generic error when the backend is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    expect(await validateRepoPath("/repo")).toEqual({
      valid: false,
      error: "Could not reach the backend.",
    });
  });
});

describe("fetchRepoTree", () => {
  it("returns the parsed tree on success", async () => {
    const tree = { type: "dir", name: "root", path: "", children: [] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(tree)));

    expect(await fetchRepoTree("task-1")).toEqual(tree);
  });

  it("returns null on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, false)));

    expect(await fetchRepoTree("task-1")).toBeNull();
  });

  it("returns null when the backend is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    expect(await fetchRepoTree("task-1")).toBeNull();
  });
});

describe("createRealTask", () => {
  it("posts the title alone when no repo root is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ task_id: "abc", llm_mode: "scripted-fallback" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createRealTask("Fix it");

    expect(result).toEqual({ taskId: "abc", llmMode: "scripted-fallback" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/tasks`);
    expect(JSON.parse(init.body)).toEqual({ title: "Fix it" });
  });

  it("includes repo_root in the request body when given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ task_id: "abc", llm_mode: "anthropic" }));
    vi.stubGlobal("fetch", fetchMock);

    await createRealTask("Fix it", "/tmp/my-repo");

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ title: "Fix it", repo_root: "/tmp/my-repo" });
  });

  it("throws when the backend rejects the request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, false)));

    await expect(createRealTask("Fix it")).rejects.toThrow("create task failed: 400");
  });
});

describe("cancelRealTask", () => {
  it("posts to the cancel endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await cancelRealTask("task-1");

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/tasks/task-1/cancel`, { method: "POST" });
  });

  it("never throws even when the backend is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(cancelRealTask("task-1")).resolves.toBeUndefined();
  });
});

describe("pollRealTask", () => {
  function rawTaskState(status: string, extra: Record<string, unknown> = {}) {
    return {
      task_id: "task-1",
      status,
      iteration: 3,
      total_tokens: 450,
      total_cost_usd: 0.0027,
      messages: [
        { id: "m0", role: "user", content: "Fix it", name: null, created_at: "2024-01-01T00:00:00.000Z" },
        { id: "m1", role: "assistant", content: "Plan: read the file.", name: "planner", created_at: "2024-01-01T00:00:01.000Z" },
        { id: "m2", role: "assistant", content: "Fixed it.", name: "coder", created_at: "2024-01-01T00:00:05.000Z" },
        { id: "m3", role: "assistant", content: "All tests pass.", name: "reviewer", created_at: "2024-01-01T00:00:06.000Z" },
      ],
      tool_results: [
        {
          call_id: "c1",
          tool_name: "read_file",
          arguments: { path: "src/a.py" },
          success: true,
          output: "print('hi')",
          error: null,
          started_at: "2024-01-01T00:00:02.000Z",
          finished_at: "2024-01-01T00:00:02.500Z",
        },
        {
          call_id: "c2",
          tool_name: "edit_file",
          arguments: { path: "src/a.py", old_str: "999", new_str: "6" },
          success: true,
          output: null,
          error: null,
          started_at: "2024-01-01T00:00:03.000Z",
          finished_at: "2024-01-01T00:00:03.100Z",
        },
        {
          call_id: "c3",
          tool_name: "run_tests",
          arguments: { path: "." },
          success: true,
          output: { total: 2, passed: 2, failed: 0, errors: 0, failing_tests: [] },
          error: null,
          started_at: "2024-01-01T00:00:04.000Z",
          finished_at: "2024-01-01T00:00:04.500Z",
        },
      ],
      ...extra,
    };
  }

  function pollOnce(raw: unknown): Promise<(t: Task) => Task> {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(raw)));
    return new Promise((resolve) => {
      pollRealTask("task-1", (updater) => resolve(updater));
    });
  }

  it("builds a full timeline from tool results grouped under the coder's message", async () => {
    const updater = await pollOnce(rawTaskState("succeeded"));
    const task = updater(baseTask());

    expect(task.status).toBe("succeeded");
    expect(task.iteration).toBe(3);
    expect(task.totalTokens).toBe(450);
    expect(task.totalCostUsd).toBeCloseTo(0.0027);
    expect(task.failureReason).toBeUndefined();

    const titles = task.timeline.map((e) => e.title);
    expect(titles).toEqual(["Planner", "Read File", "Edit File", "Run Tests", "Coder", "Reviewer"]);
  });

  it("turns a real edit_file call into a real diff", async () => {
    const updater = await pollOnce(rawTaskState("succeeded"));
    const task = updater(baseTask());

    const editEvent = task.timeline.find((e) => e.title === "Edit File")!;
    expect(editEvent.diff).toEqual({
      path: "src/a.py",
      language: "python",
      additions: 1,
      deletions: 1,
      lines: [
        { type: "del", content: "999" },
        { type: "add", content: "6" },
      ],
    });
  });

  it("turns a real run_tests call into a real test summary", async () => {
    const updater = await pollOnce(rawTaskState("succeeded"));
    const task = updater(baseTask());

    const testEvent = task.timeline.find((e) => e.title === "Run Tests")!;
    expect(testEvent.message).toBe("2 passed, 0 failed");
    expect(testEvent.tests).toEqual({ passed: 2, failed: 0, warnings: 0, totalTimeMs: 500, tests: [] });
  });

  it("derives filesModified from successful write/edit/patch calls only", async () => {
    const updater = await pollOnce(rawTaskState("succeeded"));
    const task = updater(baseTask());

    expect(task.filesModified).toEqual(["src/a.py"]);
  });

  it("sets a failure reason when the task failed", async () => {
    const updater = await pollOnce(rawTaskState("failed"));
    const task = updater(baseTask());

    expect(task.status).toBe("failed");
    expect(task.failureReason).toBe(
      "The agent stopped without completing the task — see the timeline above.",
    );
  });

  it("sets a distinct failure reason when the task was cancelled", async () => {
    const updater = await pollOnce(rawTaskState("cancelled"));
    const task = updater(baseTask());

    expect(task.status).toBe("cancelled");
    expect(task.failureReason).toBe("Stopped by user request.");
  });

  it("stops polling once a terminal status is reached", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(rawTaskState("succeeded")));
    vi.stubGlobal("fetch", fetchMock);

    await new Promise<void>((resolve) => {
      let calls = 0;
      pollRealTask("task-1", () => {
        calls += 1;
        if (calls === 1) resolve();
      });
    });

    // Give the loop's internal await a tick to notice the terminal status
    // and return, rather than scheduling another 500ms wait.
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps polling while the task is still running", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(rawTaskState("running")))
      .mockResolvedValue(jsonResponse(rawTaskState("succeeded")));
    vi.stubGlobal("fetch", fetchMock);

    pollRealTask("task-1", () => {});

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stop() posts to the cancel endpoint without stopping local polling itself", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(rawTaskState("succeeded")));
    vi.stubGlobal("fetch", fetchMock);

    const handle = pollRealTask("task-1", () => {});
    handle.stop();
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/tasks/task-1/cancel`, { method: "POST" });
  });
});
