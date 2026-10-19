import { IssueRow } from "./IssueRow";
import { Skeleton } from "autoskeleton";
import { ISSUES_PLACEHOLDER } from "../placeholders";
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
          {(loading ? ISSUES_PLACEHOLDER : items).map((issue) => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
        </ul>
      </Skeleton>
      {loadingMore && (
        <Skeleton loading>
          <ul className="issues">
            {ISSUES_PLACEHOLDER.map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
          </ul>
        </Skeleton>
      )}
      {hasMore && !loading && (
        <button className="btn" data-action="load-more" onClick={onLoadMore} disabled={loadingMore}>
          Load more
        </button>
      )}
    </>
  );
}
