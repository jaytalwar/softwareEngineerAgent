import type { ToolCallEvent } from "../../lib/types";
import styles from "./ToolCallRow.module.css";

export function ToolCallRow({ call }: { call: ToolCallEvent }) {
  return (
    <details className={styles.row}>
      <summary className={styles.summary}>
        <span
          className={[styles.dot, call.success ? styles.dotOk : styles.dotErr].join(" ")}
          aria-hidden="true"
        />
        <span className={styles.tool}>{call.tool}</span>
        <span className={styles.args}>{formatArgs(call.args)}</span>
      </summary>
      {call.result && <pre className={styles.result}>{call.result}</pre>}
    </details>
  );
}

function formatArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return "()";
  return entries.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ");
}
