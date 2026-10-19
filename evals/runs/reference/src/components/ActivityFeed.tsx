import { useEffect } from "react";
import { Skeleton } from "autoskeleton";
import { api, track, type Activity } from "../api";
import { useAsync } from "../useAsync";
import { ACTIVITY_PLACEHOLDER } from "../placeholders";

export function ActivityList({ items }: { items: Activity[] }) {
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

// Fetches its own data. Reports which activity items were shown.
export function ActivityFeed() {
  const { data } = useAsync(api.activity);

  useEffect(() => {
    if (data) track("activity_impressions", data.map((a) => a.id));
  }, [data]);

  return (
    <Skeleton data={data} placeholder={ACTIVITY_PLACEHOLDER}>
      {(items) => <ActivityList items={items} />}
    </Skeleton>
  );
}
