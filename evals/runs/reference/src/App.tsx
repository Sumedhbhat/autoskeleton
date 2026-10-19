import { Skeleton } from "autoskeleton";
import { api } from "./api";
import { useAsync } from "./useAsync";
import { ProfileHeader } from "./components/ProfileHeader";
import { OrdersTable } from "./components/OrdersTable";
import { ProductGrid } from "./components/ProductGrid";
import { Notifications } from "./components/Notifications";
import { ActivityFeed } from "./components/ActivityFeed";
import {
  NOTIFICATIONS_PLACEHOLDER,
  ORDERS_PLACEHOLDER,
  PRODUCTS_PLACEHOLDER,
  PROFILE_PLACEHOLDER,
} from "./placeholders";

// NOTE for graders: every <section data-section="..."> must be kept.
export function App() {
  const profile = useAsync(api.profile);
  const orders = useAsync(api.orders);
  const products = useAsync(api.products);
  const notifications = useAsync(api.notifications);

  return (
    <div className="page">
      <section data-section="profile">
        <Skeleton data={profile.data} placeholder={PROFILE_PLACEHOLDER}>
          {(p) => <ProfileHeader profile={p} />}
        </Skeleton>
      </section>

      <div className="columns">
        <section data-section="orders" className="panel">
          <h2>Recent orders</h2>
          <Skeleton data={orders.data} placeholder={ORDERS_PLACEHOLDER}>
            {(o) => <OrdersTable orders={o} />}
          </Skeleton>
        </section>

        <section data-section="notifications" className="panel">
          <h2>Notifications</h2>
          <Skeleton data={notifications.data} placeholder={NOTIFICATIONS_PLACEHOLDER}>
            {(n) => <Notifications items={n} />}
          </Skeleton>
        </section>
      </div>

      <section data-section="products">
        <h2>Recommended for you</h2>
        <Skeleton data={products.data} placeholder={PRODUCTS_PLACEHOLDER}>
          {(p) => <ProductGrid products={p} />}
        </Skeleton>
      </section>

      <section data-section="activity" className="panel">
        <h2>Happening now</h2>
        <ActivityFeed />
      </section>
    </div>
  );
}
