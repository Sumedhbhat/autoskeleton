import { useEffect } from "react";
import { fake, useSkeleton } from "autoskeleton";
import { markSeen, type Issue } from "../api";
import { initials, shortDate } from "../format";

/** Stand-in issue with the same shape as a real row, used to draw its skeleton. */
export function fakeIssue(i: number): Issue {
  return {
    id: `ISS-${fake.id(i)}`,
    title: fake.sentence(i % 2 === 0 ? 6 : 4, i),
    status: "open",
    assignee: i % 3 === 2 ? null : { name: fake.name(i), avatarUrl: fake.image(64, 64) },
    labels: i % 2 === 0 ? [{ name: "bug", color: "#dc2626" }] : [],
    createdAt: fake.date(),
    estimate: 2.5,
  };
}

export function IssueRow({ issue }: { issue: Issue }) {
  const skeleton = useSkeleton();

  // Tell the server this user has seen the issue. Skipped for skeleton placeholders.
  useEffect(() => {
    if (skeleton) return;
    markSeen(issue.id);
  }, [issue.id, skeleton]);

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
