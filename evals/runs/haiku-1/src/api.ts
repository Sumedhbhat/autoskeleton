// Fake backend. ?hold=1 keeps every request pending forever (to inspect
// loading states); ?delay=<ms> sets latency (default 900ms).
const params = new URLSearchParams(location.search);
const HOLD = params.get("hold") === "1";
const DELAY = Number(params.get("delay") ?? 900);

function respond<T>(value: T): Promise<T> {
  if (HOLD) return new Promise<T>(() => {});
  return new Promise((r) => setTimeout(() => r(value), DELAY));
}

export interface Profile {
  id: string;
  name: string;
  username: string;
  avatarUrl: string;
  bio: string;
  location: string;
  stats: { orders: number; reviews: number; points: number };
  tier: "gold" | "silver" | "bronze";
}

export interface Order {
  id: string;
  date: string;
  items: number;
  total: string;
  status: "delivered" | "shipped" | "processing";
}

export interface Product {
  id: string;
  name: string;
  price: string;
  imageUrl: string;
  rating: number;
  reviewCount: number;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
}

export interface Activity {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
}

export const api = {
  profile: () =>
    respond<Profile>({
      id: "u1",
      name: "Maya Thompson",
      username: "maya.t",
      avatarUrl: "https://i.pravatar.cc/160?img=47",
      bio: "Collector of ceramics and strong opinions about coffee. Shopping here since 2019.",
      location: "Portland, OR",
      stats: { orders: 48, reviews: 12, points: 2380 },
      tier: "gold",
    }),
  orders: () =>
    respond<Order[]>([
      { id: "#10482", date: "Oct 2, 2026", items: 3, total: "$128.40", status: "delivered" },
      { id: "#10477", date: "Sep 28, 2026", items: 1, total: "$42.00", status: "shipped" },
      { id: "#10460", date: "Sep 14, 2026", items: 5, total: "$310.75", status: "processing" },
      { id: "#10431", date: "Aug 30, 2026", items: 2, total: "$67.10", status: "delivered" },
    ]),
  products: () =>
    respond<Product[]>(
      ["Stoneware mug", "Linen apron", "Pour-over kettle", "Walnut tray", "Glass carafe", "Bamboo whisk"].map((name, i) => ({
        id: `p${i}`,
        name,
        price: `$${(i + 2) * 9}.00`,
        imageUrl: `https://picsum.photos/seed/shop${i}/400/400`,
        rating: 4 + (i % 2) * 0.5,
        reviewCount: 20 + i * 7,
      })),
    ),
  notifications: () =>
    respond<Notification[]>([
      { id: "n1", title: "Your order shipped", body: "Order #10477 is on its way and should arrive Thursday.", time: "2h ago", unread: true },
      { id: "n2", title: "Price drop", body: "The Walnut tray on your wishlist is now 15% off.", time: "1d ago", unread: true },
      { id: "n3", title: "Review reminder", body: "How was your Stoneware mug? Tell other shoppers.", time: "3d ago", unread: false },
    ]),
  activity: () =>
    respond<Activity[]>([
      { id: "a1", actor: "Jonah", action: "reviewed", target: "Pour-over kettle", time: "5m" },
      { id: "a2", actor: "Priya", action: "bought", target: "Linen apron", time: "12m" },
      { id: "a3", actor: "Sam", action: "favorited", target: "Glass carafe", time: "1h" },
      { id: "a4", actor: "Lee", action: "reviewed", target: "Walnut tray", time: "2h" },
    ]),
};

// Analytics sink: the grader reads window.__analytics.
declare global {
  interface Window {
    __analytics: { event: string; payload: unknown }[];
  }
}
window.__analytics = [];
export function track(event: string, payload: unknown) {
  window.__analytics.push({ event, payload });
}
