import {
  act,
  Component,
  StrictMode,
  Suspense,
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import {
  Skeleton,
  SkeletonList,
  SkeletonProvider,
  SkeletonSuspense,
  fake,
  measureBones,
  usePlaceholder,
  useSkeleton,
  useSuspenseData,
  type SkeletonAnimation,
} from "autoskeleton";
import {
  ArticleView,
  CenteredHero,
  Feed,
  Inbox,
  InboxItem,
  InvoiceRow,
  InvoiceRows,
  PostItem,
  ProductCard,
  ProductGrid,
  SettingsForm,
  StatTiles,
  Toolbar,
  UserCard,
  type Article,
  type Invoice,
  type Message,
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

// SkeletonList: one placeholder item, repeated `count` times while loading.
// With ?same=1 the real items are copies of it, so geometry can be compared.
const postPlaceholder: Post = { id: fake.id(), author: fake.name(1), time: "2h", body: fake.sentence(14), likes: 10 };
const productPlaceholder: Product = { id: fake.id(), title: fake.text(10), price: "$00.00", image: fake.image(300, 300) };
const invoicePlaceholder: Invoice = { id: "INV-000", customer: fake.text(12), amount: "$1,000.00", status: "paid", date: "Mar 3" };
const messagePlaceholder: Message = { id: fake.id(), from: fake.name(2), subject: fake.sentence(6) };
const copies = <T extends { id: string }>(item: T, n: number, id: (i: number) => string = String): T[] =>
  fake.list(n, (i) => ({ ...item, id: id(i) }));
const listPosts = SAME ? copies(postPlaceholder, 3) : realPosts;
const listProducts = SAME ? copies(productPlaceholder, 4) : realProducts.slice(0, 4);
const listInvoices = SAME ? copies(invoicePlaceholder, 3, (i) => `INV-00${i}`) : realInvoices;
const listMessages = SAME ? copies(messagePlaceholder, 4) : realInbox.slice(0, 4);

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

          <Section id="skeleton-suspense" title="SkeletonSuspense + useSuspenseData(promise, placeholder)">
            <SkeletonSuspenseDemo />
          </Section>

          <Section id="suspense-shorthand" title="SkeletonSuspense: untyped fallback shorthand + a typed read">
            <ShorthandDemo />
          </Section>

          <Section id="suspense-manual" title="useSuspenseData outside a boundary (plain Suspense)">
            <ManualSuspenseDemo />
          </Section>

          <Section id="suspense-attrs" title="SkeletonSuspense as='ul' with label, aria-label, data-*" wide>
            <SuspenseAttrsDemo />
          </Section>

          {params.has("missing") ? (
            <Section id="suspense-missing" title="SkeletonSuspense: a read without a placeholder">
              <MissingDemo />
            </Section>
          ) : null}

          {params.has("ignored") ? (
            <Section id="suspense-ignored" title="SkeletonSuspense: child suspends some other way">
              <IgnoredDemo />
            </Section>
          ) : null}
          <Section id="list" title="SkeletonList: flex feed (count=3)">
            <div className="feed">
              <SkeletonList items={loading ? undefined : listPosts} placeholder={postPlaceholder} count={3}>
                {(p) => <PostItem key={p.id} post={p} />}
              </SkeletonList>
            </div>
          </Section>

          <Section id="list-suspense" title="SkeletonList as the SkeletonSuspense fallback">
            <ListSuspenseDemo />
          </Section>

          <Section id="list-grid" title="SkeletonList: grid (count=4)" wide>
            <div className="products">
              <SkeletonList items={loading ? undefined : listProducts} placeholder={() => productPlaceholder} count={4}>
                {(p) => <ProductCard key={p.id} product={p} />}
              </SkeletonList>
            </div>
          </Section>

          <Section id="list-table" title="SkeletonList: table (as='tbody')" wide>
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
              <SkeletonList as="tbody" items={loading ? undefined : listInvoices} placeholder={invoicePlaceholder} count={3}>
                {(r) => <InvoiceRow key={r.id} row={r} />}
              </SkeletonList>
            </table>
          </Section>

          <Section id="list-ul" title="SkeletonList: as='ul'">
            <SkeletonList as="ul" className="inbox" items={loading ? undefined : listMessages} placeholder={messagePlaceholder} count={4}>
              {(m) => <InboxItem key={m.id} message={m} />}
            </SkeletonList>
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
              <Skeleton as="tbody" loading={loading} label="Loading invoices">
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

          <Section id="transformed" title="Static transform (no animation)">
            <Skeleton loading={loading}>
              <div style={{ transform: "translate(12px, 6px)" }}>
                <UserCard user={user ?? userPlaceholder} />
              </div>
            </Skeleton>
          </Section>

          <Section id="attrs" title="as='ul' with aria-label, data-*, title">
            <Skeleton
              as="ul"
              className="inbox"
              id="demo-attrs"
              aria-label="Recent mail"
              data-section="recent"
              title="Recent mail"
              label="Loading recent mail"
              loading={loading}
            >
              {(inbox ?? inboxPlaceholder).slice(0, 3).map((m) => (
                <li key={m.id}>
                  <strong>{m.from}</strong>
                  <span>{m.subject}</span>
                </li>
              ))}
            </Skeleton>
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

          <Section id="suspense-id" title="SkeletonSuspense without placeholders: id cache">
            <SuspenseIdDemo />
          </Section>

          <Section id="suspense-error" title="SkeletonSuspense: rejection → error boundary">
            <SuspenseErrorDemo />
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
// The same with SkeletonSuspense and no placeholder anywhere: the skeleton
// render measures nothing, so the `id`-cached layout is drawn.
function SuspenseIdDemo() {
  const [k, setK] = useState(100);
  return (
    <div>
      <button data-skeleton="ignore" onClick={() => setK((n) => n + 1)} id="suspense-id-reload">
        Refetch
      </button>
      <SkeletonSuspense id="suspense-id-profile">
        <SuspendingProfile k={k} />
      </SkeletonSuspense>
    </div>
  );
}
// ---------------------------------------------------------------------------
// Suspense with promises. Each demo gets a pending promise while the global
// switch says "loading", resolved when it flips (a new one on each reload).
interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}
/** Already settled and marked so (the `use()` convention): renders without suspending. */
function settled<T>(value: T): Deferred<T> {
  const promise = Object.assign(Promise.resolve(value), { status: "fulfilled", value });
  return { promise, resolve: () => {}, reject: () => {} };
}

function useDemoPromise<T>(value: T): Deferred<T> {
  const loading = useLoading();
  const [d, setD] = useState(() => (loading ? deferred<T>() : settled(value)));
  const [prev, setPrev] = useState(loading);
  if (prev !== loading) {
    setPrev(loading);
    if (loading) setD(deferred<T>());
  }
  useEffect(() => {
    if (!loading) d.resolve(value);
  }, [loading, d, value]);
  return d;
}

const demoPosts = SAME ? postsPlaceholder : realPosts;
const demoUser = SAME ? userPlaceholder : realUser;

/** Reads its promise with a typed placeholder: the placeholder in the skeleton, the posts after. */
function SuspendingFeed({ promise }: { promise: Promise<Post[]> }) {
  const posts = useSuspenseData(promise, postsPlaceholder);
  const inSkeleton = useSkeleton();
  const [fired, setFired] = useState(0);
  useEffect(() => {
    if (inSkeleton) return;
    // Stand-in for an outside-world effect: it must not run with placeholder data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFired((n) => n + 1);
  }, [inSkeleton]);
  return (
    <div className="suspense-reader" data-reader="feed" data-in-skeleton={inSkeleton ? "" : undefined} data-tracked={fired}>
      <Feed posts={posts} />
    </div>
  );
}
function SuspendingUser({ promise }: { promise: PromiseLike<User> }) {
  const user = useSuspenseData(promise, userPlaceholder);
  return (
    <div data-reader="user" data-in-skeleton={useSkeleton() ? "" : undefined}>
      <UserCard user={user} />
    </div>
  );
}
/** No placeholder of its own: gets the boundary's untyped `fallback`, if any. */
function UntypedUser({ promise }: { promise: PromiseLike<User> }) {
  const user = useSuspenseData(promise);
  return (
    <div data-reader="user" data-in-skeleton={useSkeleton() ? "" : undefined}>
      <UserCard user={user} />
    </div>
  );
}

// The typed form: no `fallback`; the reader passes its own placeholder.
function SkeletonSuspenseDemo() {
  const { promise } = useDemoPromise(demoPosts);
  return (
    <SkeletonSuspense>
      <SuspendingFeed promise={promise} />
    </SkeletonSuspense>
  );
}

// A request the global switch restarts and resolves, read from module scope.
let userRequest = loadingState ? deferred<User>() : settled(demoUser);
listeners.add(() => {
  if (loadingState) userRequest = deferred<User>();
  else userRequest.resolve(demoUser);
});

// The shorthand: the user read has no placeholder, so it gets the boundary's
// (lazy, untyped) `fallback`; the feed passes its own typed one, which wins.
function ShorthandDemo() {
  useLoading();
  const { promise } = useDemoPromise(demoPosts);
  return (
    <SkeletonSuspense fallback={() => userPlaceholder}>
      <div className="feed">
        <UntypedUser promise={userRequest.promise} />
        <SuspendingFeed promise={promise} />
      </div>
    </SkeletonSuspense>
  );
}

// No placeholder for the user read and no `fallback`: it suspends inside the
// skeleton, with a dev warning. Its own <Suspense> keeps that to the user
// card (without it the whole skeleton would be empty); the feed is still drawn.
function MissingDemo() {
  useLoading();
  const { promise } = useDemoPromise(demoPosts);
  return (
    <SkeletonSuspense>
      <div className="feed">
        <Suspense fallback={null}>
          <UntypedUser promise={userRequest.promise} />
        </Suspense>
        <SuspendingFeed promise={promise} />
      </div>
    </SkeletonSuspense>
  );
}

// useSuspenseData outside a SkeletonSuspense is `use()`: a plain <Suspense>
// with a hand-wired skeleton fallback.
function ManualSuspenseDemo() {
  const { promise } = useDemoPromise(demoPosts);
  return (
    <Suspense
      fallback={
        <Skeleton loading>
          <Feed posts={postsPlaceholder} />
        </Skeleton>
      }
    >
      <SuspendingFeed promise={promise} />
    </Suspense>
  );
}

// `use(promise)` for React 18 and 19, standing in for useSuspenseQuery: it
// suspends without useSuspenseData, so it never sees the placeholder.
type Status<T> = { state: "pending" } | { state: "done"; value: T } | { state: "failed"; error: unknown };
const statusOf = new WeakMap<Promise<unknown>, Status<unknown>>();
function read<T>(promise: Promise<T>): T {
  const known = (promise as { status?: string; value?: T }).status === "fulfilled";
  if (known) return (promise as unknown as { value: T }).value;
  let s = statusOf.get(promise) as Status<T> | undefined;
  if (!s) {
    s = { state: "pending" };
    statusOf.set(promise, s);
    promise.then(
      (value) => void statusOf.set(promise, { state: "done", value }),
      (error: unknown) => void statusOf.set(promise, { state: "failed", error }),
    );
  }
  if (s.state === "done") return s.value;
  if (s.state === "failed") throw s.error;
  throw promise;
}
// A list: the fallback is a loading SkeletonList (one placeholder item, `count`
// rows). It doesn't draw bones itself; the boundary measures and fades them.
function SuspendingPostList({ promise }: { promise: Promise<Post[]> }) {
  return read(promise).map((p) => <PostItem key={p.id} post={p} />);
}
function ListSuspenseDemo() {
  const { promise } = useDemoPromise(listPosts);
  return (
    <div className="feed">
      <SkeletonSuspense
        fallback={
          <SkeletonList loading placeholder={postPlaceholder} count={3}>
            {(p) => <PostItem key={p.id} post={p} />}
          </SkeletonList>
        }
      >
        <SuspendingPostList promise={promise} />
      </SkeletonSuspense>
    </div>
  );
}
function SelfLoadingUser() {
  useLoading();
  return <UserCard user={read(userRequest.promise)} />;
}
function IgnoredDemo() {
  return (
    <SkeletonSuspense fallback={userPlaceholder}>
      <SelfLoadingUser />
    </SkeletonSuspense>
  );
}

// HTML attributes and `label` on a SkeletonSuspense: the attributes sit on the
// wrapper on screen, the label is one status outside the inert skeleton.
function SuspendingMail({ promise }: { promise: Promise<typeof realInbox> }) {
  const mail = useSuspenseData(promise, inboxPlaceholder);
  return mail.slice(0, 3).map((m) => (
    <li key={m.id}>
      <strong>{m.from}</strong>
      <span>{m.subject}</span>
    </li>
  ));
}
function SuspenseAttrsDemo() {
  const { promise } = useDemoPromise(SAME ? inboxPlaceholder : realInbox);
  return (
    <SkeletonSuspense
      as="ul"
      className="inbox"
      id="demo-suspense-attrs"
      aria-label="Suspended mail"
      data-section="suspended"
      title="Suspended mail"
      label="Loading suspended mail"
    >
      <SuspendingMail promise={promise} />
    </SkeletonSuspense>
  );
}

// Test hook: render a SkeletonSuspense inside React's act(), synchronously, the
// way React Testing Library does, and report what the first commit shows.
type ActProbe = { text: string; busy: boolean; skeletonRenders: number; usedByReact: boolean };
function ProbeReader({ promise, onSkeleton }: { promise: PromiseLike<string>; onSkeleton: () => void }) {
  const value = useSuspenseData(promise, () => (onSkeleton(), "placeholder"));
  return <p>{value}</p>;
}
function actProbe(promise: PromiseLike<string>): ActProbe {
  const el = document.createElement("div");
  document.body.append(el);
  let skeletonRenders = 0;
  const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  env.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(el);
  try {
    act(() =>
      root.render(
        <SkeletonSuspense fade={0}>
          <ProbeReader promise={promise} onSkeleton={() => skeletonRenders++} />
        </SkeletonSuspense>,
      ),
    );
    return {
      text: el.textContent ?? "",
      busy: el.querySelector('[aria-busy="true"]') !== null,
      skeletonRenders,
      // React 19's use() tags each thenable it reads with `_debugInfo` (in development).
      usedByReact: "_debugInfo" in promise,
    };
  } finally {
    env.IS_REACT_ACT_ENVIRONMENT = false;
    setTimeout(() => (root.unmount(), el.remove()), 0);
  }
}
/**
 * "marked": a promise already settled with `status: "fulfilled"`.
 * "seen": a plain promise, read (and suspended on) while pending, settled
 * afterwards, then rendered again in a new tree.
 */
async function actProbeCase(kind: "marked" | "seen"): Promise<ActProbe> {
  if (kind === "marked") return actProbe(settled("ready").promise);
  const d = deferred<string>();
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  root.render(
    <SkeletonSuspense fade={0}>
      <ProbeReader promise={d.promise} onSkeleton={() => {}} />
    </SkeletonSuspense>,
  );
  await new Promise((r) => setTimeout(r, 50));
  d.resolve("ready");
  await new Promise((r) => setTimeout(r, 50));
  root.unmount();
  el.remove();
  return actProbe(d.promise);
}
Object.assign(window, { __actProbe: actProbeCase });

class ErrorBoundary extends Component<{ children: ReactNode; onRetry: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fallback" role="alert">
        Couldn't load: {this.state.error.message}{" "}
        <button id="suspense-retry" onClick={this.props.onRetry}>
          Retry
        </button>
      </div>
    );
  }
}

function SuspenseErrorDemo() {
  const demo = useDemoPromise(demoUser);
  // A retry starts a fresh request, independent of the global switch.
  const [retry, setRetry] = useState<{ n: number; d: Deferred<User> } | null>(null);
  const current = retry?.d ?? demo;
  return (
    <div>
      <button id="suspense-reject" onClick={() => current.reject(new Error("Network down"))}>
        Fail request
      </button>{" "}
      <button id="suspense-resolve" onClick={() => current.resolve(realUser)}>
        Resolve
      </button>
      <ErrorBoundary key={retry?.n ?? 0} onRetry={() => setRetry((r) => ({ n: (r?.n ?? 0) + 1, d: deferred<User>() }))}>
        <SkeletonSuspense>
          <SuspendingUser promise={current.promise} />
        </SkeletonSuspense>
      </ErrorBoundary>
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
