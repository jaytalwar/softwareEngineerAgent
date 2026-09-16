import { describe, expect, it } from "vitest";
import { deriveActivity } from "./activity";
import type { Task, TimelineEvent } from "./types";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "Fix the bug",
    status: "running",
    createdAt: 0,
    updatedAt: 0,
    iteration: 0,
    totalTokens: 0,
    totalCostUsd: 0,
    budgetMaxIterations: 20,
    timeline: [],
    repoName: "acme-store",
    filesModified: [],
    source: "demo",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: "e1",
    agentRole: "coder",
    title: "Read File",
    message: "Reading src/a.py...",
    status: "done",
    startedAt: 0,
    ...overrides,
  };
}

describe("deriveActivity", () => {
  it("reports success for a succeeded task, ignoring the timeline", () => {
    const task = makeTask({ status: "succeeded", timeline: [makeEvent()] });

    expect(deriveActivity(task)).toEqual({ state: "success", label: "Task completed" });
  });

  it("reports the failure reason for a failed task when present", () => {
    const task = makeTask({ status: "failed", failureReason: "Budget exceeded" });

    expect(deriveActivity(task)).toEqual({ state: "failed", label: "Budget exceeded" });
  });

  it("falls back to a generic label when a failed task has no reason", () => {
    const task = makeTask({ status: "failed" });

    expect(deriveActivity(task)).toEqual({ state: "failed", label: "Stopped" });
  });

  it("reports the failure reason for a cancelled task when present", () => {
    const task = makeTask({ status: "cancelled", failureReason: "Stopped by user request." });

    expect(deriveActivity(task)).toEqual({
      state: "cancelled",
      label: "Stopped by user request.",
    });
  });

  it("falls back to a generic label when a cancelled task has no reason", () => {
    const task = makeTask({ status: "cancelled" });

    expect(deriveActivity(task)).toEqual({ state: "cancelled", label: "Stopped by user" });
  });

  it("shows an understanding message for a running task with no timeline yet", () => {
    const task = makeTask({ status: "pending", timeline: [] });

    expect(deriveActivity(task)).toEqual({
      state: "planning",
      label: "Understanding the task...",
    });
  });

  it("reports testing state when the last event is run_tests", () => {
    const task = makeTask({
      timeline: [makeEvent({ tool: "run_tests", message: "3 passed, 0 failed" })],
    });

    expect(deriveActivity(task)).toEqual({ state: "testing", label: "3 passed, 0 failed" });
  });

  it("reports reviewing state when the last event is the reviewer", () => {
    const task = makeTask({
      timeline: [makeEvent({ agentRole: "reviewer", message: "All tests pass. Accepted." })],
    });

    expect(deriveActivity(task)).toEqual({
      state: "reviewing",
      label: "All tests pass. Accepted.",
    });
  });

  it("reports planning state when the last event is the planner", () => {
    const task = makeTask({
      timeline: [makeEvent({ agentRole: "planner", message: "Plan: locate the bug." })],
    });

    expect(deriveActivity(task)).toEqual({ state: "planning", label: "Plan: locate the bug." });
  });

  it("falls back to a generic working state for any other coder event", () => {
    const task = makeTask({
      timeline: [makeEvent({ agentRole: "coder", tool: "edit_file", message: "Edited a.py" })],
    });

    expect(deriveActivity(task)).toEqual({ state: "working", label: "Edited a.py" });
  });

  it("uses the most recent event, not the first, when several exist", () => {
    const task = makeTask({
      timeline: [
        makeEvent({ agentRole: "planner", message: "first" }),
        makeEvent({ agentRole: "reviewer", message: "latest" }),
      ],
    });

    expect(deriveActivity(task)).toEqual({ state: "reviewing", label: "latest" });
  });
});
