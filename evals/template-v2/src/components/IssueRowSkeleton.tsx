// Hand-maintained skeleton for IssueRow.
export function IssueRowSkeleton() {
  return (
    <li className="issue">
      <span className="sk" style={{ width: 10, height: 10, borderRadius: 5 }} />
      <div className="issue-main">
        <div className="sk" style={{ width: "60%", height: 14 }} />
        <div className="sk" style={{ width: "35%", height: 10, marginTop: 8 }} />
      </div>
      <span className="sk" style={{ width: 28, height: 28, borderRadius: 14 }} />
    </li>
  );
}
