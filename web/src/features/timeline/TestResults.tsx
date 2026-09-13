import { useState } from "react";
import { CheckIcon, ChevronDownIcon, ChevronIcon, CloseIcon } from "../../components/icons";
import type { TestSummary } from "../../lib/types";
import styles from "./TestResults.module.css";

export function TestResults({ tests }: { tests: TestSummary }) {
  const [expanded, setExpanded] = useState(tests.failed > 0);
  const failing = tests.tests.filter((t) => t.status === "failed");
  const passing = tests.tests.filter((t) => t.status === "passed");

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.header} onClick={() => setExpanded((v) => !v)}>
        {expanded ? <ChevronDownIcon size={11} /> : <ChevronIcon size={11} />}
        <span className={styles.summary}>
          <span className={styles.passedCount}>
            <CheckIcon size={11} /> {tests.passed} passed
          </span>
          <span className={tests.failed > 0 ? styles.failedCount : styles.mutedCount}>
            <CloseIcon size={9} /> {tests.failed} failed
          </span>
          <span className={styles.mutedCount}>{tests.warnings} warnings</span>
        </span>
        <span className={styles.time}>{(tests.totalTimeMs / 1000).toFixed(2)}s</span>
      </button>

      {expanded && (
        <div className={styles.body}>
          {failing.map((t) => (
            <div key={t.name} className={styles.testRowFailed}>
              <div className={styles.testRowHeader}>
                <CloseIcon size={10} className={styles.failedIcon} />
                <span className={styles.testName}>{t.name}</span>
              </div>
              {t.error && <p className={styles.error}>{t.error}</p>}
              {t.file && (
                <p className={styles.location}>
                  {t.file}
                  {t.line ? `:${t.line}` : ""}
                </p>
              )}
            </div>
          ))}
          {passing.map((t) => (
            <div key={t.name} className={styles.testRow}>
              <CheckIcon size={10} className={styles.passedIcon} />
              <span className={styles.testName}>{t.name}</span>
              <span className={styles.duration}>{t.durationMs}ms</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
