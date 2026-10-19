import { useEffect } from "react";
import { Skeleton, fake } from "autoskeleton";
import { api, track, type Activity } from "../api";
import { useAsync } from "../useAsync";

// Stand-in items used to lay out the skeleton while the feed loads.
const activityPlaceholder: Activity[] = fake.list(4, (i) => ({
  id: `placeholder-${i}`,
  actor: fake.name(i),
  action: "reviewed",
  target: fake.text(14, i + 1),
  time: fake.text(3, i + 2),
}));

// Fetches its own data. Reports which activity items were shown.
export function ActivityFeed() {
  const { data } = useAsync(api.activity);

  // Lives outside the Skeleton so it only ever sees real data, never placeholders.
  useEffect(() => {
    if (data) track("activity_impressions", data.map((a) => a.id));
  }, [data]);

  return (
    <Skeleton data={data} placeholder={activityPlaceholder}>
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
