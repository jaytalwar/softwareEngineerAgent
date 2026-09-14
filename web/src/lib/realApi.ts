/**
 * Client for the real FastAPI bridge (`src/swe_agent/server.py`).
 *
 * `ToolResult` now carries the real call `arguments`, so real tool events
 * here show genuine diffs, search matches, and file content — not just
 * outcome text. `edit_file` still only gets a line-number-free diff (its
 * arguments are `old_str`/`new_str`, not a full file before/after), and
 * `write_file`/`edit_file` don't return a path in their output, so
 * `filesModified` is derived from `arguments.path` here.
 */
import { diffFromEditArgs, parseUnifiedDiff } from "./diffParser";
import type { AgentRole, CodeMatch, Task, TestSummary, TimelineEvent, ToolName } from "./types";

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
  arguments: Record<string, unknown>;
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

interface SearchMatch {
  file: string;
  line: number;
  text: string;
}

function isSearchMatches(output: unknown): output is SearchMatch[] {
  return (
    Array.isArray(output) && (output.length === 0 || (output[0] && typeof output[0] === "object" && "file" in output[0] && "text" in output[0]))
  );
}

function summarize(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

function str(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  return typeof value === "string" ? value : "";
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

function toolResultToEvent(tool: RawToolResult): TimelineEvent {
  const startedAt = Date.parse(tool.started_at);
  const finishedAt = Date.parse(tool.finished_at);
  const knownTool = KNOWN_TOOLS.has(tool.tool_name) ? (tool.tool_name as ToolName) : undefined;
  const base = {
    id: tool.call_id,
    agentRole: "coder" as AgentRole,
    tool: knownTool,
    args: tool.arguments,
    status: "done" as const,
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
  };

  if (!tool.success) {
    return { ...base, title: tool.tool_name, message: tool.error ?? "Tool call failed." };
  }

  switch (tool.tool_name) {
    case "run_tests": {
      if (!isRunTestsOutput(tool.output)) break;
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
        ...base,
        title: "Run Tests",
        message: `${output.passed} passed, ${output.failed} failed`,
        tests,
      };
    }
    case "search_code": {
      if (!isSearchMatches(tool.output)) break;
      const matches: CodeMatch[] = tool.output.map((m) => ({
        file: m.file,
        line: m.line,
        snippet: m.text,
      }));
      return {
        ...base,
        title: "Search Code",
        message: `Searching for "${str(tool.arguments, "pattern")}"...`,
        detail: `${matches.length} matches found`,
        matches,
      };
    }
    case "read_file": {
      const path = str(tool.arguments, "path");
      const content = typeof tool.output === "string" ? tool.output : "";
      return {
        ...base,
        title: "Read File",
        message: `Reading ${path}...`,
        fileContent: { path, language: path.endsWith(".py") ? "python" : "plaintext", content },
      };
    }
    case "write_file": {
      const path = str(tool.arguments, "path");
      const content = str(tool.arguments, "content");
      return {
        ...base,
        title: "Write File",
        message: `Wrote ${path}`,
        fileContent: { path, language: path.endsWith(".py") ? "python" : "plaintext", content },
      };
    }
    case "edit_file": {
      const path = str(tool.arguments, "path");
      const oldStr = str(tool.arguments, "old_str");
      const newStr = str(tool.arguments, "new_str");
      return {
        ...base,
        title: "Edit File",
        message: `Edited ${path}`,
        diff: diffFromEditArgs(path, oldStr, newStr),
      };
    }
    case "apply_patch": {
      const diff = parseUnifiedDiff(str(tool.arguments, "diff"));
      return { ...base, title: "Apply Patch", message: "Applied a patch.", diff: diff ?? undefined };
    }
    case "git_diff": {
      const diff = typeof tool.output === "string" ? parseUnifiedDiff(tool.output) : null;
      return { ...base, title: "Git Diff", message: "Reviewing the working tree diff.", diff: diff ?? undefined };
    }
    case "list_dir": {
      const entries = Array.isArray(tool.output) ? (tool.output as unknown[]).length : 0;
      return { ...base, title: "List Directory", message: "Scanning repository structure...", detail: `${entries} entries found` };
    }
  }

  return { ...base, title: tool.tool_name, message: summarize(tool.output) };
}

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

const FILE_TOUCHING_TOOLS = new Set(["write_file", "edit_file", "apply_patch"]);

function extractFilesModified(raw: RawTaskState): string[] {
  const paths = new Set<string>();
  for (const tool of raw.tool_results) {
    if (!tool.success || !FILE_TOUCHING_TOOLS.has(tool.tool_name)) continue;
    const path = str(tool.arguments, "path");
    if (path) paths.add(path);
  }
  return [...paths];
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
            filesModified: extractFilesModified(raw),
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
