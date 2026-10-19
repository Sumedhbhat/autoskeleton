import { useState } from "react";
import { useSearch } from "../hooks";
import { IssueRow } from "./IssueRow";

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
      {fetching && <div className="muted">Searching…</div>}
      {data && (
        <ul className="issues" style={{ opacity: fetching ? 0.5 : 1 }}>
          {data.map((issue) => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
        </ul>
      )}
    </div>
  );
}
