import { fake } from "autoskeleton";
import type { Activity, Notification, Order, Product, Profile } from "./api";

export const PROFILE_PLACEHOLDER: Profile = {
  id: "placeholder",
  name: fake.name(),
  username: fake.text(8),
  avatarUrl: fake.image(80, 80),
  bio: fake.sentence(14),
  location: fake.text(12),
  stats: { orders: 88, reviews: 88, points: 8888 },
  tier: "gold",
};

export const ORDERS_PLACEHOLDER: Order[] = fake.list(4, (i) => ({
  id: `#1000${i}`,
  date: "Oct 2, 2026",
  items: 3,
  total: "$100.00",
  status: "delivered",
}));

export const PRODUCTS_PLACEHOLDER: Product[] = fake.list(6, (i) => ({
  id: fake.id(i),
  name: fake.text(14, i),
  price: "$00.00",
  imageUrl: fake.image(400, 400),
  rating: 4,
  reviewCount: 20,
}));

export const NOTIFICATIONS_PLACEHOLDER: Notification[] = fake.list(3, (i) => ({
  id: fake.id(i),
  title: fake.text(18, i),
  body: fake.sentence(10, i),
  time: "2h ago",
  unread: false,
}));

export const ACTIVITY_PLACEHOLDER: Activity[] = fake.list(4, (i) => ({
  id: fake.id(i),
  actor: fake.text(5, i),
  action: "reviewed",
  target: fake.text(14, i),
  time: "5m",
}));
