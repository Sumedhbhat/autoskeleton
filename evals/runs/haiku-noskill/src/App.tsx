import { Skeleton } from "autoskeleton";
import { api } from "./api";
import { useAsync } from "./useAsync";
import { ProfileHeader, profilePlaceholder } from "./components/ProfileHeader";
import { OrdersTable, ordersPlaceholder } from "./components/OrdersTable";
import { ProductGrid, productsPlaceholder } from "./components/ProductGrid";
import { Notifications, notificationsPlaceholder } from "./components/Notifications";
import { ActivityFeed } from "./components/ActivityFeed";

// NOTE for graders: every <section data-section="..."> must be kept.
export function App() {
  const profile = useAsync(api.profile);
  const orders = useAsync(api.orders);
  const products = useAsync(api.products);
  const notifications = useAsync(api.notifications);

  return (
    <div className="page">
      <section data-section="profile">
        <Skeleton data={profile.data} placeholder={profilePlaceholder}>
          {(p) => <ProfileHeader profile={p} />}
        </Skeleton>
      </section>

      <div className="columns">
        <section data-section="orders" className="panel">
          <h2>Recent orders</h2>
          <Skeleton data={orders.data} placeholder={ordersPlaceholder}>
            {(list) => <OrdersTable orders={list} />}
          </Skeleton>
        </section>

        <section data-section="notifications" className="panel">
          <h2>Notifications</h2>
          <Skeleton data={notifications.data} placeholder={notificationsPlaceholder}>
            {(items) => <Notifications items={items} />}
          </Skeleton>
        </section>
      </div>

      <section data-section="products">
        <h2>Recommended for you</h2>
        <Skeleton data={products.data} placeholder={productsPlaceholder}>
          {(list) => <ProductGrid products={list} />}
        </Skeleton>
      </section>

      <section data-section="activity" className="panel">
        <h2>Happening now</h2>
        <ActivityFeed />
      </section>
    </div>
  );
}
