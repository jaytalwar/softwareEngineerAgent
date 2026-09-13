import { useState } from "react";
import { ChevronDownIcon, ChevronIcon } from "../../components/icons";
import type { FileDiff } from "../../lib/types";
import { CodeLine } from "./CodeLine";
import styles from "./DiffViewer.module.css";

export function DiffViewer({ diff }: { diff: FileDiff }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.header} onClick={() => setExpanded((v) => !v)}>
        {expanded ? <ChevronDownIcon size={11} /> : <ChevronIcon size={11} />}
        <span className={styles.fileName}>{diff.path}</span>
        <span className={styles.stats}>
          <span className={styles.additions}>+{diff.additions}</span>
          <span className={styles.deletions}>-{diff.deletions}</span>
        </span>
      </button>

      {expanded && (
        <div className={styles.body}>
          {diff.lines.map((line, i) => (
            <div
              key={i}
              className={[styles.line, line.type === "add" ? styles.add : line.type === "del" ? styles.del : ""]
                .filter(Boolean)
                .join(" ")}
            >
              <span className={styles.lineNo}>{line.oldLine ?? ""}</span>
              <span className={styles.lineNo}>{line.newLine ?? ""}</span>
              <span className={styles.marker}>
                {line.type === "add" ? "+" : line.type === "del" ? "−" : ""}
              </span>
              <span className={styles.content}>
                <CodeLine content={line.content} language={diff.language} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
