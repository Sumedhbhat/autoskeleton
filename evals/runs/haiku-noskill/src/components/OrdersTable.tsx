import { fake } from "autoskeleton";
import type { Order } from "../api";

// Stand-in rows used to lay out the skeleton while orders load.
export const ordersPlaceholder: Order[] = fake.list(4, (i) => ({
  id: `#${fake.text(5, i)}`,
  date: fake.text(12, i + 1),
  items: 1 + i,
  total: fake.text(7, i + 2),
  status: "shipped",
}));

export function OrdersTable({ orders }: { orders: Order[] }) {
  return (
    <table className="orders">
      <thead>
        <tr>
          <th>Order</th>
          <th>Date</th>
          <th>Items</th>
          <th className="right">Total</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.id}>
            <td className="mono">{o.id}</td>
            <td>{o.date}</td>
            <td>{o.items}</td>
            <td className="right">{o.total}</td>
            <td>
              <span className={`status status-${o.status}`}>{o.status}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
