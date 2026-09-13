const PY_KEYWORDS = new Set([
  "def",
  "return",
  "if",
  "elif",
  "else",
  "for",
  "while",
  "import",
  "from",
  "as",
  "class",
  "try",
  "except",
  "finally",
  "with",
  "pass",
  "break",
  "continue",
  "in",
  "is",
  "not",
  "and",
  "or",
  "None",
  "True",
  "False",
  "lambda",
  "yield",
  "raise",
  "global",
  "nonlocal",
  "assert",
  "async",
  "await",
  "del",
]);

export interface CodeToken {
  text: string;
  type: "keyword" | "string" | "comment" | "number" | "func" | "plain";
}

const TOKEN_RE =
  /(#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d+\.?\d*\b)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|(.)/g;

export function tokenizePython(line: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let prevWasDef = false;
  for (const match of line.matchAll(TOKEN_RE)) {
    const [, comment, str, num, word, space, other] = match;
    if (comment) tokens.push({ text: comment, type: "comment" });
    else if (str) tokens.push({ text: str, type: "string" });
    else if (num) tokens.push({ text: num, type: "number" });
    else if (word) {
      if (PY_KEYWORDS.has(word)) {
        tokens.push({ text: word, type: "keyword" });
        prevWasDef = word === "def";
      } else if (prevWasDef) {
        tokens.push({ text: word, type: "func" });
        prevWasDef = false;
      } else {
        tokens.push({ text: word, type: "plain" });
      }
    } else if (space) tokens.push({ text: space, type: "plain" });
    else if (other) tokens.push({ text: other, type: "plain" });
  }
  return tokens;
}
