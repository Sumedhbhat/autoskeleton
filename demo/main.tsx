import { StrictMode, Suspense, useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  Skeleton,
  SkeletonProvider,
  fake,
  measureBones,
  usePlaceholder,
  useSkeleton,
  type SkeletonAnimation,
} from "autoskeleton";
import {
  ArticleView,
  CenteredHero,
  Feed,
  Inbox,
  InvoiceRows,
  PostItem,
  ProductGrid,
  SettingsForm,
  StatTiles,
  Toolbar,
  UserCard,
  type Article,
  type Invoice,
  type Post,
  type Product,
  type Stat,
  type User,
} from "./components";
import "./styles.css";

// ---------------------------------------------------------------------------
// Test hooks: a global loading switch the Playwright suite can flip.
const params = new URLSearchParams(location.search);
let loadingState = params.get("loading") !== "0";
const listeners = new Set<() => void>();
function setLoading(v: boolean) {
  loadingState = v;
  listeners.forEach((l) => l());
}
declare global {
  interface Window {
    __setLoading: (v: boolean) => void;
  }
}
window.__setLoading = setLoading;
(window as unknown as { __measureBones: typeof measureBones }).__measureBones = measureBones;
const PERF = Number(params.get("perf") ?? 0);
function useLoading() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => loadingState,
  );
}
// With ?same=1 the "real" data equals the placeholder data, so tests can
// compare skeleton geometry against the real rendered geometry.
const SAME = params.get("same") === "1";

// ---------------------------------------------------------------------------
// Real data and placeholders.
const realUser: User = {
  name: "Ada Lovelace",
  handle: "ada",
  avatar: "https://i.pravatar.cc/112?img=5",
  bio: "Mathematician. Wrote the first algorithm intended for a machine. Likes engines, poetry and long walks.",
  followers: 18234,
  verified: true,
};
const userPlaceholder: User = {
  name: fake.name(),
  handle: fake.text(8),
  avatar: fake.image(56, 56),
  bio: fake.sentence(16),
  followers: 1000,
  verified: true,
};

const realPosts: Post[] = [
  { id: "1", author: "Grace Hopper", time: "2h", body: "Shipped the new compiler today. It's wonderful to see it finally running on real hardware.", likes: 42 },
  { id: "2", author: "Alan Turing", time: "5h", body: "Thinking about whether machines can think.", image: "https://picsum.photos/seed/turing/600/240", likes: 128 },
  { id: "3", author: "Katherine Johnson", time: "1d", body: "Checked the numbers. They're right.", likes: 9 },
];
const postsPlaceholder: Post[] = fake.list(3, (i) => ({
  id: String(i),
  author: fake.name(i + 1),
  time: "2h",
  body: fake.sentence(12 + i * 4, i),
  image: i === 1 ? fake.image(600, 240) : undefined,
  likes: 10,
}));

const realInvoices: Invoice[] = [
  { id: "INV-001", customer: "Initech", amount: "$1,200.00", status: "paid", date: "Mar 3" },
  { id: "INV-002", customer: "Globex Corporation", amount: "$80.50", status: "due", date: "Mar 9" },
  { id: "INV-003", customer: "Umbrella", amount: "$12,400.00", status: "overdue", date: "Feb 21" },
];
const invoicesPlaceholder: Invoice[] = fake.list(3, (i) => ({
  id: `INV-00${i}`,
  customer: fake.text(12, i),
  amount: "$1,000.00",
  status: "paid",
  date: "Mar 3",
}));

const realStats: Stat[] = [
  { label: "Revenue", value: "$48.2k", delta: "+12%" },
  { label: "Active users", value: "1,284", delta: "+3%" },
  { label: "Churn", value: "2.1%", delta: "-0.4%" },
  { label: "NPS", value: "62", delta: "+5" },
];
const statsPlaceholder: Stat[] = fake.list(4, (i) => ({ label: fake.text(10, i), value: "00.0k", delta: "+0%" }));

const realArticle: Article = {
  title: "Why skeletons should come from the real component",
  lede: "Hand-written skeletons drift out of sync the moment the real component changes.",
  paragraphs: [
    "When you maintain two versions of every component, one of them is always wrong. The skeleton was written for last quarter's design.",
    "Measuring the real thing removes that whole category of bug.",
  ],
};
const articlePlaceholder: Article = {
  title: fake.sentence(7),
  lede: fake.sentence(14),
  paragraphs: [fake.paragraph(2, 1), fake.sentence(10, 2)],
};

const realProducts: Product[] = fake.list(6, (i) => ({
  id: String(i),
  title: ["Desk lamp", "Ceramic mug", "Notebook", "Wool throw", "Plant pot", "Clock"][i]!,
  price: `$${(i + 1) * 12}.00`,
  image: `https://picsum.photos/seed/p${i}/300/300`,
}));
const productsPlaceholder: Product[] = fake.list(6, (i) => ({
  id: String(i),
  title: fake.text(10, i),
  price: "$00.00",
  image: fake.image(300, 300),
}));

// Nested data for the usePlaceholder() case: one query, several fields.
interface Profile {
  user: User;
  pinned: Post;
}
const realProfile: Profile = { user: realUser, pinned: realPosts[0]! };
const profilePlaceholder = (): Profile => ({ user: userPlaceholder, pinned: postsPlaceholder[0]! });

const inboxPlaceholder = fake.list(12, (i) => ({ id: String(i), from: fake.name(i), subject: fake.sentence(6, i) }));
const realInbox = fake.list(12, (i) => ({ id: String(i), from: `Sender ${i}`, subject: `Subject line number ${i} with some words` }));

// ---------------------------------------------------------------------------

function Section({ id, title, children, wide }: { id: string; title: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`fixture${wide ? " wide" : ""}`} data-fixture={id}>
      <h4 className="fixture-title" data-skeleton="ignore">
        {title}
      </h4>
      <div className="fixture-body">{children}</div>
    </section>
  );
}

function pick<T>(real: T, ph: T, loading: boolean): T | undefined {
  if (loading) return undefined;
  return SAME ? ph : real;
}

/** A component that would fire side effects; shows how useSkeleton() gates them. */
function TrackedWidget({ label }: { label: string }) {
  const inSkeleton = useSkeleton();
  const [fired, setFired] = useState(0);
  useEffect(() => {
    if (inSkeleton) return;
    // Stand-in for a real side effect (analytics call); the counter makes it visible.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFired((n) => n + 1);
  }, [inSkeleton]);
  return (
    <div className="card" data-tracked={fired}>
      <strong>{label}</strong>
      <p className="muted">Effects fired: {fired}</p>
    </div>
  );
}

function App() {
  const loading = useLoading();
  const [animation, setAnimation] = useState<SkeletonAnimation>("shimmer");
  const [dark, setDark] = useState(params.get("dark") === "1");

  const user = pick(realUser, userPlaceholder, loading);
  const posts = pick(realPosts, postsPlaceholder, loading);
  const invoices = pick(realInvoices, invoicesPlaceholder, loading);
  const stats = pick(realStats, statsPlaceholder, loading);
  const article = pick(realArticle, articlePlaceholder, loading);
  const products = pick(realProducts, productsPlaceholder, loading);
  const inbox = pick(realInbox, inboxPlaceholder, loading);
  const { data: d, loading: profileLoading } = usePlaceholder(
    pick(realProfile, profilePlaceholder(), loading),
    profilePlaceholder,
  );

  return (
    <SkeletonProvider animation={animation} fade={params.has("fade") ? Number(params.get("fade")) : undefined}>
      <div className={dark ? "app dark" : "app"}>
        <header className="controls" data-skeleton="ignore">
          <strong>autoskeleton</strong>
          <button onClick={() => setLoading(!loading)} id="toggle">
            {loading ? "Finish loading" : "Start loading"}
          </button>
          <select value={animation} onChange={(e) => setAnimation(e.target.value as SkeletonAnimation)}>
            <option>shimmer</option>
            <option>pulse</option>
            <option>none</option>
          </select>
          <label>
            <input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} /> dark
          </label>
        </header>

        <main className="grid">
          <Section id="user" title="User card (render prop + placeholder)">
            <Skeleton data={user} placeholder={userPlaceholder}>
              {(u) => <UserCard user={u} />}
            </Skeleton>
          </Section>

          <Section id="hook" title="Nested data (usePlaceholder, no arrow)">
            <Skeleton loading={profileLoading}>
              <div className="feed">
                <UserCard user={d.user} />
                <PostItem post={d.pinned} />
              </div>
            </Skeleton>
          </Section>

          <Section id="feed" title="Feed list (data ?? placeholder)">
            <Skeleton loading={loading}>
              <Feed posts={posts ?? postsPlaceholder} />
            </Skeleton>
          </Section>

          <Section id="table" title="Table rows (as='tbody')" wide>
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <Skeleton as="tbody" loading={loading}>
                <InvoiceRows rows={invoices ?? invoicesPlaceholder} />
              </Skeleton>
            </table>
          </Section>

          <Section id="stats" title="Stat tiles (grid)" wide>
            <Skeleton data={stats} placeholder={statsPlaceholder}>
              {(s) => <StatTiles stats={s} />}
            </Skeleton>
          </Section>

          <Section id="article" title="Article (wrapping text, inline code, links)">
            <Skeleton data={article} placeholder={articlePlaceholder}>
              {(a) => <ArticleView article={a} />}
            </Skeleton>
          </Section>

          <Section id="form" title="Form controls">
            <Skeleton loading={loading}>
              <SettingsForm email="ada@example.com" plan="Pro" />
            </Skeleton>
          </Section>

          <Section id="products" title="Product grid (images)" wide>
            <Skeleton data={products} placeholder={productsPlaceholder}>
              {(p) => <ProductGrid products={p} />}
            </Skeleton>
          </Section>

          <Section id="scroll" title="Inside a scroll container (clipping)">
            <div className="scroller">
              <Skeleton data={inbox} placeholder={inboxPlaceholder}>
                {(items) => <Inbox items={items} />}
              </Skeleton>
            </div>
          </Section>

          <Section id="toolbar" title="Toolbar: chips, svg, flex">
            <Skeleton loading={loading}>
              <Toolbar tags={["Design", "Engineering", "Ops", "Sales"]} />
            </Skeleton>
          </Section>

          <Section id="animated" title="Entrance animation (starts at opacity 0)">
            <div style={{ "--rise-delay": params.get("rise-delay") ?? undefined } as CSSProperties}>
              <Skeleton loading={loading}>
                <div className="rise-in">
                  <UserCard user={user ?? userPlaceholder} />
                </div>
                <p className="hidden-note" style={{ opacity: 0 }}>
                  Intentionally hidden, no bone
                </p>
              </Skeleton>
            </div>
          </Section>

          <Section id="hero" title="Centered hero + keep">
            <Skeleton loading={loading}>
              <div className="hero-wrap">
                <span className="eyebrow" data-skeleton="keep">
                  Static label stays visible
                </span>
                <CenteredHero title={pick("Build faster with less code", fake.sentence(5), loading) ?? fake.sentence(5)} subtitle={fake.sentence(12, 3)} />
              </div>
            </Skeleton>
          </Section>

          <Section id="nested" title="Nested skeletons">
            <Skeleton loading={loading}>
              <div className="card">
                <h3>Team</h3>
                <Skeleton loading={loading}>
                  <p>{fake.sentence(14, 9)}</p>
                </Skeleton>
              </div>
            </Skeleton>
          </Section>

          <Section id="cache" title="No placeholder: id cache + fallback">
            <Skeleton
              id="demo-cache"
              loading={loading}
              fallback={<div className="fallback">Loading…</div>}
            >
              {loading ? null : <UserCard user={realUser} />}
            </Skeleton>
          </Section>

          <Section id="effects" title="useSkeleton() gates effects">
            <Skeleton loading={loading}>
              <TrackedWidget label="Analytics widget" />
            </Skeleton>
          </Section>

          <Section id="suspense" title="Suspense fallback via id cache">
            <SuspenseDemo />
          </Section>
        </main>
      </div>
    </SkeletonProvider>
  );
}

// Suspense: the fallback has no data, so it relies on the cached layout from
// the last time the real content rendered.
const cache = new Map<string, Promise<void> | true>();
function SuspendingProfile({ k }: { k: number }) {
  const key = `p${k}`;
  const hit = cache.get(key);
  if (hit === true) return <UserCard user={realUser} />;
  if (!hit) cache.set(key, new Promise((r) => setTimeout(() => (cache.set(key, true), r()), 1200)));
  throw cache.get(key);
}
function SuspenseDemo() {
  const [k, setK] = useState(0);
  return (
    <div>
      <button data-skeleton="ignore" onClick={() => setK((n) => n + 1)} id="suspense-reload">
        Refetch
      </button>
      <Suspense fallback={<Skeleton id="suspense-profile" loading />}>
        <Skeleton id="suspense-profile" loading={false}>
          <SuspendingProfile k={k} />
        </Skeleton>
      </Suspense>
    </div>
  );
}

function PerfApp() {
  const loading = useLoading();
  const posts = fake.list(PERF, (i) => ({ ...postsPlaceholder[i % 3]!, id: String(i) }));
  return (
    <div className="app" style={{ padding: 20, maxWidth: 640 }}>
      <Skeleton loading={loading}>
        <Feed posts={posts} />
      </Skeleton>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>{PERF ? <PerfApp /> : <App />}</StrictMode>,
);
