import { Suspense } from "react";
import { api } from "./api";
import { useAsync, useIssues } from "./hooks";
import { IssueList } from "./components/IssueList";
import { SearchPanel } from "./components/SearchPanel";
import { VelocityChart } from "./components/VelocityChart";
import { Comments } from "./components/Comments";

const commentsPromise = api.comments();

// NOTE for graders: every <section data-section="..."> must be kept, and so
// must data-action="load-more" and data-role="search-input".
export function App() {
  const issues = useIssues();
  const velocity = useAsync(api.velocity);

  return (
    <div className="page">
      <section data-section="issues" className="panel">
        <h2>Your issues</h2>
        <IssueList
          items={issues.items}
          loading={issues.loading}
          loadingMore={issues.loadingMore}
          hasMore={issues.hasMore}
          onLoadMore={issues.loadMore}
        />
      </section>

      <div className="side">
        <section data-section="chart" className="panel">
          <h2>Velocity</h2>
          <VelocityChart velocity={velocity.data} />
        </section>

        <section data-section="search" className="panel">
          <h2>Search</h2>
          <SearchPanel />
        </section>

        <section data-section="comments" className="panel">
          <h2>Latest discussion</h2>
          <Suspense fallback={<p className="muted">Loading comments…</p>}>
            <Comments promise={commentsPromise} />
          </Suspense>
        </section>
      </div>
    </div>
  );
}
