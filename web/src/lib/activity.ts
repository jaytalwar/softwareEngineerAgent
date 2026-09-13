import type { Task } from "./types";

export type ActivityState = "idle" | "planning" | "working" | "testing" | "reviewing" | "success" | "failed";

export function deriveActivity(task: Task): { state: ActivityState; label: string } {
  if (task.status === "succeeded") return { state: "success", label: "Task completed" };
  if (task.status === "failed") return { state: "failed", label: task.failureReason ?? "Stopped" };

  const last = task.timeline.at(-1);
  if (!last) return { state: "planning", label: "Understanding the task..." };
  if (last.tool === "run_tests") return { state: "testing", label: last.message };
  if (last.agentRole === "reviewer") return { state: "reviewing", label: last.message };
  if (last.agentRole === "planner") return { state: "planning", label: last.message };
  return { state: "working", label: last.message };
}
