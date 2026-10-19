import { fake } from "autoskeleton";
import type { Notification } from "../api";

// Stand-in items used to lay out the skeleton while notifications load.
export const notificationsPlaceholder: Notification[] = fake.list(3, (i) => ({
  id: `placeholder-${i}`,
  title: fake.text(20, i),
  body: fake.sentence(12, i + 1),
  time: fake.text(5, i + 2),
  unread: i === 0,
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
