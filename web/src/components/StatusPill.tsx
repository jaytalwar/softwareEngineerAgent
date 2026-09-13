import type { ActivityState } from "../lib/activity";
import styles from "./StatusPill.module.css";

interface StatusPillProps {
  state: ActivityState;
  label: string;
  className?: string;
}

export function StatusPill({ state, label, className }: StatusPillProps) {
  return (
    <span className={[styles.pill, styles[state], className].filter(Boolean).join(" ")}>
      <span className={styles.dot} aria-hidden="true" />
      {label}
    </span>
  );
}

export function ThinkingDots({ className }: { className?: string }) {
  return (
    <span className={[styles.dots, className].filter(Boolean).join(" ")} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}
