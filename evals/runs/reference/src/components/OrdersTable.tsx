import type { Order } from "../api";

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
