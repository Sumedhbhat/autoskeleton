import { useState } from "react";
import { useSearch } from "../hooks";
import { Skeleton } from "autoskeleton";
import { IssueRow } from "./IssueRow";
import { issuePlaceholders } from "../placeholders";

const RESULTS = issuePlaceholders(4);

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
          {(fetching ? RESULTS : (data ?? [])).map((issue) => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
        </ul>
      </Skeleton>
    </div>
  );
}
