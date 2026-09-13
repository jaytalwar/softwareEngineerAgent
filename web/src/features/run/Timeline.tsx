import type { ComponentType } from "react";
import { CoderIcon, PlannerIcon, ReviewerIcon } from "../../components/icons";
import { Skeleton } from "../../components/Skeleton";
import type { AgentRole, TimelineStep } from "../../lib/types";
import { ToolCallRow } from "./ToolCallRow";
import styles from "./Timeline.module.css";

const ROLE_ICON: Record<AgentRole, ComponentType<{ size?: number; className?: string }>> = {
  planner: PlannerIcon,
  coder: CoderIcon,
  reviewer: ReviewerIcon,
};

const ROLE_LABEL: Record<AgentRole, string> = {
  planner: "Planner",
  coder: "Coder",
  reviewer: "Reviewer",
};

interface TimelineProps {
  timeline: TimelineStep[];
  isActive: boolean;
}

export function Timeline({ timeline, isActive }: TimelineProps) {
  if (timeline.length === 0) {
    return (
      <ol className={styles.timeline}>
        <TimelineSkeletonRow />
      </ol>
    );
  }

  const allDone = timeline.every((s) => s.status === "done");

  return (
    <ol className={styles.timeline}>
      {timeline.map((step) => {
        const Icon = ROLE_ICON[step.role];
        return (
          <li key={step.id} className={styles.step}>
            <div className={styles.stepMarker}>
              <span
                className={[styles.stepIcon, step.status === "running" ? styles.stepIconActive : ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Icon size={15} />
              </span>
              <span className={styles.stepLine} aria-hidden="true" />
            </div>
            <div className={styles.stepBody}>
              <p className={styles.stepRole}>{ROLE_LABEL[step.role]}</p>
              {step.status === "running" ? (
                <div className={styles.stepSkeleton}>
                  <Skeleton width="80%" height="0.9em" />
                  <Skeleton width="55%" height="0.9em" />
                </div>
              ) : (
                <p className={styles.stepSummary}>{step.summary}</p>
              )}
              {step.toolCalls.length > 0 && (
                <div className={styles.toolCalls}>
                  {step.toolCalls.map((call) => (
                    <ToolCallRow key={call.id} call={call} />
                  ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
      {isActive && allDone && <TimelineSkeletonRow />}
    </ol>
  );
}

function TimelineSkeletonRow() {
  return (
    <li className={styles.step}>
      <div className={styles.stepMarker}>
        <span className={styles.stepIcon}>
          <Skeleton width={15} height={15} radius="50%" />
        </span>
      </div>
      <div className={styles.stepBody}>
        <Skeleton width="30%" height="0.9em" />
        <div className={styles.stepSkeleton}>
          <Skeleton width="85%" height="0.9em" />
          <Skeleton width="60%" height="0.9em" />
        </div>
      </div>
    </li>
  );
}
