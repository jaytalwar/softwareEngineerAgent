import type { AgentRole, CodeMatch, FileDiff, TestSummary, ToolName } from "./types";

export interface ScenarioStep {
  agentRole: AgentRole;
  tool?: ToolName;
  title: string;
  message: string;
  detail?: string;
  args?: Record<string, unknown>;
  diff?: FileDiff;
  tests?: TestSummary;
  matches?: CodeMatch[];
  fileContent?: { path: string; language: string; content: string };
  runningDurationMs: number;
  final?: boolean;
}

const SERVICE_BEFORE = `def authenticate(token: str) -> bool:
    if token:
        return True
    return False
`;

const DIFF_ATTEMPT_1: FileDiff = {
  path: "src/auth/service.py",
  language: "python",
  additions: 2,
  deletions: 2,
  lines: [
    { type: "context", content: "def authenticate(token: str) -> bool:" },
    { type: "del", content: "    if token:", oldLine: 2 },
    { type: "del", content: "        return True", oldLine: 3 },
    { type: "add", content: "    if token and validate_token(token):", newLine: 2 },
    { type: "add", content: "        return True", newLine: 3 },
    { type: "context", content: "    return False" },
  ],
};

const DIFF_ATTEMPT_2: FileDiff = {
  path: "src/auth/service.py",
  language: "python",
  additions: 3,
  deletions: 0,
  lines: [
    { type: "add", content: "from .validators import validate_token", newLine: 1 },
    { type: "add", content: "", newLine: 2 },
    { type: "add", content: "", newLine: 3 },
    { type: "context", content: "def authenticate(token: str) -> bool:" },
    { type: "context", content: "    if token and validate_token(token):" },
    { type: "context", content: "        return True" },
    { type: "context", content: "    return False" },
  ],
};

const SEARCH_MATCHES: CodeMatch[] = [
  { file: "src/auth/service.py", line: 1, snippet: "def authenticate(token: str) -> bool:" },
  { file: "src/auth/service.py", line: 2, snippet: "    if token:" },
  { file: "src/auth/middleware.py", line: 8, snippet: "if not authenticate(request.token):" },
  { file: "src/auth/middleware.py", line: 15, snippet: 'logger.info("authenticate check passed")' },
  { file: "src/users/service.py", line: 42, snippet: "def authenticate_and_fetch_user(token):" },
  { file: "tests/test_auth.py", line: 10, snippet: "def test_authenticate_accepts_valid_token():" },
  { file: "tests/test_auth.py", line: 18, snippet: "def test_authenticate_rejects_invalid_token():" },
];

const AUTH_TESTS = [
  "test_login_with_valid_credentials",
  "test_login_with_invalid_credentials",
  "test_authenticate_accepts_valid_token",
  "test_authenticate_rejects_invalid_token",
  "test_authenticate_rejects_empty_token",
  "test_session_expires_after_timeout",
];
const PAYMENTS_TESTS = [
  "test_create_payment_intent",
  "test_capture_payment",
  "test_refund_payment",
  "test_reject_invalid_card",
  "test_apply_discount_code",
  "test_calculate_tax",
  "test_currency_conversion",
  "test_payment_webhook_signature",
  "test_idempotent_payment_retry",
  "test_payment_history_pagination",
];
const USERS_TESTS = [
  "test_create_user",
  "test_update_user_profile",
  "test_delete_user",
  "test_user_email_validation",
  "test_user_password_hashing",
  "test_duplicate_email_rejected",
  "test_user_role_permissions",
  "test_user_search",
];

function buildTestSummary(failing: string | null): TestSummary {
  const all = [
    ...AUTH_TESTS.map((name) => ({ name, file: "tests/test_auth.py" })),
    ...PAYMENTS_TESTS.map((name) => ({ name, file: "tests/test_payments.py" })),
    ...USERS_TESTS.map((name) => ({ name, file: "tests/test_users.py" })),
  ];
  const tests = all.map(({ name, file }) => {
    if (name === failing) {
      return {
        name,
        status: "failed" as const,
        durationMs: 8,
        file,
        line: 24,
        error: "NameError: name 'validate_token' is not defined",
      };
    }
    return { name, status: "passed" as const, durationMs: 20 + Math.round(Math.random() * 40), file };
  });
  const failed = tests.filter((t) => t.status === "failed").length;
  return {
    passed: tests.length - failed,
    failed,
    warnings: 0,
    totalTimeMs: failing ? 1380 : 1420,
    tests,
  };
}

export function buildDemoScenario(): ScenarioStep[] {
  return [
    {
      agentRole: "planner",
      title: "Planner",
      message: "Understanding the task and repository structure...",
      detail:
        "Plan: locate the authentication handler, identify the validation flaw, patch it, and confirm with the test suite.",
      runningDurationMs: 1700,
    },
    {
      agentRole: "coder",
      tool: "list_dir",
      title: "List Directory",
      message: "Scanning repository structure...",
      args: { path: "." },
      detail: "4 entries found",
      runningDurationMs: 900,
    },
    {
      agentRole: "coder",
      tool: "search_code",
      title: "Search Code",
      message: "Searching source files for authentication handlers...",
      args: { pattern: "authenticate", path: "src/" },
      matches: SEARCH_MATCHES,
      detail: `${SEARCH_MATCHES.length} matches found`,
      runningDurationMs: 1100,
    },
    {
      agentRole: "coder",
      tool: "read_file",
      title: "Read File",
      message: "Reading src/auth/service.py...",
      fileContent: { path: "src/auth/service.py", language: "python", content: SERVICE_BEFORE },
      runningDurationMs: 1000,
    },
    {
      agentRole: "planner",
      title: "Planner",
      message: "Identified token validation as the likely failure point.",
      detail:
        "authenticate() returns True for any non-empty token without verifying it against configured signing keys.",
      runningDurationMs: 1600,
    },
    {
      agentRole: "coder",
      tool: "edit_file",
      title: "Edit File",
      message: "Applying a targeted fix to src/auth/service.py...",
      diff: DIFF_ATTEMPT_1,
      detail: "+2 / -2 lines",
      runningDurationMs: 1200,
    },
    {
      agentRole: "coder",
      tool: "git_diff",
      title: "Git Diff",
      message: "Reviewing the change against the working tree...",
      diff: DIFF_ATTEMPT_1,
      runningDurationMs: 800,
    },
    {
      agentRole: "coder",
      tool: "run_tests",
      title: "Run Tests",
      message: "Running 24 tests...",
      tests: buildTestSummary("test_authenticate_rejects_invalid_token"),
      detail: "1 failed",
      runningDurationMs: 1800,
    },
    {
      agentRole: "planner",
      title: "Planner",
      message: "Analyzing the test failure...",
      detail:
        "NameError: validate_token is referenced but never imported in src/auth/service.py. Adding the missing import.",
      runningDurationMs: 1700,
    },
    {
      agentRole: "coder",
      tool: "edit_file",
      title: "Edit File",
      message: "Applying a follow-up fix to src/auth/service.py...",
      diff: DIFF_ATTEMPT_2,
      detail: "+3 / -0 lines",
      runningDurationMs: 1100,
    },
    {
      agentRole: "coder",
      tool: "run_tests",
      title: "Run Tests",
      message: "Re-running the test suite...",
      tests: buildTestSummary(null),
      detail: "24 passed",
      runningDurationMs: 1900,
    },
    {
      agentRole: "reviewer",
      title: "Reviewer",
      message: "Performing final review...",
      detail: "Change is minimal, scoped to authentication, and fully covered by the existing test suite.",
      runningDurationMs: 1500,
    },
    {
      agentRole: "reviewer",
      title: "Task Completed",
      message: "Authentication bug fixed successfully.",
      detail: "src/auth/service.py now validates tokens against configured signing keys before granting access.",
      runningDurationMs: 700,
      final: true,
    },
  ];
}

export function buildGenericScenario(taskTitle: string): ScenarioStep[] {
  const topic = extractTopic(taskTitle);
  return [
    {
      agentRole: "planner",
      title: "Planner",
      message: "Understanding the task and repository structure...",
      detail: `Plan: locate the relevant module, apply a scoped change, and confirm with the test suite.`,
      runningDurationMs: 1500,
    },
    {
      agentRole: "coder",
      tool: "search_code",
      title: "Search Code",
      message: `Searching source files for "${topic}"...`,
      args: { pattern: topic, path: "src/" },
      matches: [
        { file: "src/app.py", line: 12, snippet: `# ${topic} handled here` },
        { file: "src/app.py", line: 34, snippet: `def handle_${topic.replace(/\s+/g, "_")}():` },
      ],
      detail: "2 matches found",
      runningDurationMs: 1000,
    },
    {
      agentRole: "coder",
      tool: "read_file",
      title: "Read File",
      message: "Reading src/app.py...",
      fileContent: {
        path: "src/app.py",
        language: "python",
        content: `def handle_${topic.replace(/\s+/g, "_")}():\n    pass\n`,
      },
      runningDurationMs: 900,
    },
    {
      agentRole: "coder",
      tool: "edit_file",
      title: "Edit File",
      message: "Applying a targeted change to src/app.py...",
      diff: {
        path: "src/app.py",
        language: "python",
        additions: 2,
        deletions: 1,
        lines: [
          { type: "context", content: `def handle_${topic.replace(/\s+/g, "_")}():` },
          { type: "del", content: "    pass", oldLine: 2 },
          { type: "add", content: "    return True", newLine: 2 },
          { type: "add", content: "", newLine: 3 },
        ],
      },
      detail: "+2 / -1 lines",
      runningDurationMs: 1100,
    },
    {
      agentRole: "coder",
      tool: "run_tests",
      title: "Run Tests",
      message: "Running the test suite...",
      tests: {
        passed: 12,
        failed: 0,
        warnings: 0,
        totalTimeMs: 640,
        tests: Array.from({ length: 12 }, (_, i) => ({
          name: `test_${topic.replace(/\s+/g, "_")}_${i + 1}`,
          status: "passed" as const,
          durationMs: 15 + i,
          file: "tests/test_app.py",
        })),
      },
      detail: "12 passed",
      runningDurationMs: 1400,
    },
    {
      agentRole: "reviewer",
      title: "Task Completed",
      message: "Task completed successfully.",
      detail: "Change is scoped and verified by the test suite.",
      runningDurationMs: 700,
      final: true,
    },
  ];
}

function extractTopic(title: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
  return words.slice(0, 2).join(" ") || "target logic";
}

const STOPWORDS = new Set([
  "that",
  "this",
  "with",
  "make",
  "sure",
  "there",
  "please",
  "task",
  "into",
  "from",
  "then",
]);
