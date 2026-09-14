import type { DiffLine, FileDiff } from "./types";

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export function guessLanguage(path: string): string {
  return path.endsWith(".py") ? "python" : "plaintext";
}

/** Parses real unified-diff text (from `git_diff` output or an
 * `apply_patch` call's `diff` argument) into a renderable `FileDiff`. */
export function parseUnifiedDiff(diffText: string): FileDiff | null {
  const lines = diffText.split("\n");
  let path = "";
  let additions = 0;
  let deletions = 0;
  const diffLines: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;

  for (const line of lines) {
    if (line.startsWith("+++ ")) {
      path = line.slice(4).replace(/^b\//, "").trim();
      continue;
    }
    if (line.startsWith("--- ")) {
      if (!path) path = line.slice(4).replace(/^a\//, "").trim();
      continue;
    }
    const hunkMatch = HUNK_HEADER.exec(line);
    if (hunkMatch) {
      oldLine = Number.parseInt(hunkMatch[1], 10);
      newLine = Number.parseInt(hunkMatch[3], 10);
      inHunk = true;
      continue;
    }
    if (!inHunk || line.startsWith("\\")) continue;

    if (line.startsWith("+")) {
      diffLines.push({ type: "add", content: line.slice(1), newLine: newLine++ });
      additions++;
    } else if (line.startsWith("-")) {
      diffLines.push({ type: "del", content: line.slice(1), oldLine: oldLine++ });
      deletions++;
    } else {
      diffLines.push({ type: "context", content: line.slice(1), oldLine: oldLine++, newLine: newLine++ });
    }
  }

  if (!path || diffLines.length === 0) return null;

  return { path, language: guessLanguage(path), additions, deletions, lines: diffLines };
}

/** `edit_file` doesn't return a diff — only `old_str`/`new_str` were the
 * call arguments. Builds a minimal, line-number-free diff from them: real
 * content, just without the surrounding file context a true diff has. */
export function diffFromEditArgs(path: string, oldStr: string, newStr: string): FileDiff {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");
  const lines: DiffLine[] = [
    ...oldLines.map((content): DiffLine => ({ type: "del", content })),
    ...newLines.map((content): DiffLine => ({ type: "add", content })),
  ];
  return {
    path,
    language: guessLanguage(path),
    additions: newLines.length,
    deletions: oldLines.length,
    lines,
  };
}
