import type { Notification } from "../api";

export function Notifications({ items }: { items: Notification[] }) {
  return (
    <ul className="notifications">
      {items.map((n) => (
        <li key={n.id} className={n.unread ? "unread" : undefined}>
          <div className="notif-head">
            <strong>{n.title}</strong>
            <span className="muted small">{n.time}</span>
          </div>
          <p>{n.body}</p>
        </li>
      ))}
    </ul>
  );
}
