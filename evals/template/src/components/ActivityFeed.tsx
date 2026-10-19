import { useEffect } from "react";
import { api, track } from "../api";
import { useAsync } from "../useAsync";

// Fetches its own data. Reports which activity items were shown.
export function ActivityFeed() {
  const { data, loading } = useAsync(api.activity);

  useEffect(() => {
    if (data) track("activity_impressions", data.map((a) => a.id));
  }, [data]);

  if (loading || !data) return <div className="muted">Loading activity…</div>;

  return (
    <ol className="activity">
      {data.map((a) => (
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
