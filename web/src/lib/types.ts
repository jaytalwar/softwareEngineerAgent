export type AgentRole = "planner" | "coder" | "reviewer";

export type TaskStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";

export interface ToolCallEvent {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  result?: string;
  success: boolean;
}

export interface TimelineStep {
  id: string;
  role: AgentRole;
  status: "running" | "done";
  summary?: string;
  toolCalls: ToolCallEvent[];
  startedAt: number;
  finishedAt?: number;
}

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
  timeline: TimelineStep[];
  failureReason?: string;
}
