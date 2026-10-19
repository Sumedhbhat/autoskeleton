import { api } from "./api";
import { useAsync } from "./useAsync";
import { ProfileHeader } from "./components/ProfileHeader";
import { ProfileHeaderSkeleton } from "./components/ProfileHeaderSkeleton";
import { OrdersTable } from "./components/OrdersTable";
import { ProductGrid } from "./components/ProductGrid";
import { ProductGridSkeleton } from "./components/ProductCardSkeleton";
import { Notifications } from "./components/Notifications";
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
        {profile.loading || !profile.data ? <ProfileHeaderSkeleton /> : <ProfileHeader profile={profile.data} />}
      </section>

      <div className="columns">
        <section data-section="orders" className="panel">
          <h2>Recent orders</h2>
          <OrdersTable orders={orders.data} loading={orders.loading} />
        </section>

        <section data-section="notifications" className="panel">
          <h2>Notifications</h2>
          <Notifications items={notifications.data} />
        </section>
      </div>

      <section data-section="products">
        <h2>Recommended for you</h2>
        {products.loading || !products.data ? <ProductGridSkeleton /> : <ProductGrid products={products.data} />}
      </section>

      <section data-section="activity" className="panel">
        <h2>Happening now</h2>
        <ActivityFeed />
      </section>
    </div>
  );
}
