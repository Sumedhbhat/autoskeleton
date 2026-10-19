import { useEffect } from "react";
import { fake, useSkeleton } from "autoskeleton";
import { markSeen, type Issue } from "../api";
import { initials, shortDate } from "../format";

// Stand-in rows used while issues load. Shape matches a real Issue.
export const ISSUE_PLACEHOLDER: Issue[] = fake.list(5, (i) => ({
  id: fake.id(i),
  title: fake.sentence(6, i),
  status: "open",
  assignee: { name: fake.name(i), avatarUrl: fake.image(28, 28) },
  labels: [{ name: "design", color: "#9333ea" }],
  createdAt: "2026-09-01T00:00:00.000Z",
  estimate: 2.5,
}));

export function IssueRow({ issue }: { issue: Issue }) {
  const isSkeleton = useSkeleton();

  // Tell the server this user has seen the issue. Placeholder rows must not report.
  useEffect(() => {
    if (isSkeleton) return;
    markSeen(issue.id);
    // isSkeleton is deliberately not a dependency: a row that stays mounted across
    // a search refetch should not be marked again when the skeleton clears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue.id]);

  return (
    <li className="issue">
      <span className={`status-dot ${issue.status}`} aria-label={issue.status} />
      <div className="issue-main">
        <div className="issue-title">
          {issue.title}
          {issue.labels.map((l) => (
            <span key={l.name} className="label" style={{ color: l.color, borderColor: l.color }}>
              {l.name}
            </span>
          ))}
        </div>
        <div className="issue-meta">
          {issue.id} · opened {shortDate(issue.createdAt)} · {issue.estimate.toFixed(1)}d
        </div>
      </div>
      {issue.assignee ? (
        <img className="assignee" src={issue.assignee.avatarUrl} alt={initials(issue.assignee.name)} width={28} height={28} />
      ) : (
        <span className="unassigned">Unassigned</span>
      )}
    </li>
  );
}
