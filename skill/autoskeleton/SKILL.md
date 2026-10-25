---
name: autoskeleton
description: Add loading skeletons to React components with the `autoskeleton` library instead of hand-writing skeleton components. Use when adding a loading state, skeleton, shimmer or placeholder to React UI, when replacing a hand-written `FooSkeleton` component, or when a component shows a spinner/null/"Loading..." while data is fetched.
---

# autoskeleton

`autoskeleton` draws the skeleton **from the real component**. You wrap the
real UI in `<Skeleton>`, give it stand-in data while loading, and the library
renders the component invisibly, measures it, and paints a skeleton with the
same shape: one bar per line of text, blocks for images/buttons/inputs/pills,
and the card backgrounds/borders they sit on. It stays in sync when the
component changes because there is no second component.

**Never write a separate `XSkeleton` component. Never hand-place `<div className="skeleton">` bars.**

## The one rule

While loading, the wrapped component must still be able to render. You get
there by handing it placeholder data of the same shape.

```tsx
import { Skeleton, SkeletonList, fake, usePlaceholder } from "autoskeleton";
```

No CSS import or provider is needed; styles are injected automatically.

## Pattern A: `usePlaceholder` (preferred)

`usePlaceholder(data, placeholder)` returns the real data when it exists, the
placeholder otherwise, always typed as `T`, plus `loading` (`data == null`).
Use the data directly in JSX, nested fields included. No children function.

```tsx
const query = useQuery(...);
const { data: d, loading } = usePlaceholder(query.data, PROFILE_PLACEHOLDER);

<Skeleton loading={loading}>
  <UserCard user={d.user} />
  <PostList posts={d.posts} />
</Skeleton>
```

When the loading flag isn't "data is null" (e.g. data depends on several
queries), pass it: `usePlaceholder(data, PLACEHOLDER, { loading: a.isLoading || b.isLoading })`.
Don't pass `isFetchingNextPage`: it would swap loaded pages for the placeholder
(see load more below).
`placeholder` may be a value or `() => value` (a pure factory, called when
first needed and cached with the component's state).
Call the hook in the component that owns the query, above the `<Skeleton>`.

## Pattern B: render prop

Same behavior, inline. `loading` is inferred from `data == null`.

```tsx
<Skeleton data={user} placeholder={USER_PLACEHOLDER}>
  {(u) => <UserCard user={u} />}
</Skeleton>
```

## Pattern C: explicit `loading`

For content that renders fine while loading, or to skeleton over stale data
(see Refetching below):

```tsx
<Skeleton loading={isLoading}>
  <SettingsForm plan={plan} />
</Skeleton>
```

## Pattern D: lists with `SkeletonList`

For a list of same-shaped items (stories, posts, rows, cards), declare **one**
placeholder item and a `count`. The skeleton is that item rendered `count`
times (default 3, identical rows), then the same function renders each real
item. `loading` is `items == null`; pass `loading` to override.

```tsx
const STORY_PLACEHOLDER: Story = { id: fake.id(), title: fake.sentence(8), by: fake.name() };

<SkeletonList items={stories} placeholder={STORY_PLACEHOLDER} count={5}>
  {(story) => <StoryCard key={story.id} story={story} />}
</SkeletonList>
```

Return a keyed element as in `.map()`. Placeholder rows are keyed by index
for you, so the shared placeholder `id` never collides. `placeholder` may be a
value or `() => value`. All `<Skeleton>` props work (`as`, `id`, `label`…).
For Suspense, use it as the `SkeletonSuspense` fallback (below).

## Writing placeholders

Placeholders only need the right shape and roughly the right text length.
Define them once, at module scope, next to the component or query.

```tsx
const USER_PLACEHOLDER: User = {
  id: "placeholder",
  name: fake.name(),              // "Lorem Ipsum"-like two words
  handle: fake.text(10),          // ~10 characters
  bio: fake.sentence(18),         // 18 words
  avatarUrl: fake.image(64, 64),  // transparent image with real dimensions
  followers: fake.number(4),      // 8888
  joinedAt: fake.date(),
  tags: ["one", "two", "three"],
};

const POSTS_PLACEHOLDER: Post[] = fake.list(5, (i) => ({
  id: fake.id(i),
  title: fake.sentence(6, i),     // second arg = seed, so items differ
  body: fake.paragraph(2, i),
  cover: i % 2 ? fake.image(600, 300) : undefined,
}));
```

Helpers: `fake.text(chars)`, `fake.sentence(words, seed?)`,
`fake.paragraph(sentences, seed?)`, `fake.name(seed?)`, `fake.email(seed?)`,
`fake.number(digits)`, `fake.image(w, h)`, `fake.list(n, i => item)`,
`fake.date()`, `fake.id(seed)` (`"skeleton-<seed>"`), `fake.id(seed, "number")`
(`-1 - seed`, for numeric ids). All are deterministic (SSR-safe).

Guidelines:
- **Lengths decide whether the page jumps when data arrives.** Before writing a
  placeholder, find real sample data (API mocks, fixtures, seed data, stories,
  tests) and copy its shape: the same number of items, and text of the same
  length per field. Mirror variation too: if real comments are one short, one
  long and one medium, make the placeholders short, long and medium
  (`fake.sentence(4, 0)`, `fake.sentence(22, 1)`, `fake.sentence(10, 2)`), not
  three identical medium ones. With no samples, use typical lengths (a title
  ~6 words, a name 2 words, a price "$00.00").
- Images: use `fake.image(w, h)` with the real aspect ratio, or the `<img>` will be 0×0 if it has no CSS size.
- Lists: 3–6 items is usually right; for tables use the page size. With
  `SkeletonList` that's `count`, and the rows are identical by design. When
  real items vary a lot and the jump matters, use `usePlaceholder` with a
  varied `fake.list(…)` instead.
- Enums/booleans: pick the variant whose layout is most common (e.g. `verified: true` if it shows a badge).
- Keep IDs unique (`fake.id(i)`, or `fake.id(i, "number")` when the type is a
  number) so React keys don't collide (`SkeletonList` handles this itself).
  Numeric ones are negative, so they never match a real record.

## Things to remove when converting

1. Early returns: `if (isLoading) return <Spinner />` / `return <UserCardSkeleton />` / `if (!data) return null`. Replace them with the `<Skeleton>` wrapper.
2. The old skeleton component and its CSS (once nothing imports it).
3. Optional chaining and fallbacks sprinkled only to survive `undefined` (`user?.name ?? ""`, `data?.user`). Data from `usePlaceholder` or the render prop is never null; drop them.

## Lists, tables, grids

Wrap the whole list once (not each item). Prefer `SkeletonList` (Pattern D);
with a varied placeholder array, `usePlaceholder` works too:

```tsx
const { data: items, loading } = usePlaceholder(posts, POSTS_PLACEHOLDER);

<Skeleton loading={loading}>
  {items.map((p) => <PostCard key={p.id} post={p} />)}
</Skeleton>
```

Inside a table, render the wrapper as the `tbody` (a `<div>` isn't valid there):

```tsx
<table>
  <thead>…</thead>
  <SkeletonList as="tbody" items={rows} placeholder={ROW_PLACEHOLDER} count={PAGE_SIZE}>
    {(r) => <Row key={r.id} row={r} />}
  </SkeletonList>
</table>
```

The wrapper is `display: contents`, so it never changes flex/grid layout: put
the list directly inside the flex/grid container. For a `<ul>`, use `as="ul"`
and put margins/padding/grid styles on a parent (its own box is
`display: contents` too). Use `as="li"`/`as="span"` etc. only when HTML
nesting rules require it.

HTML attributes (`aria-*`, `data-*`, `role`, `title`, handlers) go to the
wrapper element, so `<Skeleton as="ul" aria-label="Stories" loading={loading}>`
works. `id` is the cache key and is never the DOM id; put a DOM id on an
element inside.

## Refetching, pagination, Suspense

**Refetch (filters, search, pagination by page):** show the skeleton over the
stale results while new ones load.

```tsx
<Skeleton loading={isFetching}>
  <Results items={data ?? RESULTS_PLACEHOLDER} />
</Skeleton>
```

For a list, `<SkeletonList items={data} loading={isFetching} placeholder={ROW_PLACEHOLDER} count={10}>`
shows placeholder rows on first load and the skeleton over stale rows after.

**Load more / infinite scroll:** keep loaded items on screen; add a skeleton
for the next page only, below them.

```tsx
<div className="feed">
  {items.map((it) => <Row key={it.id} item={it} />)}
  {loadingMore && (
    <SkeletonList loading placeholder={ROW_PLACEHOLDER} count={PAGE_SIZE}>
      {(it) => <Row key={it.id} item={it} />}
    </SkeletonList>
  )}
</div>
```

**Suspense:** use `SkeletonSuspense` + `useSuspenseData`, and pass the
placeholder **to the hook**. Without a Suspense boundary (`useQuery(...).data`,
a store, props), use `usePlaceholder` (Pattern A).

```tsx
import { SkeletonSuspense, useSuspenseData } from "autoskeleton";

<SkeletonSuspense>
  <Comments promise={commentsPromise} />
</SkeletonSuspense>

function Comments({ promise }: { promise: Promise<Comment[]> }) {
  const comments = useSuspenseData(promise, COMMENTS_PLACEHOLDER); // checked against Comment[]
  return <CommentList comments={comments} />;
}
```

`useSuspenseData<T>(promise: PromiseLike<T>, placeholder?: NoInfer<T> | (() => NoInfer<T>)): T`:
- Inside the skeleton (the boundary's fallback, which renders the same
  children again) it returns `placeholder`, or the boundary's `fallback` if
  the call has none, without suspending. With neither, it suspends (see the
  missing-placeholder note below). `T` is inferred
  from the promise only, so a placeholder of the wrong shape is a type error.
  Fix the placeholder, never cast it.
- Everywhere else (the real children, or no `SkeletonSuspense` above) it is
  `use(promise)`: it suspends, and rejections reach the nearest error
  boundary. `placeholder` is ignored there.
- A promise already marked settled (`status: "fulfilled"`/`value` or
  `"rejected"`/`reason`) is read synchronously, without `use()`: no
  skeleton, content in the first commit, also inside RTL's `act()`. Tests
  don't need to wait for it.
- `placeholder` may be `() => value`, called on each skeleton render (keep it
  pure; prefer a module-scope constant).
- One call per promise, each with its own placeholder; any number under one
  boundary. Nested boundaries: an inner one inside an outer skeleton renders
  as a skeleton too.
- Create promises outside render (loader, event handler, cache) and pass
  them down.

The skeleton fades out over the content. Works on React 18 and 19. Don't wrap
anything in `<Skeleton>` yourself.

`<SkeletonSuspense>` props: `children`, optional `fallback` (see below), `id`
(cached layout when the skeleton measures nothing), `name` (passed to
`<Suspense>`), and the `<Skeleton>` options `animation`, `as`, `fade`,
`label`, `textHeight`, `surfaces`, `persist`, `className`, `style`, plus
HTML attributes (`aria-*`, `data-*`, `role`, `title`, handlers).

- `label`: exactly one `role="status"` named by it while suspended
  (`getByRole("status", { name })`), outside the inert skeleton; none after.
- HTML attributes sit on one wrapper at a time: the skeleton's until the
  content first shows, then the content's (also while a refetch hides it).
  `className`/`style` go on both. `id` is the cache key, never the DOM `id`.

- `fallback` is an **untyped** shorthand: placeholder data (or `() => data`)
  for every call that passes none, e.g.
  `<SkeletonSuspense fallback={COMMENTS_PLACEHOLDER}>` with
  `useSuspenseData(promise)`. It crosses a context, so TypeScript can't check
  it; a wrong shape crashes at runtime. Don't use it in new code. A call's
  own placeholder wins; nested boundaries: the nearest `fallback` wins.
  Never pass an element.
- No placeholder and no `fallback`: the call suspends inside the skeleton,
  which drops the children up to the nearest `<Suspense>` around it (all of
  them if none). A dev warning says "has no placeholder": pass one. With `id`
  the cached layout is drawn instead, and that warning is off.
- A dev warning says "got a `fallback`, but no useSuspenseData() call ...
  returned it": either every call has its own placeholder (remove
  `fallback`) or a child suspends another way (below).
- Only `useSuspenseData` gets placeholders. Components that suspend another
  way (`useSuspenseQuery`, `lazy`, `use()` directly) suspend inside the
  skeleton and drop out of it. Convert them to pass a promise into
  `useSuspenseData`. Never create a new promise each render.
- Errors: put an error boundary above `SkeletonSuspense`; retry with a new
  promise.
- The skeleton render runs effects with placeholder data. `useSkeleton()` is
  true there; gate side effects with it.

TanStack Query: replace `useSuspenseQuery(q)` with this adapter's
`useSuspenseQueryData(q, PLACEHOLDER)` (checked against
`@tanstack/react-query` 5.104; there is no `useQuery().promise` or
`experimental_prefetchInRender`). It keeps one promise per query key until
the data changes, marks cached data fulfilled, and skips fetching in the
skeleton. Copy it into the app; autoskeleton doesn't depend on TanStack. On
older 5.x without `queryClient.query`, use `queryClient.fetchQuery`.

```tsx
import { hashKey, useQuery, useQueryClient, type QueryClient, type QueryKey, type UseSuspenseQueryOptions } from "@tanstack/react-query";
import { useSkeleton, useSuspenseData } from "autoskeleton";

type Entry = { promise: Promise<unknown>; data?: unknown; failed?: boolean };
const entries = new WeakMap<QueryClient, Map<string, Entry>>();
const never = new Promise<never>(() => {});

/** The query's data as a promise, the same object until the data changes. */
function queryPromise<T, K extends QueryKey>(client: QueryClient, options: UseSuspenseQueryOptions<T, Error, T, K>): Promise<T> {
  let byKey = entries.get(client);
  if (!byKey) entries.set(client, (byKey = new Map()));
  const key = hashKey(options.queryKey);
  const data = client.getQueryData<T>(options.queryKey);
  const entry = byKey.get(key);
  // A failed fetch keeps its rejected promise (so the error boundary gets it)
  // until the query leaves "error", e.g. queryClient.resetQueries({ queryKey }).
  const failedStill = entry?.failed && client.getQueryState(options.queryKey)?.status === "error";
  if (entry && (failedStill || (!entry.failed && entry.data === data))) return entry.promise as Promise<T>;
  if (data !== undefined) {
    // Cached: marked fulfilled, so it renders without suspending. `select` is
    // applied here as client.query() applies it on a fetch.
    const value = options.select ? options.select(data) : data;
    const promise = Object.assign(Promise.resolve(value), { status: "fulfilled", value });
    byKey.set(key, { promise, data });
    return promise;
  }
  const promise = client.query(options);
  const next: Entry = { promise };
  byKey.set(key, next);
  promise.then(
    () => void (next.data = client.getQueryData(options.queryKey)),
    (reason: unknown) => void ((next.failed = true), Object.assign(promise, { status: "rejected", reason })),
  );
  return promise;
}

/** useSuspenseQuery for <SkeletonSuspense>: the placeholder in the skeleton, the data after. */
// Same options as useSuspenseQuery, so no `enabled`: a suspending query can't be disabled.
// `select` must return the same type as queryFn and be stable (module-level or
// useCallback): it's applied once per data change, not on every render.
export function useSuspenseQueryData<T, K extends QueryKey>(options: UseSuspenseQueryOptions<T, Error, T, K>, placeholder: T): T {
  const client = useQueryClient();
  const inSkeleton = useSkeleton();
  useQuery({ ...options, enabled: !inSkeleton }); // refetches and cache updates re-render
  return useSuspenseData(inSkeleton ? never : queryPromise(client, options), placeholder);
}
```

Lists: the fallback is a loading `SkeletonList`. Inside the boundary it draws
no bones of its own; `SkeletonSuspense` measures the rows and fades them.

```tsx
<SkeletonSuspense
  fallback={
    <SkeletonList loading placeholder={STORY_PLACEHOLDER} count={5}>
      {(s) => <StoryCard key={s.id} story={s} />}
    </SkeletonList>
  }
>
  <Stories promise={storiesPromise} />
</SkeletonSuspense>
```

Limits:
- Suspense remounts: the content mounts fresh when data arrives (state and
  effects start over).
- Content that suspends again is hidden and the skeleton shows, except in a
  transition (`startTransition`, router navigations), where React keeps the
  old content with no skeleton. For a skeleton over stale results, use
  `loading={isFetching}` instead.
- The skeleton renders on the server (`renderToString` and the streaming
  shell), but React doesn't hydrate a fallback waiting for streamed content,
  so it stays the CSS-only approximation until the content replaces it.

## Components that fetch their own data

If the component calls `useQuery` inside itself, the placeholder trick doesn't
apply directly. Options, in order of preference:

1. Split it: `UserCard` (presentational, takes `user`) + `UserCardContainer` (fetches, calls `usePlaceholder(data, USER_PLACEHOLDER)`, renders `<Skeleton loading={loading}><UserCard user={user} /></Skeleton>`).
2. If it suspends, read the data with `useSuspenseData(promise, USER_PLACEHOLDER)` (TanStack: `useSuspenseQueryData` above, not `useSuspenseQuery`) and wrap it in `<SkeletonSuspense>`.
3. Wrap the place it's used with Suspense and an `id` skeleton (see below).

## No placeholder possible: `id` + `fallback`

Give the skeleton an `id`. Every time the real content renders, its layout is
remembered (memory + localStorage). Next time it's loading with nothing to
render, the remembered skeleton is drawn and its height reserved.

```tsx
<Skeleton id="profile-card" loading={isLoading} fallback={<Spinner />}>
  {data ? <ProfileCard data={data} /> : null}
</Skeleton>

// Suspense works the same way:
<SkeletonSuspense id="profile-card">
  <ProfileThatSuspends />
</SkeletonSuspense>
```

`<Skeleton fallback>` shows only on the very first visit (nothing cached yet). Prefer
placeholders when you can; `id` is for cases where you can't.

## Side effects while loading

While loading, the component really renders (with placeholder data), so its
effects run too. Any effect that talks to the outside world (analytics,
"mark as seen", fetching by id, autoplay, drawing with a third-party chart lib
that reports usage) would fire with placeholder ids. Look for `useEffect` /
`useLayoutEffect` in every component you wrap, including deeply nested ones,
and gate those effects:

```tsx
import { useSkeleton } from "autoskeleton";

function Chart({ series }) {
  const isSkeleton = useSkeleton(); // true inside a loading <Skeleton>
  useEffect(() => {
    if (isSkeleton) return;
    analytics.track("chart_viewed");
  }, [isSkeleton]);
}
```

Include `isSkeleton` in the dependency array. Then an effect that was skipped
while loading runs as soon as the real content is revealed, even when the
component stays mounted (e.g. a refetch that showed the skeleton over stale
rows). If the effect must fire only once per id, dedupe on the id
(`[item.id, isSkeleton]` plus a "seen" set) instead of dropping `isSkeleton`
from the array.

The hidden content is `inert` (no clicks, no focus) and `aria-busy`, so you
don't need to disable buttons yourself.

## Fine-tuning with `data-skeleton`

Put these on any element inside the wrapper:

| Attribute | Effect |
| --- | --- |
| `data-skeleton="keep"` | Render this element for real (static labels, headings that don't depend on data). |
| `data-skeleton="ignore"` | Skip it entirely (no bone). |
| `data-skeleton="block"` | One solid block for the whole element (charts, maps, custom widgets). |
| `data-skeleton="text"` | One text bar for the whole element. |
| `data-skeleton="surface"` | Keep its background/border as a surface even if it looks like a button. |

Automatic behavior you don't need to replicate: `img/svg/video/canvas/input/select/textarea/button` become blocks with
the same border radius (round avatars stay round); small elements with a
background or border (chips, badges, pills, buttons) become one rounded block;
cards/panels keep their background, border and shadow; each line of wrapped
text becomes its own bar; content inside scroll containers is clipped;
entrance animations (`from { opacity: 0; transform: translateY(8px) }`) get
bones at the content's resting position and are re-measured when they end.
Static `opacity: 0` content gets no bones.

## Props

| Prop | Default | Notes |
| --- | --- | --- |
| `loading` | `data == null` | Show the skeleton. |
| `data` / `placeholder` / children fn | | Render-prop form. `placeholder` may be a value or `() => value`. With `usePlaceholder`, pass only `loading`. |
| `id` | | Cache key for remembered layouts. Not the DOM `id` (never forwarded). |
| `fallback` | | Shown when nothing can be measured and nothing is cached. |
| `animation` | `"shimmer"` | `"shimmer" \| "pulse" \| "none"`. |
| `as` | `"div"` | Wrapper element (always `display: contents`). |
| `fade` | `200` | ms to fade the skeleton out when loading ends. |
| `label` | | Screen-reader text while loading: `role="status"` with that accessible name (`getByRole("status", { name: label })`). Rendered as a sibling of the wrapper. |
| `textHeight` | `0.72` | Text bar height as a fraction of font size. |
| `surfaces` | `true` | Copy card backgrounds/borders. |
| `persist` | `true` | Save `id` layouts to localStorage. |
| other HTML attributes | | `aria-*`, `data-*`, `role`, `className`, `style`… forwarded to the wrapper. Not `id`. |

`<SkeletonSuspense>` and `useSuspenseData(promise, placeholder)`: see
Suspense above.

`<SkeletonList>`: the same props as `<Skeleton>`, with `items` (instead of `data`),
`placeholder` (one item) and `count` (default 3); children get `(item, index)`.

`<SkeletonProvider animation="pulse" fade={0}>` sets defaults for a subtree.

Theme with CSS variables on any ancestor: `--autoskeleton-color`,
`--autoskeleton-highlight`, `--autoskeleton-radius`,
`--autoskeleton-text-radius`, `--autoskeleton-duration`.

Dark mode: the default highlight follows the inherited `color-scheme`
(`light-dark()`), not the OS setting. If the app has its own theme toggle
(class or `data-theme` on `<html>`), make sure the dark theme sets
`color-scheme: dark` (e.g. `html.dark { color-scheme: dark; }`); Tailwind's
`dark:` class alone doesn't. Don't hardcode `--autoskeleton-highlight` per
theme for this.

## Checklist

- [ ] Real component wrapped in `<Skeleton>`; no hand-written skeleton markup.
- [ ] Data from `usePlaceholder` (or the render prop); no leftover `?.`/`?? ""` guards for loading.
- [ ] Placeholder has every field the component reads (no runtime `undefined` access).
- [ ] Placeholder images use `fake.image(w, h)` (or the img has CSS width/height).
- [ ] Early `return <Spinner/>`/`return null` for loading removed.
- [ ] Old `*Skeleton` components deleted if unused.
- [ ] Lists of same-shaped items use `SkeletonList` (one placeholder item + `count`).
- [ ] Tables use `as="tbody"`.
- [ ] Every `useEffect` in wrapped components (and their children) checked: outside-world effects return early when `useSkeleton()` is true.
- [ ] Placeholder covers nested objects, nullable fields and anything parsed/formatted (`new Date(...)`, `.toFixed()`, `.map()` on arrays).
- [ ] Refetch → `loading={isFetching}`; load-more → `SkeletonList loading` only for the new page; Suspense → `<SkeletonSuspense>` with `useSuspenseData(promise, PLACEHOLDER)` in the child.
- [ ] Suspense: pass the placeholder to `useSuspenseData` (typed), not the boundary's untyped `fallback`; no "has no placeholder" or unused-`fallback` warnings in the console.
