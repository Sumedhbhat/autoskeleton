import { Skeleton } from "autoskeleton";
import { useState } from "react";
import { useSearch } from "../hooks";
import { IssueRow } from "./IssueRow";
import { SEARCH_PLACEHOLDER } from "../placeholders";

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
      <Skeleton loading={fetching || !data}>
        <ul className="issues">
          {(fetching || !data ? SEARCH_PLACEHOLDER : data).map((issue) => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
        </ul>
      </Skeleton>
    </div>
  );
}
