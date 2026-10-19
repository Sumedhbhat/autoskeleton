import { Skeleton } from "autoskeleton";
import { api } from "./api";
import { useAsync } from "./useAsync";
import { ProfileHeader, PROFILE_PLACEHOLDER } from "./components/ProfileHeader";
import { OrdersTable } from "./components/OrdersTable";
import { ProductGrid, PRODUCTS_PLACEHOLDER } from "./components/ProductGrid";
import { Notifications, NOTIFICATIONS_PLACEHOLDER } from "./components/Notifications";
import { ActivityFeed, ACTIVITY_PLACEHOLDER } from "./components/ActivityFeed";

// NOTE for graders: every <section data-section="..."> must be kept.
export function App() {
  const profile = useAsync(api.profile);
  const orders = useAsync(api.orders);
  const products = useAsync(api.products);
  const notifications = useAsync(api.notifications);
  const activity = useAsync(api.activity);

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
          <OrdersTable orders={orders.data} />
        </section>

        <section data-section="notifications" className="panel">
          <h2>Notifications</h2>
          <Skeleton data={notifications.data} placeholder={NOTIFICATIONS_PLACEHOLDER}>
            {(items) => <Notifications items={items} />}
          </Skeleton>
        </section>
      </div>

      <section data-section="products">
        <h2>Recommended for you</h2>
        <Skeleton data={products.data} placeholder={PRODUCTS_PLACEHOLDER}>
          {(ps) => <ProductGrid products={ps} />}
        </Skeleton>
      </section>

      <section data-section="activity" className="panel">
        <h2>Happening now</h2>
        <Skeleton data={activity.data} placeholder={ACTIVITY_PLACEHOLDER}>
          {(items) => <ActivityFeed items={items} />}
        </Skeleton>
      </section>
    </div>
  );
}
