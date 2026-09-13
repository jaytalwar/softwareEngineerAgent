import type { ScenarioStep } from "./demoScript";
import type { Task, TimelineEvent } from "./types";

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export interface RunHandle {
  cancel: () => void;
  skip: () => void;
}

function toDoneEvent(step: ScenarioStep, id: string, startedAt: number, finishedAt: number): TimelineEvent {
  return {
    id,
    agentRole: step.agentRole,
    tool: step.tool,
    title: step.title,
    message: step.message,
    detail: step.detail,
    status: "done",
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
    args: step.args,
    diff: step.diff,
    tests: step.tests,
    matches: step.matches,
    fileContent: step.fileContent,
    final: step.final,
  };
}

function applyEventEffects(task: Task, step: ScenarioStep, event: TimelineEvent): Task {
  const touchesFile =
    step.diff && (step.tool === "edit_file" || step.tool === "apply_patch" || step.tool === "write_file");
  const filesModified = touchesFile
    ? Array.from(new Set([...task.filesModified, step.diff!.path]))
    : task.filesModified;
  const tokensDelta = 260 + Math.round(Math.random() * 220);

  return {
    ...task,
    iteration: task.iteration + (step.agentRole === "planner" || step.agentRole === "reviewer" ? 1 : 0),
    totalTokens: task.totalTokens + tokensDelta,
    totalCostUsd: task.totalCostUsd + tokensDelta * 0.000006,
    updatedAt: Date.now(),
    filesModified,
    status: step.final ? "succeeded" : "running",
    timeline: [...task.timeline, event],
  };
}

export function runScenario(
  _taskId: string,
  steps: ScenarioStep[],
  onUpdate: (updater: (t: Task) => Task) => void,
): RunHandle {
  let cancelled = false;
  let skipRequested = false;

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        clearInterval(iv);
        resolve();
      };
      const timer = setTimeout(finish, ms);
      const iv = setInterval(() => {
        if (skipRequested || cancelled) finish();
      }, 50);
    });
  }

  async function run() {
    for (const step of steps) {
      if (cancelled) return;

      if (skipRequested) {
        const now = Date.now();
        const event = toDoneEvent(step, makeId(), now, now);
        onUpdate((t) => applyEventEffects(t, step, event));
        continue;
      }

      const eventId = makeId();
      const startedAt = Date.now();
      onUpdate((t) => ({
        ...t,
        status: "running",
        timeline: [
          ...t.timeline,
          {
            id: eventId,
            agentRole: step.agentRole,
            tool: step.tool,
            title: step.title,
            message: step.message,
            status: "running",
            startedAt,
          },
        ],
      }));

      await sleep(step.runningDurationMs);
      if (cancelled) return;

      const finishedAt = Date.now();
      const doneEvent = toDoneEvent(step, eventId, startedAt, finishedAt);
      onUpdate((t) => {
        const withoutPlaceholder = { ...t, timeline: t.timeline.filter((e) => e.id !== eventId) };
        return applyEventEffects(withoutPlaceholder, step, doneEvent);
      });
    }
  }

  run();

  return {
    cancel: () => {
      cancelled = true;
    },
    skip: () => {
      skipRequested = true;
    },
  };
}
