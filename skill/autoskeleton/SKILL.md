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
import { Skeleton, fake, usePlaceholder } from "autoskeleton";
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
- Lists: 3–6 items is usually right; for tables use the page size.
- Enums/booleans: pick the variant whose layout is most common (e.g. `verified: true` if it shows a badge).
- Keep IDs unique (`fake.id(i)`, or `fake.id(i, "number")` when the type is a
  number) so React keys don't collide. Numeric ones are negative, so they never
  match a real record.

## Things to remove when converting

1. Early returns: `if (isLoading) return <Spinner />` / `return <UserCardSkeleton />` / `if (!data) return null`. Replace them with the `<Skeleton>` wrapper.
2. The old skeleton component and its CSS (once nothing imports it).
3. Optional chaining and fallbacks sprinkled only to survive `undefined` (`user?.name ?? ""`, `data?.user`). Data from `usePlaceholder` or the render prop is never null; drop them.

## Lists, tables, grids

Wrap the whole list once (not each item):

```tsx
const { data: items, loading } = usePlaceholder(posts, POSTS_PLACEHOLDER);

<Skeleton loading={loading}>
  {items.map((p) => <PostCard key={p.id} post={p} />)}
</Skeleton>
```

Inside a table, render the wrapper as the `tbody` (a `<div>` isn't valid there;
`rows` from `usePlaceholder`):

```tsx
<table>
  <thead>…</thead>
  <Skeleton as="tbody" loading={loading}>
    {rows.map((r) => <Row key={r.id} row={r} />)}
  </Skeleton>
</table>
```

The wrapper is `display: contents`, so it never changes flex/grid layout. Use
`as="li"`/`as="span"` etc. only when HTML nesting rules require it.

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

**Load more / infinite scroll:** keep loaded items on screen; add a skeleton
for the next page only, below them.

```tsx
<ul>
  {items.map((it) => <Row key={it.id} item={it} />)}
  {loadingMore && (
    <Skeleton loading>
      {PAGE_PLACEHOLDER.map((it) => <Row key={it.id} item={it} />)}
    </Skeleton>
  )}
</ul>
```

**Suspense / promises:** pass the promise. `<Skeleton promise>` sets up its
own `<Suspense>`, renders `children(placeholder)` as the skeleton fallback,
then `children(value)` when it resolves. Rejections reach the nearest error
boundary. Works on React 18 and 19 and renders the fallback on the server.

```tsx
<ErrorBoundary fallback={<CommentsError />}>
  <Skeleton promise={commentsPromise} placeholder={COMMENTS_PLACEHOLDER}>
    {(comments) => <CommentList comments={comments} />}
  </Skeleton>
</ErrorBoundary>
```

Don't add your own `<Suspense>` or `use()` around it. Create the promise
outside render (loader, cache, parent state, Server Component prop); a new
promise each render suspends forever. `null`/`undefined` shows the skeleton.
React Query: `promise={useQuery(q).promise}` (needs `experimental_prefetchInRender`).

If the component suspends by itself (`useSuspenseQuery` inside it), wire the
fallback by hand with its presentational part:

```tsx
<Suspense fallback={<Skeleton loading><CommentList comments={COMMENTS_PLACEHOLDER} /></Skeleton>}>
  <Comments /> {/* useSuspenseQuery, then <CommentList> */}
</Suspense>
```

Suspense remounts: the content mounts fresh when data arrives (state and
effects start over). `promise` fades the skeleton out over the content; a
hand-wired fallback just disappears. A new promise after content has shown
hides it and shows the skeleton again (not in a transition). For a skeleton
over stale results, use `loading={isFetching}` instead.

## Components that fetch their own data

If the component calls `useQuery` inside itself, the placeholder trick doesn't
apply directly. Options, in order of preference:

1. Split it: `UserCard` (presentational, takes `user`) + `UserCardContainer` (fetches, calls `usePlaceholder(data, USER_PLACEHOLDER)`, renders `<Skeleton loading={loading}><UserCard user={user} /></Skeleton>`).
2. If it suspends (`useSuspenseQuery`), the hand-wired Suspense fallback above, with the presentational part.
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
<Suspense fallback={<Skeleton id="profile-card" loading />}>
  <Skeleton id="profile-card" loading={false}>
    <ProfileThatSuspends />
  </Skeleton>
</Suspense>
```

`fallback` shows only on the very first visit (nothing cached yet). Prefer
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
| `promise` | | Instead of `data`: a promise. Own Suspense boundary; rejections go to the error boundary. |
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
- [ ] Tables use `as="tbody"`.
- [ ] Every `useEffect` in wrapped components (and their children) checked: outside-world effects return early when `useSkeleton()` is true.
- [ ] Placeholder covers nested objects, nullable fields and anything parsed/formatted (`new Date(...)`, `.toFixed()`, `.map()` on arrays).
- [ ] Refetch → `loading={isFetching}`; load-more → skeleton only for the new page; promise → `<Skeleton promise placeholder>` inside an error boundary; self-suspending component → fallback renders the presentational component with placeholder data.
