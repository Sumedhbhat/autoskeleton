import { IssueRow } from "./IssueRow";
import { IssueRowSkeleton } from "./IssueRowSkeleton";
import type { Issue } from "../api";

export function IssueList({
  items,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
}: {
  items: Issue[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}) {
  if (loading) {
    return (
      <ul className="issues">
        {[0, 1, 2, 3, 4].map((i) => (
          <IssueRowSkeleton key={i} />
        ))}
      </ul>
    );
  }
  return (
    <>
      <ul className="issues">
        {items.map((issue) => (
          <IssueRow key={issue.id} issue={issue} />
        ))}
      </ul>
      {hasMore && (
        <button className="btn" data-action="load-more" onClick={onLoadMore} disabled={loadingMore}>
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </>
  );
}
