import { Skeleton } from "../../components/Skeleton";
import type { TimelineEvent } from "../../lib/types";
import { EventCard } from "./EventCard";
import styles from "./Timeline.module.css";

export function Timeline({ timeline }: { timeline: TimelineEvent[] }) {
  if (timeline.length === 0) {
    return (
      <ol className={styles.timeline}>
        <li className={styles.skeletonStep}>
          <Skeleton width={32} height={32} radius="50%" />
          <div className={styles.skeletonLines}>
            <Skeleton width="30%" height="0.8em" />
            <Skeleton width="70%" height="0.9em" />
          </div>
        </li>
      </ol>
    );
  }

  return (
    <ol className={styles.timeline}>
      {timeline.map((event, i) => (
        <EventCard key={event.id} event={event} isLast={i === timeline.length - 1} />
      ))}
    </ol>
  );
}
