import { useState } from "react";
import { Skeleton, fake } from "autoskeleton";
import { useSearch } from "../hooks";
import { IssueRow, fakeIssue } from "./IssueRow";

const placeholderResults = () => fake.list(4, fakeIssue);

export function SearchPanel() {
  const [query, setQuery] = useState("");
  const { data, fetching } = useSearch(query);
  return (
    <div>
      <input
        className="search"
        data-role="search-input"
        placeholder="Search issues…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <Skeleton data={fetching ? undefined : data} placeholder={placeholderResults}>
        {(results) => (
          <ul className="issues">
            {results.map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
          </ul>
        )}
      </Skeleton>
    </div>
  );
}
