import { useEffect } from "react";
import { fake, useSkeleton } from "autoskeleton";
import { track } from "../api";
import type { Activity } from "../api";

export const ACTIVITY_PLACEHOLDER: Activity[] = fake.list(4, (i) => ({
  id: fake.id(i),
  actor: fake.name(i),
  action: "reviewed",
  target: fake.text(14),
  time: "5m",
}));

// Reports which activity items were shown. Skipped while showing the skeleton
// so placeholder ids never reach analytics.
export function ActivityFeed({ items }: { items: Activity[] }) {
  const isSkeleton = useSkeleton();

  useEffect(() => {
    if (isSkeleton) return;
    track("activity_impressions", items.map((a) => a.id));
  }, [items, isSkeleton]);

  return (
    <ol className="activity">
      {items.map((a) => (
        <li key={a.id}>
          <span className="activity-avatar">{a.actor[0]}</span>
          <span>
            <strong>{a.actor}</strong> {a.action} <em>{a.target}</em>
          </span>
          <span className="muted small">{a.time}</span>
        </li>
      ))}
    </ol>
  );
}
