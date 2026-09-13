/**
 * Stands in for the real backend (a FastAPI bridge over `build_agent_graph`,
 * streaming `Tracer` events) so the UI can be built and demoed before that
 * bridge exists. Swapping this module for a real SSE/WebSocket client is
 * the only change `useTasks` should ever need.
 */
import type { AgentRole, Task, ToolCallEvent } from "./types";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function toolCallsFor(attempt: number): ToolCallEvent[] {
  if (attempt === 0) {
    return [
      {
        id: makeId(),
        tool: "read_file",
        args: { path: "src/api/routes.py" },
        result: "@router.get('/health')\ndef health():\n    ...",
        success: true,
      },
      {
        id: makeId(),
        tool: "write_file",
        args: { path: "src/api/health.py", content: "def health():\n    return {\"ok\": True}" },
        result: '{"status": "ok"}',
        success: true,
      },
      {
        id: makeId(),
        tool: "run_tests",
        args: { path: "tests" },
        result: '{"total": 4, "passed": 3, "failed": 1}',
        success: true,
      },
    ];
  }
  return [
    {
      id: makeId(),
      tool: "edit_file",
      args: { path: "src/api/health.py", old_str: '{"ok": True}', new_str: '{"status": "ok"}' },
      result: "ok",
      success: true,
    },
    {
      id: makeId(),
      tool: "run_tests",
      args: { path: "tests" },
      result: '{"total": 4, "passed": 4, "failed": 0}',
      success: true,
    },
  ];
}

function summaryFor(role: AgentRole, attempt: number, willPassThisRound: boolean): string {
  if (role === "planner") {
    return "Plan: locate the router, add a health-check handler, verify with the test suite.";
  }
  if (role === "coder") {
    return attempt === 0
      ? "Added the health-check handler and wired it into the router."
      : "Fixed the response shape flagged by the reviewer.";
  }
  return willPassThisRound
    ? "All tests pass. Accepted."
    : 'Tests fail: response is missing the "status" field. Sending back to Coder.';
}

export interface RunHandle {
  cancel: () => void;
}

export function runMockAgentTask(
  task: Task,
  onUpdate: (updater: (t: Task) => Task) => void,
): RunHandle {
  let cancelled = false;
  const simulateFailure = /\bfail\b/i.test(task.title);

  async function runStep(role: AgentRole, attempt: number, willPassThisRound: boolean) {
    const stepId = makeId();
    onUpdate((t) => ({
      ...t,
      status: "running",
      timeline: [
        ...t.timeline,
        { id: stepId, role, status: "running", toolCalls: [], startedAt: Date.now() },
      ],
    }));

    await delay(650 + Math.random() * 850);
    if (cancelled) return;

    const toolCalls = role === "coder" ? toolCallsFor(attempt) : [];
    const summary = summaryFor(role, attempt, willPassThisRound);

    onUpdate((t) => ({
      ...t,
      iteration: t.iteration + 1,
      totalTokens: t.totalTokens + 340 + Math.round(Math.random() * 260),
      totalCostUsd: t.totalCostUsd + 0.0035 + Math.random() * 0.0025,
      updatedAt: Date.now(),
      timeline: t.timeline.map((s) =>
        s.id === stepId
          ? { ...s, status: "done" as const, summary, toolCalls, finishedAt: Date.now() }
          : s,
      ),
    }));
  }

  async function run() {
    await runStep("planner", 0, false);
    if (cancelled) return;

    const maxAttempts = simulateFailure ? 3 : 2;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (cancelled) return;
      const willPass = !simulateFailure && attempt === maxAttempts - 1;
      await runStep("coder", attempt, willPass);
      if (cancelled) return;
      await runStep("reviewer", attempt, willPass);
      if (cancelled) return;
      if (willPass) {
        onUpdate((t) => ({ ...t, status: "succeeded", updatedAt: Date.now() }));
        return;
      }
    }

    onUpdate((t) => ({
      ...t,
      status: "failed",
      updatedAt: Date.now(),
      failureReason: `Stopped: exceeded max_iterations=${t.budgetMaxIterations} without passing review.`,
    }));
  }

  run();
  return {
    cancel: () => {
      cancelled = true;
    },
  };
}
