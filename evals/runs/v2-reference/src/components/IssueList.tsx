import { IssueRow } from "./IssueRow";
import { Skeleton } from "autoskeleton";
import { issuePlaceholders } from "../placeholders";
import type { Issue } from "../api";

const PAGE = issuePlaceholders(5);
const NEXT_PAGE = issuePlaceholders(5, 5);

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
    <Skeleton loading={loading}>
      <ul className="issues">
        {(loading ? PAGE : items).map((issue) => (
          <IssueRow key={issue.id} issue={issue} />
        ))}
        {loadingMore && (
          <Skeleton loading>
            {NEXT_PAGE.map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
          </Skeleton>
        )}
      </ul>
      {hasMore && (
        <button className="btn" data-action="load-more" onClick={onLoadMore} disabled={loadingMore}>
          Load more
        </button>
      )}
    </Skeleton>
  );
}
