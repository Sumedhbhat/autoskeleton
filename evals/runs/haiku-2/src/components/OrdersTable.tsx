import { Skeleton, fake } from "autoskeleton";
import type { Order } from "../api";

export const ORDERS_PLACEHOLDER: Order[] = fake.list(4, (i): Order => ({
  id: fake.id(i),
  date: fake.date(),
  items: fake.number(1),
  total: "$00.00",
  status: "delivered",
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
