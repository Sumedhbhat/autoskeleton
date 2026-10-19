import { Skeleton } from "autoskeleton";
import { IssueRow, ISSUE_PLACEHOLDER } from "./IssueRow";
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
  return (
    <>
      <Skeleton loading={loading}>
        <ul className="issues">
          {(loading ? ISSUE_PLACEHOLDER : items).map((issue) => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
        </ul>
      </Skeleton>
      {!loading && loadingMore && (
        <Skeleton loading>
          <ul className="issues">
            {ISSUE_PLACEHOLDER.map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
          </ul>
        </Skeleton>
      )}
      {!loading && hasMore && (
        <button className="btn" data-action="load-more" onClick={onLoadMore} disabled={loadingMore}>
          Load more
        </button>
      )}
    </>
  );
}
