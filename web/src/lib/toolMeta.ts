import type { ComponentType } from "react";
import {
  BrainIcon,
  CheckIcon,
  EditIcon,
  FileIcon,
  FlaskIcon,
  FolderIcon,
  GitBranchIcon,
  LintIcon,
  PatchIcon,
  SearchIcon,
  TerminalIcon,
} from "../components/icons";
import type { AgentRole, ToolName } from "./types";

type IconType = ComponentType<{ size?: number; className?: string }>;

export const TOOL_ICON: Record<ToolName, IconType> = {
  read_file: FileIcon,
  write_file: FileIcon,
  edit_file: EditIcon,
  list_dir: FolderIcon,
  search_code: SearchIcon,
  run_shell: TerminalIcon,
  run_tests: FlaskIcon,
  git_diff: GitBranchIcon,
  apply_patch: PatchIcon,
  get_lint_diagnostics: LintIcon,
};

export const ROLE_ICON: Record<AgentRole, IconType> = {
  planner: BrainIcon,
  coder: EditIcon,
  reviewer: CheckIcon,
};

export const ROLE_LABEL: Record<AgentRole, string> = {
  planner: "Planner",
  coder: "Coder",
  reviewer: "Reviewer",
};
