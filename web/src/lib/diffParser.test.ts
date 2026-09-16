import { describe, expect, it } from "vitest";
import { diffFromEditArgs, guessLanguage, parseUnifiedDiff } from "./diffParser";

describe("guessLanguage", () => {
  it("recognizes Python files", () => {
    expect(guessLanguage("src/auth/service.py")).toBe("python");
  });

  it("falls back to plaintext for anything else", () => {
    expect(guessLanguage("README.md")).toBe("plaintext");
    expect(guessLanguage("no-extension")).toBe("plaintext");
  });
});

describe("parseUnifiedDiff", () => {
  const REAL_DIFF = `diff --git a/src/auth/service.py b/src/auth/service.py
index abc123..def456 100644
--- a/src/auth/service.py
+++ b/src/auth/service.py
@@ -10,7 +10,7 @@ def authenticate(token: str) -> bool:
     if not token:
         return False
-    return True
+    return validate_token(token)
     # unreachable
`;

  it("extracts the path, counts, and typed lines from real diff output", () => {
    const diff = parseUnifiedDiff(REAL_DIFF);

    expect(diff).not.toBeNull();
    expect(diff!.path).toBe("src/auth/service.py");
    expect(diff!.language).toBe("python");
    expect(diff!.additions).toBe(1);
    expect(diff!.deletions).toBe(1);

    // The fixture's trailing "\n" produces one extra trailing empty
    // context line, same as real `git diff` output would.
    const types = diff!.lines.map((l) => l.type);
    expect(types).toEqual(["context", "context", "del", "add", "context", "context"]);
  });

  it("assigns sequential old/new line numbers starting from the hunk header", () => {
    const diff = parseUnifiedDiff(REAL_DIFF)!;

    const contextLines = diff.lines.filter((l) => l.type === "context");
    expect(contextLines[0].oldLine).toBe(10);
    expect(contextLines[0].newLine).toBe(10);

    const del = diff.lines.find((l) => l.type === "del")!;
    expect(del.oldLine).toBe(12);
    expect(del.newLine).toBeUndefined();

    const add = diff.lines.find((l) => l.type === "add")!;
    expect(add.newLine).toBe(12);
    expect(add.oldLine).toBeUndefined();
  });

  it("takes the path from the --- line when +++ is missing", () => {
    const diff = parseUnifiedDiff(
      "--- a/lib/util.py\n@@ -1,1 +1,1 @@\n-old\n+new\n",
    );

    expect(diff?.path).toBe("lib/util.py");
  });

  it("ignores the \\ No newline at end of file marker", () => {
    const diff = parseUnifiedDiff(
      "--- a/f.py\n+++ b/f.py\n@@ -1,1 +1,1 @@\n-old\n\\ No newline at end of file\n+new",
    );

    expect(diff?.lines.map((l) => l.content)).toEqual(["old", "new"]);
  });

  it("returns null for text with no path", () => {
    expect(parseUnifiedDiff("@@ -1,1 +1,1 @@\n-old\n+new\n")).toBeNull();
  });

  it("returns null for text with a path but no hunk lines", () => {
    expect(parseUnifiedDiff("--- a/f.py\n+++ b/f.py\n")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseUnifiedDiff("")).toBeNull();
  });
});

describe("diffFromEditArgs", () => {
  it("builds a line-number-free diff from old/new substrings", () => {
    const diff = diffFromEditArgs("tests/test_math_utils.py", "999", "6");

    expect(diff.path).toBe("tests/test_math_utils.py");
    expect(diff.language).toBe("python");
    expect(diff.additions).toBe(1);
    expect(diff.deletions).toBe(1);
    expect(diff.lines).toEqual([
      { type: "del", content: "999" },
      { type: "add", content: "6" },
    ]);
  });

  it("handles multi-line old/new strings", () => {
    const diff = diffFromEditArgs("a.py", "line1\nline2", "line1\nline2\nline3");

    expect(diff.deletions).toBe(2);
    expect(diff.additions).toBe(3);
    expect(diff.lines).toHaveLength(5);
  });

  it("produces no line-number fields at all", () => {
    const diff = diffFromEditArgs("a.py", "old", "new");

    for (const line of diff.lines) {
      expect(line.oldLine).toBeUndefined();
      expect(line.newLine).toBeUndefined();
    }
  });
});
