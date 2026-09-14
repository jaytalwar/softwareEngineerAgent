export type ToolName =
  | "read_file"
  | "write_file"
  | "edit_file"
  | "list_dir"
  | "search_code"
  | "run_shell"
  | "run_tests"
  | "git_diff"
  | "apply_patch"
  | "get_lint_diagnostics";

export type AgentRole = "planner" | "coder" | "reviewer";

export type EventStatus = "running" | "done" | "error";

export interface DiffLine {
  type: "context" | "add" | "del";
  content: string;
  oldLine?: number;
  newLine?: number;
}

export interface FileDiff {
  path: string;
  language: string;
  additions: number;
  deletions: number;
  lines: DiffLine[];
}

export interface TestCase {
  name: string;
  status: "passed" | "failed";
  durationMs: number;
  error?: string;
  file?: string;
  line?: number;
}

export interface TestSummary {
  passed: number;
  failed: number;
  warnings: number;
  totalTimeMs: number;
  tests: TestCase[];
}

export interface CodeMatch {
  file: string;
  line: number;
  snippet: string;
}

export interface TimelineEvent {
  id: string;
  agentRole: AgentRole;
  tool?: ToolName;
  title: string;
  message: string;
  detail?: string;
  status: EventStatus;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  args?: Record<string, unknown>;
  diff?: FileDiff;
  tests?: TestSummary;
  matches?: CodeMatch[];
  fileContent?: { path: string; language: string; content: string };
  final?: boolean;
}

export type TaskStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";

/** Where a task's execution actually came from — shown in the UI so it's
 * never ambiguous whether you're looking at a real agent run or a mock. */
export type TaskSource = "demo" | "generic-mock" | "real";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
  iteration: number;
  totalTokens: number;
  totalCostUsd: number;
  budgetMaxIterations: number;
  timeline: TimelineEvent[];
  repoName: string;
  filesModified: string[];
  failureReason?: string;
  source: TaskSource;
  llmMode?: string;
}

export type RepoNode =
  | { type: "dir"; name: string; path: string; children: RepoNode[] }
  | { type: "file"; name: string; path: string };
