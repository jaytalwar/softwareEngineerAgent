import type { ReactNode } from "react";
import { CloseIcon } from "../../components/icons";
import { StatusPill } from "../../components/StatusPill";
import { deriveActivity } from "../../lib/activity";
import { formatCost, formatTokens } from "../../lib/format";
import type { Task } from "../../lib/types";
import styles from "./Inspector.module.css";

interface InspectorProps {
  task: Task | undefined;
  open: boolean;
  onClose: () => void;
}

export function Inspector({ task, open, onClose }: InspectorProps) {
  if (!task) {
    return (
      <>
        {open && <div className={styles.scrim} onClick={onClose} aria-hidden="true" />}
        <aside className={[styles.inspector, open ? styles.open : ""].filter(Boolean).join(" ")}>
          <Header onClose={onClose} />
          <p className={styles.emptyHint}>Select a task to see its live metrics.</p>
        </aside>
      </>
    );
  }

  const activity = deriveActivity(task);
  const toolsUsed = new Set(task.timeline.filter((e) => e.tool).map((e) => e.tool)).size;
  const lastTests = [...task.timeline].reverse().find((e) => e.tests)?.tests;

  return (
    <>
      {open && <div className={styles.scrim} onClick={onClose} aria-hidden="true" />}
      <aside className={[styles.inspector, open ? styles.open : ""].filter(Boolean).join(" ")}>
        <Header onClose={onClose} />

        <div className={styles.body}>
        <Field label="Task">
          <p className={styles.taskTitle}>{task.title}</p>
        </Field>

        <Field label="Status">
          <StatusPill state={activity.state} label={activity.label} />
        </Field>

        <div className={styles.grid}>
          <Metric label="Iterations" value={`${task.iteration} / ${task.budgetMaxIterations}`} />
          <Metric label="Tokens" value={formatTokens(task.totalTokens)} />
          <Metric label="Est. Cost" value={formatCost(task.totalCostUsd)} />
          <Metric label="Tools Used" value={String(toolsUsed)} />
          <Metric label="Files Modified" value={String(task.filesModified.length)} />
          <Metric
            label="Tests"
            value={lastTests ? `${lastTests.passed} passed` : "—"}
            tone={lastTests && lastTests.failed > 0 ? "danger" : "default"}
          />
        </div>

        <div className={styles.budgetBar} role="progressbar" aria-label="Iteration budget used">
          <div
            className={styles.budgetFill}
            style={{ width: `${Math.min(100, (task.iteration / task.budgetMaxIterations) * 100)}%` }}
          />
        </div>

        {task.filesModified.length > 0 && (
          <Field label="Modified Files">
            <ul className={styles.fileList}>
              {task.filesModified.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </Field>
        )}
        </div>
      </aside>
    </>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.header}>
      <p className={styles.headerTitle}>Inspector</p>
      <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close inspector">
        <CloseIcon size={14} />
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <p className={styles.fieldLabel}>{label}</p>
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className={styles.metric}>
      <p className={styles.fieldLabel}>{label}</p>
      <p className={[styles.metricValue, tone === "danger" ? styles.danger : ""].filter(Boolean).join(" ")}>
        {value}
      </p>
    </div>
  );
}
