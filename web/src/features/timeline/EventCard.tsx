import { useState } from "react";
import { ChevronDownIcon, ChevronIcon } from "../../components/icons";
import { Skeleton } from "../../components/Skeleton";
import { ThinkingDots } from "../../components/StatusPill";
import { formatEventDuration } from "../../lib/format";
import { ROLE_ICON, ROLE_LABEL, TOOL_ICON } from "../../lib/toolMeta";
import type { CodeMatch, TimelineEvent } from "../../lib/types";
import { CodeBlock } from "./CodeBlock";
import { DiffViewer } from "./DiffViewer";
import { TestResults } from "./TestResults";
import styles from "./EventCard.module.css";

function hasDetails(event: TimelineEvent): boolean {
  return Boolean(
    (event.args && Object.keys(event.args).length > 0) ||
      event.matches ||
      event.fileContent ||
      event.diff ||
      event.tests,
  );
}

export function EventCard({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const canExpand = hasDetails(event);
  const [expanded, setExpanded] = useState(canExpand);
  const Icon = event.tool ? TOOL_ICON[event.tool] : ROLE_ICON[event.agentRole];
  const label = event.tool ? event.title : ROLE_LABEL[event.agentRole];
  const isRunning = event.status === "running";

  return (
    <li className={styles.step}>
      <div className={styles.marker}>
        <span
          className={[styles.iconWrap, isRunning ? styles.running : "", event.final ? styles.finalIcon : ""]
            .filter(Boolean)
            .join(" ")}
        >
          <Icon size={15} />
        </span>
        {!isLast && <span className={styles.line} aria-hidden="true" />}
      </div>

      <div className={[styles.card, event.final ? styles.finalCard : ""].filter(Boolean).join(" ")}>
        <button
          type="button"
          className={styles.cardHeader}
          onClick={() => canExpand && setExpanded((v) => !v)}
          aria-expanded={canExpand ? expanded : undefined}
        >
          <div className={styles.headerText}>
            <p className={styles.title}>{label}</p>
            <p className={styles.message}>
              {event.message}
              {isRunning && <ThinkingDots className={styles.thinkingDots} />}
            </p>
            {event.detail && !event.tool && !isRunning && (
              <p className={styles.reasoning}>{event.detail}</p>
            )}
          </div>
          <div className={styles.headerMeta}>
            {event.detail && event.tool && !isRunning && (
              <span className={styles.detail}>{event.detail}</span>
            )}
            {event.durationMs !== undefined && (
              <span className={styles.duration}>{formatEventDuration(event.durationMs)}</span>
            )}
            {canExpand && (expanded ? <ChevronDownIcon size={11} /> : <ChevronIcon size={11} />)}
          </div>
        </button>

        {isRunning && !canExpand && (
          <div className={styles.skeletonBody}>
            <Skeleton width="60%" height="0.8em" />
          </div>
        )}

        {expanded && canExpand && (
          <div className={styles.details}>
            {event.args && Object.keys(event.args).length > 0 && <ArgsList args={event.args} />}
            {event.matches && <MatchList matches={event.matches} />}
            {event.fileContent && (
              <CodeBlock
                path={event.fileContent.path}
                language={event.fileContent.language}
                content={event.fileContent.content}
              />
            )}
            {event.diff && <DiffViewer diff={event.diff} />}
            {event.tests && <TestResults tests={event.tests} />}
          </div>
        )}
      </div>
    </li>
  );
}

function ArgsList({ args }: { args: Record<string, unknown> }) {
  return (
    <dl className={styles.argsList}>
      {Object.entries(args).map(([key, value]) => (
        <div key={key} className={styles.argRow}>
          <dt>{key}</dt>
          <dd>{typeof value === "string" ? value : JSON.stringify(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function MatchList({ matches }: { matches: CodeMatch[] }) {
  return (
    <div className={styles.matchList}>
      {matches.map((m, i) => (
        <div key={i} className={styles.matchRow}>
          <span className={styles.matchLocation}>
            {m.file}:{m.line}
          </span>
          <code className={styles.matchSnippet}>{m.snippet}</code>
        </div>
      ))}
    </div>
  );
}
