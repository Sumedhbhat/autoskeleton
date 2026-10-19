import { fake } from "autoskeleton";
import type { Notification } from "../api";

export const NOTIFICATIONS_PLACEHOLDER: Notification[] = fake.list(3, (i) => ({
  id: fake.id(i),
  title: fake.sentence(4, i),
  body: fake.sentence(12, i),
  time: "2h ago",
  unread: i % 2 === 0,
}));

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
