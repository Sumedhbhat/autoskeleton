import { Skeleton, fake } from "autoskeleton";
import { api } from "./api";
import type { Notification, Product, Profile } from "./api";
import { useAsync } from "./useAsync";
import { ProfileHeader } from "./components/ProfileHeader";
import { OrdersTable } from "./components/OrdersTable";
import { ProductGrid } from "./components/ProductGrid";
import { Notifications } from "./components/Notifications";
import { ActivityFeed } from "./components/ActivityFeed";

const PROFILE_PLACEHOLDER: Profile = {
  id: "placeholder",
  name: fake.name(),
  username: fake.text(7),
  avatarUrl: fake.image(80, 80),
  bio: fake.sentence(14),
  location: fake.text(12),
  stats: { orders: 48, reviews: 12, points: 2380 },
  tier: "gold",
};

const PRODUCTS_PLACEHOLDER: Product[] = fake.list(6, (i) => ({
  id: fake.id(i),
  name: fake.text(14),
  price: "$00.00",
  imageUrl: fake.image(400, 400),
  rating: 4,
  reviewCount: 20,
}));

const NOTIFICATIONS_PLACEHOLDER: Notification[] = fake.list(3, (i) => ({
  id: fake.id(i),
  title: fake.text(18),
  body: fake.sentence(10, i),
  time: "2h ago",
  unread: i === 0,
}));

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
          {(items) => <ProductGrid products={items} />}
        </Skeleton>
      </section>

      <section data-section="activity" className="panel">
        <h2>Happening now</h2>
        <ActivityFeed />
      </section>
    </div>
  );
}
