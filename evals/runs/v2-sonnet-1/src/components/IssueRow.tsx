import { useSkeleton } from "autoskeleton";
import { useEffect } from "react";
import { markSeen, type Issue } from "../api";
import { initials, shortDate } from "../format";

export function IssueRow({ issue }: { issue: Issue }) {
  // Tell the server this user has seen the issue.
  const isSkeleton = useSkeleton();
  useEffect(() => {
    if (isSkeleton) return;
    markSeen(issue.id);
  }, [issue.id, isSkeleton]);

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
