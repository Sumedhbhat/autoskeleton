import { Skeleton, fake } from "autoskeleton";
import { IssueRow, fakeIssue } from "./IssueRow";
import type { Issue } from "../api";

const PAGE_SIZE = 5;
const NO_ROWS: Issue[] = [];
const placeholderPage = () => fake.list(PAGE_SIZE, fakeIssue);

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
    <Skeleton data={loading ? undefined : items} placeholder={placeholderPage}>
      {(list) => (
        <>
          <ul className="issues">
            {list.map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
          </ul>
          {/* Next page: skeleton rows while it loads, real rows once it arrives. */}
          <Skeleton data={loadingMore ? undefined : NO_ROWS} placeholder={placeholderPage}>
            {(more) =>
              more.length > 0 && (
                <ul className="issues">
                  {more.map((issue) => (
                    <IssueRow key={issue.id} issue={issue} />
                  ))}
                </ul>
              )
            }
          </Skeleton>
          {hasMore && (
            <button className="btn" data-action="load-more" onClick={onLoadMore} disabled={loadingMore}>
              Load more
            </button>
          )}
        </>
      )}
    </Skeleton>
  );
}
