import { useEffect } from "react";
import { Skeleton, fake } from "autoskeleton";
import { api, track } from "../api";
import type { Activity } from "../api";
import { useAsync } from "../useAsync";

const ACTIVITY_PLACEHOLDER: Activity[] = fake.list(4, (i) => ({
  id: fake.id(i),
  actor: fake.text(5),
  action: fake.text(8),
  target: fake.text(16),
  time: "5m",
}));

function ActivityList({ items }: { items: Activity[] }) {
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

  // Only real data is reported; placeholders live solely inside <Skeleton>.
  useEffect(() => {
    if (data) track("activity_impressions", data.map((a) => a.id));
  }, [data]);

  return (
    <Skeleton data={data} placeholder={ACTIVITY_PLACEHOLDER}>
      {(items) => <ActivityList items={items} />}
    </Skeleton>
  );
}
