/**
 * Client for the real FastAPI bridge (`src/swe_agent/server.py`).
 *
 * Honest limitation: `ToolResult` (the backend's own record of a tool
 * call) doesn't carry the *arguments* a tool was called with — only its
 * outcome — so real tool events here show name/outcome/timing but not
 * the path/pattern/etc. the mocked demo shows. Diffs aren't reconstructed
 * either (the real tools return `{"status": "ok"}` for edits, not a diff
 * structure). See BUILD_LOG's "what remains" for the fix.
 */
import type { AgentRole, Task, TestSummary, TimelineEvent, ToolName } from "./types";

export const API_BASE = "http://localhost:8000";

export async function checkBackendHealth(): Promise<{ ok: boolean; llmMode?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { llm_mode?: string };
    return { ok: true, llmMode: data.llm_mode };
  } catch {
    return { ok: false };
  }
}

interface RawAgentMessage {
  id: string;
  role: string;
  content: string;
  name: string | null;
  created_at: string;
}

interface RawToolResult {
  call_id: string;
  tool_name: string;
  success: boolean;
  output: unknown;
  error: string | null;
  started_at: string;
  finished_at: string;
}

interface RawTaskState {
  task_id: string;
  status: string;
  messages: RawAgentMessage[];
  tool_results: RawToolResult[];
  iteration: number;
  total_tokens: number;
  total_cost_usd: number;
}

interface RunTestsOutput {
  total: number;
  passed: number;
  failed: number;
  errors: number;
  failing_tests: { name: string; message: string }[];
}

function isRunTestsOutput(output: unknown): output is RunTestsOutput {
  return (
    !!output &&
    typeof output === "object" &&
    "passed" in output &&
    "failed" in output &&
    "failing_tests" in output
  );
}

function summarize(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

function toolResultToEvent(tool: RawToolResult): TimelineEvent {
  const startedAt = Date.parse(tool.started_at);
  const finishedAt = Date.parse(tool.finished_at);
  const knownTool = KNOWN_TOOLS.has(tool.tool_name) ? (tool.tool_name as ToolName) : undefined;

  if (tool.tool_name === "run_tests" && isRunTestsOutput(tool.output)) {
    const output = tool.output;
    const tests: TestSummary = {
      passed: output.passed,
      failed: output.failed,
      warnings: 0,
      totalTimeMs: finishedAt - startedAt,
      tests: output.failing_tests.map((f) => ({
        name: f.name,
        status: "failed",
        durationMs: 0,
        error: f.message,
      })),
    };
    return {
      id: tool.call_id,
      agentRole: "coder",
      tool: knownTool,
      title: "Run Tests",
      message: `${output.passed} passed, ${output.failed} failed`,
      status: "done",
      startedAt,
      finishedAt,
      durationMs: finishedAt - startedAt,
      tests,
    };
  }

  return {
    id: tool.call_id,
    agentRole: "coder",
    tool: knownTool,
    title: tool.tool_name,
    message: tool.success ? summarize(tool.output) : (tool.error ?? "Tool call failed."),
    status: "done",
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
  };
}

const KNOWN_TOOLS = new Set<string>([
  "read_file",
  "write_file",
  "edit_file",
  "list_dir",
  "search_code",
  "run_shell",
  "run_tests",
  "git_diff",
  "apply_patch",
  "get_lint_diagnostics",
]);

const KNOWN_ROLES = new Set<string>(["planner", "coder", "reviewer"]);

function toTimelineEvents(raw: RawTaskState): TimelineEvent[] {
  const agentMessages = raw.messages.filter((m) => m.name && KNOWN_ROLES.has(m.name));
  const events: TimelineEvent[] = [];
  let previousBoundary = raw.messages[0]?.created_at ?? new Date(0).toISOString();

  for (const msg of agentMessages) {
    const relatedTools = raw.tool_results.filter(
      (t) => t.started_at >= previousBoundary && t.started_at <= msg.created_at,
    );
    for (const tool of relatedTools) {
      events.push(toolResultToEvent(tool));
    }

    const role = msg.name as AgentRole;
    const timestamp = Date.parse(msg.created_at);
    events.push({
      id: msg.id,
      agentRole: role,
      title: role.charAt(0).toUpperCase() + role.slice(1),
      message: msg.content,
      status: "done",
      startedAt: timestamp,
      finishedAt: timestamp,
    });

    previousBoundary = msg.created_at;
  }

  if (raw.status === "running" || raw.status === "pending") {
    events.push({
      id: "live-indicator",
      agentRole: "coder",
      title: "Working",
      message: "Agent is working...",
      status: "running",
      startedAt: Date.now(),
    });
  }

  return events;
}

export interface RunHandle {
  cancel: () => void;
  skip: () => void;
}

export async function createRealTask(
  title: string,
): Promise<{ taskId: string; llmMode: string }> {
  const res = await fetch(`${API_BASE}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    throw new Error(`create task failed: ${res.status}`);
  }
  const body = (await res.json()) as { task_id: string; llm_mode: string };
  return { taskId: body.task_id, llmMode: body.llm_mode };
}

export function pollRealTask(
  taskId: string,
  onUpdate: (updater: (t: Task) => Task) => void,
): RunHandle {
  let cancelled = false;

  async function poll(): Promise<void> {
    while (!cancelled) {
      try {
        const res = await fetch(`${API_BASE}/api/tasks/${taskId}`);
        if (res.ok) {
          const raw = (await res.json()) as RawTaskState;
          onUpdate((t) => ({
            ...t,
            status: raw.status as Task["status"],
            iteration: raw.iteration,
            totalTokens: raw.total_tokens,
            totalCostUsd: raw.total_cost_usd,
            timeline: toTimelineEvents(raw),
            updatedAt: Date.now(),
            failureReason:
              raw.status === "failed"
                ? "The agent stopped without completing the task — see the timeline above."
                : undefined,
          }));
          if (raw.status === "succeeded" || raw.status === "failed") return;
        }
      } catch {
        // transient network hiccup against a local dev server — keep polling
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  poll();
  return {
    cancel: () => {
      cancelled = true;
    },
    skip: () => {
      // Real execution can't be fast-forwarded — the UI hides "Skip
      // animation" for real tasks (see Workspace.tsx's `source` check).
    },
  };
}
