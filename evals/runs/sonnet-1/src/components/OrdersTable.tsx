import { Skeleton, fake } from "autoskeleton";
import type { Order } from "../api";

const ORDERS_PLACEHOLDER: Order[] = fake.list(4, (i) => ({
  id: fake.id(i),
  date: "Sep 28, 2026",
  items: 3,
  total: "$128.40",
  status: (["delivered", "shipped", "processing", "delivered"] as const)[i],
}));

export function OrdersTable({ orders }: { orders: Order[] | undefined }) {
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
      <Skeleton as="tbody" data={orders} placeholder={ORDERS_PLACEHOLDER}>
        {(rows) =>
          rows.map((o) => (
            <tr key={o.id}>
              <td className="mono">{o.id}</td>
              <td>{o.date}</td>
              <td>{o.items}</td>
              <td className="right">{o.total}</td>
              <td>
                <span className={`status status-${o.status}`}>{o.status}</span>
              </td>
            </tr>
          ))
        }
      </Skeleton>
    </table>
  );
}
