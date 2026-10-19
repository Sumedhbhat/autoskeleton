import { useState } from "react";
import { Skeleton } from "autoskeleton";
import { useSearch } from "../hooks";
import { IssueRow, ISSUE_PLACEHOLDER } from "./IssueRow";

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
      <Skeleton loading={fetching}>
        <ul className="issues">
          {(data ?? ISSUE_PLACEHOLDER).map((issue) => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
        </ul>
      </Skeleton>
    </div>
  );
}
