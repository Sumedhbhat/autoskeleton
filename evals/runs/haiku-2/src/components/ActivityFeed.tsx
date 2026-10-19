import { useEffect } from "react";
import { Skeleton, fake } from "autoskeleton";
import { api, track, type Activity } from "../api";
import { useAsync } from "../useAsync";

const ACTIVITY_PLACEHOLDER: Activity[] = fake.list(4, (i): Activity => ({
  id: fake.id(i),
  actor: fake.text(6),
  action: fake.text(8),
  target: fake.sentence(2, i),
  time: "5m",
}));

// Fetches its own data. Reports which activity items were shown.
// The effect runs outside the Skeleton and only sees real data, so the
// placeholder items are never reported.
export function ActivityFeed() {
  const { data } = useAsync(api.activity);

  useEffect(() => {
    if (data) track("activity_impressions", data.map((a) => a.id));
  }, [data]);

  return (
    <Skeleton data={data} placeholder={ACTIVITY_PLACEHOLDER}>
      {(items) => (
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
      )}
    </Skeleton>
  );
}
