import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as realApi from "../lib/realApi";
import * as simulationEngine from "../lib/simulationEngine";
import { useTasks } from "./useTasks";

vi.mock("../lib/realApi", () => ({
  checkBackendHealth: vi.fn(),
  createRealTask: vi.fn(),
  pollRealTask: vi.fn(),
}));

vi.mock("../lib/simulationEngine", () => ({
  runScenario: vi.fn(),
}));

function fakeHandle(overrides: Partial<simulationEngine.RunHandle> = {}): simulationEngine.RunHandle {
  return { cancel: vi.fn(), skip: vi.fn(), ...overrides };
}

function fakeRealHandle(overrides: Partial<realApi.RunHandle> = {}): realApi.RunHandle {
  return { cancel: vi.fn(), skip: vi.fn(), stop: vi.fn(), ...overrides };
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(realApi.checkBackendHealth).mockResolvedValue({ ok: false });
  vi.mocked(simulationEngine.runScenario).mockReturnValue(fakeHandle());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useTasks", () => {
  it("starts with no tasks and picks them up from an empty cache", () => {
    const { result } = renderHook(() => useTasks());

    expect(result.current.tasks).toEqual([]);
  });

  it("reflects the backend health check once it resolves", async () => {
    vi.mocked(realApi.checkBackendHealth).mockResolvedValue({ ok: true, llmMode: "anthropic" });

    const { result } = renderHook(() => useTasks());

    await waitFor(() => expect(result.current.backendAvailable).toBe(true));
  });

  it("runs a demo task through the local simulation even when the backend is available", async () => {
    vi.mocked(realApi.checkBackendHealth).mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.backendAvailable).toBe(true));

    let id = "";
    act(() => {
      id = result.current.startTask("Fix the auth bug", true);
    });

    const task = result.current.tasks.find((t) => t.id === id)!;
    expect(task.source).toBe("demo");
    expect(realApi.createRealTask).not.toHaveBeenCalled();
    expect(simulationEngine.runScenario).toHaveBeenCalledWith(id, expect.any(Array), expect.any(Function));
  });

  it("runs a typed task through the local simulation when the backend is unavailable", () => {
    const { result } = renderHook(() => useTasks());

    let id = "";
    act(() => {
      id = result.current.startTask("Fix the auth bug", false);
    });

    const task = result.current.tasks.find((t) => t.id === id)!;
    expect(task.source).toBe("generic-mock");
    expect(task.repoName).toBe("acme-store");
    expect(realApi.createRealTask).not.toHaveBeenCalled();
  });

  it("runs a typed task against the real backend when it's available", async () => {
    vi.mocked(realApi.checkBackendHealth).mockResolvedValue({ ok: true });
    vi.mocked(realApi.createRealTask).mockResolvedValue({ taskId: "real-1", llmMode: "anthropic" });
    vi.mocked(realApi.pollRealTask).mockReturnValue(fakeRealHandle());
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.backendAvailable).toBe(true));

    let id = "";
    act(() => {
      id = result.current.startTask("Fix the auth bug", false, {
        path: "/tmp/my-repo",
        name: "my-repo",
        isGitRepo: true,
      });
    });

    const optimisticTask = result.current.tasks.find((t) => t.id === id)!;
    expect(optimisticTask.source).toBe("real");
    expect(optimisticTask.repoName).toBe("my-repo");
    expect(realApi.createRealTask).toHaveBeenCalledWith("Fix the auth bug", "/tmp/my-repo");

    await waitFor(() => {
      const task = result.current.tasks.find((t) => t.id === id)!;
      expect(task.realTaskId).toBe("real-1");
      expect(task.llmMode).toBe("anthropic");
    });
    expect(realApi.pollRealTask).toHaveBeenCalledWith("real-1", expect.any(Function));
  });

  it("falls back to the local simulation when creating the real task fails", async () => {
    vi.mocked(realApi.checkBackendHealth).mockResolvedValue({ ok: true });
    vi.mocked(realApi.createRealTask).mockRejectedValue(new Error("backend went away"));
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.backendAvailable).toBe(true));

    act(() => {
      result.current.startTask("Fix the auth bug", false);
    });

    await waitFor(() => expect(simulationEngine.runScenario).toHaveBeenCalled());
    expect(realApi.pollRealTask).not.toHaveBeenCalled();
  });

  it("skipTask delegates to the task's own handle", () => {
    const handle = fakeHandle();
    vi.mocked(simulationEngine.runScenario).mockReturnValue(handle);
    const { result } = renderHook(() => useTasks());

    let id = "";
    act(() => {
      id = result.current.startTask("Fix it", false);
    });
    act(() => {
      result.current.skipTask(id);
    });

    expect(handle.skip).toHaveBeenCalledOnce();
  });

  it("stopTask calls the handle's stop() when present, and is a no-op otherwise", () => {
    const handle = fakeHandle(); // no `stop` — mirrors a simulated task's handle
    vi.mocked(simulationEngine.runScenario).mockReturnValue(handle);
    const { result } = renderHook(() => useTasks());

    let id = "";
    act(() => {
      id = result.current.startTask("Fix it", false);
    });

    expect(() => result.current.stopTask(id)).not.toThrow();
  });

  it("stopTask calls a real task's stop()", async () => {
    vi.mocked(realApi.checkBackendHealth).mockResolvedValue({ ok: true });
    vi.mocked(realApi.createRealTask).mockResolvedValue({ taskId: "real-1", llmMode: "anthropic" });
    const stop = vi.fn();
    vi.mocked(realApi.pollRealTask).mockReturnValue({ cancel: vi.fn(), skip: vi.fn(), stop });
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.backendAvailable).toBe(true));

    let id = "";
    act(() => {
      id = result.current.startTask("Fix it", false);
    });
    await waitFor(() => expect(realApi.pollRealTask).toHaveBeenCalled());

    act(() => {
      result.current.stopTask(id);
    });

    expect(stop).toHaveBeenCalledOnce();
  });

  it("cancels every task's handle on unmount", () => {
    const handle = fakeHandle();
    vi.mocked(simulationEngine.runScenario).mockReturnValue(handle);
    const { result, unmount } = renderHook(() => useTasks());

    act(() => {
      result.current.startTask("Fix it", false);
    });
    unmount();

    expect(handle.cancel).toHaveBeenCalledOnce();
  });
});
