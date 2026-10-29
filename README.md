<img src="assets/icon.svg" width="64" height="64" alt="">

# autoskeleton

Loading skeletons for React, measured from the component you already have.

You wrap the real component, hand it stand-in data while loading, and
autoskeleton renders it invisibly, measures it, and paints a skeleton with the
same shape: a bar for every line of text, blocks for images, buttons, inputs
and pills, and the card backgrounds and borders they sit on. There's no second
`UserCardSkeleton` to write, and nothing to keep in sync when the design
changes.

```tsx
import { Skeleton, fake, usePlaceholder } from "autoskeleton";

const USER_PLACEHOLDER: User = {
  name: fake.name(),
  handle: fake.text(10),
  bio: fake.sentence(16),
  avatarUrl: fake.image(56, 56),
};

function Profile() {
  const query = useQuery(userQuery);
  const { data: user, loading } = usePlaceholder(query.data, USER_PLACEHOLDER);
  return (
    <Skeleton loading={loading}>
      <UserCard user={user} />
    </Skeleton>
  );
}
```

`loading` is `data == null`, and `user` is always a `User` (the placeholder
until data arrives), so there's no `user?.name ?? ""` dance inside `UserCard`.

## Install

```sh
npm install autoskeleton
```

React 18 or 19. No CSS import or provider is required: the stylesheet is
injected on first use (and hoisted into the SSR output on React 19). If you
prefer a static file, import `autoskeleton/styles.css` and set
`<SkeletonProvider injectStyles={false}>`.

## Usage

### `usePlaceholder`

```tsx
const { data: d, loading } = usePlaceholder(query.data, PAGE_PLACEHOLDER);

<Skeleton loading={loading}>
  <UserCard user={d.user} />
  <Feed posts={d.posts} />
</Skeleton>
```

`d` is the real data, or the placeholder while loading, typed as `T` either
way, so nested fields work directly in JSX. `loading` defaults to
`data == null`; pass `{ loading: isLoading }` to override it. The placeholder
can be a value or `() => value` (a pure factory, called when first
needed and cached with the component's state).

### Render prop

The same thing without the hook, when you'd rather keep it inline:

```tsx
<Skeleton data={data} placeholder={USER_PLACEHOLDER}>
  {(user) => <UserCard user={user} />}
</Skeleton>
```

### Explicit `loading`

For anything you can already render while loading:

```tsx
<Skeleton loading={isLoading}>
  <SettingsForm plan={plan} />
</Skeleton>
```

### Placeholder data

`fake` builds deterministic stand-in data (identical on server and client):

```ts
fake.text(24)            // ~24 characters of words
fake.sentence(12, seed)  // 12 words, ends with "."
fake.paragraph(3, seed)  // 3 sentences
fake.name(seed)          // two words
fake.email(seed)
fake.number(4)           // 8888
fake.image(400, 300)     // transparent image with real intrinsic size
fake.list(5, (i) => ({ id: fake.id(i), title: fake.sentence(6, i) }))
fake.id(i)               // "skeleton-<i>"
fake.id(i, "number")     // -1 - i: numeric ids, never collides with real ones
fake.date()              // fixed ISO string
```

Placeholders only need the right shape and roughly the right text length. The
closer the lengths are to real data, the less the page moves when data arrives.

### Tables, lists and grids

The wrapper is `display: contents`, so it never changes flex or grid layout.
Inside a table, render it as the `tbody` (`rows` from `usePlaceholder`):

```tsx
<table>
  <thead>…</thead>
  <Skeleton as="tbody" loading={loading}>
    {rows.map((r) => <Row key={r.id} row={r} />)}
  </Skeleton>
</table>
```

When the wrapper is the list itself, label it like any element: HTML
attributes go to the wrapper.

```tsx
<Skeleton as="ul" aria-label="Stories" loading={loading}>
  {stories.map((s) => <Story key={s.id} story={s} />)}
</Skeleton>
```

### Refetching and "load more"

```tsx
// Refetch: skeleton over the stale results
<Skeleton loading={isFetching}>
  <Results items={data ?? RESULTS_PLACEHOLDER} />
</Skeleton>

// Load more: keep loaded rows, skeleton only the next page
{items.map((it) => <Row key={it.id} item={it} />)}
{loadingMore && (
  <Skeleton loading>
    {PAGE_PLACEHOLDER.map((it) => <Row key={it.id} item={it} />)}
  </Skeleton>
)}
```

### Suspense: `SkeletonSuspense` and `useSuspenseData`

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

While the children suspend, the boundary renders the same children again as
the skeleton, and `useSuspenseData(promise, placeholder)` returns the
placeholder there instead of suspending. Everywhere else it reads the promise
like `use()`. When the content shows, the skeleton fades out over it. Works on
React 18 and 19.

The placeholder is type-checked against what the promise resolves to, so a
placeholder of the wrong shape is a compile error, not a crash.

Use `SkeletonSuspense` + `useSuspenseData` when the data comes from a promise
under a Suspense boundary. Without one (`useQuery(...).data`, a store, props),
use `usePlaceholder`.

#### `<SkeletonSuspense>`

| Prop | |
| --- | --- |
| `children` | The content. Read promises with `useSuspenseData(promise, placeholder)`. |
| `fallback` | Optional, **untyped** placeholder data (or `() => data`) for calls that pass none. See below. Never an element. |
| `id` | Cache key. The content's layout is remembered and drawn when the skeleton measures nothing. |
| `name` | Passed to `<Suspense name>` (React 19 DevTools). |
| `label` | Screen-reader text while suspended: one `role="status"` named by it, outside the inert skeleton. None once the content shows. |
| `aria-*`, `data-*`, `role`, `title`, event handlers… | Forwarded to the wrapper (`SkeletonHTMLAttributes`), on one element at a time: the skeleton's until the content first shows, then the content's (also while a refetch hides it). `id` is never forwarded. |
| `animation`, `as`, `fade`, `textHeight`, `surfaces`, `persist`, `className`, `style` | As on `<Skeleton>`. `className` and `style` go on both wrappers. |

#### `useSuspenseData`

```ts
function useSuspenseData<T>(promise: PromiseLike<T>, placeholder?: NoInfer<T> | (() => NoInfer<T>)): T;
```

- **Inside the skeleton** (a `SkeletonSuspense` fallback) it returns
  `placeholder` (or the boundary's `fallback` if the call has none) without
  suspending. With neither, it suspends; see "No placeholder, warnings, errors" below. `T` is inferred from the promise only
  (the parameter is `NoInfer<T>`), so a wider or different placeholder is an
  error instead of widening `T`. Needs TypeScript 5.4 or later.
- **Everywhere else** (the real content, or no `SkeletonSuspense` above) it is
  `use(promise)`: it suspends until the promise settles, returns the value,
  and throws a rejection to the nearest error boundary. `placeholder` is
  ignored.
- A promise that is already settled and says so (`status: "fulfilled"` with
  `value`, or `"rejected"` with `reason`, the `use()` convention) is read
  synchronously, without `use()`: no suspense, no skeleton, the content is in
  the first commit, also inside `act()` (React Testing Library), on React 18
  and 19. On React 18 a promise seen settling before is read the same way.
- `placeholder` can be `() => value`, called on each skeleton render. Keep
  it pure and cheap, or hoist the value to module scope.
- Any number of calls can sit under one boundary, each with its own
  placeholder. Nested boundaries: an inner boundary inside an outer skeleton
  renders as a skeleton too, without waiting on its promises.
- Create the promise outside render (a loader, an event handler, a cache) and
  pass it down. A new promise per render suspends forever.

#### The untyped `fallback` shorthand

```tsx
<SkeletonSuspense fallback={COMMENTS_PLACEHOLDER}>
  <Comments promise={commentsPromise} /> {/* useSuspenseData(promise), no placeholder */}
</SkeletonSuspense>
```

Every call without its own placeholder gets the boundary's `fallback` (a
`() => data` is called once per skeleton render and shared). It crosses a
React context, so **TypeScript can't check it against the promise**: a wrong
shape compiles and crashes at runtime. Prefer the typed form above. A call's
own placeholder wins over `fallback`; with nested boundaries, the nearest
`fallback` wins.

#### No placeholder, warnings, errors

- A call with no placeholder and no `fallback` suspends inside the skeleton.
  The skeleton then drops the children up to the nearest `<Suspense>` around
  that call (all of them if there's none). With `id`, the cached layout is
  drawn when nothing is left to measure.
- Development builds warn (`console.warn`, once per skeleton) when:
  - a call had no placeholder: pass one, `useSuspenseData(promise, PLACEHOLDER)`.
    Not shown when the boundary has an `id`, since the cache covers it;
  - `fallback` was given and nothing read it: every call passes its own
    placeholder (drop `fallback`), or the children suspend some other way.
- Errors: a rejected promise throws from the real content, as with `use()`.
  Put an error boundary above the `SkeletonSuspense`, and retry with a new
  promise.
- Only `useSuspenseData` sees the placeholder. A component that suspends some
  other way (`useSuspenseQuery`, `lazy`, `use()` directly) suspends in the
  skeleton too, and drops out of it as above. Hand `useSuspenseData` a
  promise instead; for TanStack Query, see below.
- The skeleton render runs the children's effects with placeholder data;
  `useSkeleton()` is true there, so gate side effects with it (see Side
  effects).

#### TanStack Query

`useSuspenseQuery` suspends on its own, so it can't show a placeholder.
Build the promise from the query cache instead, kept stable per query key
until the data changes (`use()` needs the same promise across renders;
`queryClient.query()` returns a new one per call). Checked against
`@tanstack/react-query` 5.104, which has no `useQuery().promise`:

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

The skeleton render doesn't fetch (`useSkeleton()` is true there). Cached
data renders without suspending. A failed fetch throws to the error boundary;
reset the query (`queryClient.resetQueries({ queryKey })`) before retrying. On older 5.x without `queryClient.query`, use
`queryClient.fetchQuery(options)`.

Outside a `SkeletonSuspense`, `useSuspenseData` works under a plain
`<Suspense>`, with a hand-wired skeleton (no fade):

```tsx
<Suspense fallback={<Skeleton loading><CommentList comments={COMMENTS_PLACEHOLDER} /></Skeleton>}>
  <Comments promise={commentsPromise} />
</Suspense>
```

How this differs from `loading`:

- Suspense swaps trees, so the content mounts fresh when data arrives. Its
  state and effects start over: the skeleton and the content are separate
  instances of the children (with `loading` the same tree stays mounted).
- When content that has shown suspends again, React hides it
  (`display: none`) and shows the skeleton. In a transition
  (`startTransition`, most router navigations) React keeps the old content
  instead, with no skeleton. For a skeleton over stale results, use
  `loading={isFetching}`.
- The skeleton renders on the server, placeholder data included, in
  `renderToString` output and in the streaming shell, and streamed content
  replaces it. React doesn't hydrate a
  fallback that is waiting for streamed content, so a server-rendered one
  stays the CSS-only approximation (see How it works) rather than measured
  bones.

### When there's no placeholder: `id`

Give a skeleton an `id` and the layout of its real content is remembered
(memory plus localStorage, a few widths per id). Next time it loads with
nothing to render, the remembered skeleton is drawn and its height reserved.

```tsx
<Skeleton id="profile-card" loading={isLoading} fallback={<Spinner />}>
  {data ? <ProfileCard data={data} /> : null}
</Skeleton>
```

`fallback` shows only on the very first visit, before anything is cached.

Under Suspense, `<SkeletonSuspense id="profile-card">` does the same for
children that read no placeholder: the skeleton render measures nothing, so the
remembered layout is drawn.

### Side effects

While loading, the component really renders with placeholder data, so its
effects run. Gate the ones that talk to the outside world:

```tsx
const isSkeleton = useSkeleton(); // true inside a loading <Skeleton>
useEffect(() => {
  if (isSkeleton) return;
  markSeen(item.id);
}, [item.id, isSkeleton]);
```

The hidden content is `inert` and `aria-busy`, so it can't be clicked or
focused.

### Hints

| Attribute on any element | Effect |
| --- | --- |
| `data-skeleton="keep"` | Render it for real (static labels, headings). |
| `data-skeleton="ignore"` | No bone for it. |
| `data-skeleton="block"` | One block for the whole element (charts, maps). |
| `data-skeleton="text"` | One text bar for the whole element. |
| `data-skeleton="surface"` | Keep its background/border even if it looks like a button. |

### Props

| Prop | Default | |
| --- | --- | --- |
| `loading` | `data == null` | Show the skeleton. |
| `data`, `placeholder`, children function | | Render-prop form. `placeholder` can be a value or `() => value`. Or use `usePlaceholder` and pass only `loading`. |
| `id` | | Cache key for remembered layouts. Not the DOM `id` (never forwarded). |
| `fallback` | | Shown when nothing can be measured and nothing is cached. |
| `animation` | `"shimmer"` | `"shimmer"`, `"pulse"` or `"none"`. Reduced motion is respected. |
| `as` | `"div"` | Wrapper element (always `display: contents`). |
| `fade` | `200` | Milliseconds to fade the skeleton out when loading ends. |
| `label` | | Screen-reader text while loading: a `role="status"` element named by it (`getByRole("status", { name: label })`), rendered next to the wrapper since the content is `inert`. |
| `textHeight` | `0.72` | Text bar height as a fraction of the font size. |
| `surfaces` | `true` | Copy card backgrounds, borders and shadows. |
| `persist` | `true` | Save `id` layouts to localStorage. |
| `className`, `style`, `aria-*`, `data-*`, `role`, `title`, event handlers… | | Forwarded to the wrapper element (`SkeletonHTMLAttributes`). |

`id` is the cache key, so it is never forwarded as the wrapper's DOM `id`.
If you need one, put it on an element inside, or wrap the skeleton.

`<SkeletonSuspense>` and `useSuspenseData(promise, placeholder?)` are covered
under Suspense above.

`<SkeletonProvider>` takes the same options as defaults for a subtree.

### Theming

Theme with CSS variables on any ancestor: `--autoskeleton-color`,
`--autoskeleton-highlight`, `--autoskeleton-radius`,
`--autoskeleton-text-radius`, `--autoskeleton-duration`.

The default bone colour is a translucent grey that works on light and dark
backgrounds. The default shimmer highlight follows the inherited
`color-scheme` (via `light-dark()`), so a class or `data-theme` toggle works
as long as it sets `color-scheme`:

```css
html.dark { color-scheme: dark; } /* or [data-theme="dark"] */
```

Most theme libraries set it already; Tailwind's `dark:` class alone doesn't.
Without a `color-scheme` the page is light and so is the highlight. Browsers
without `light-dark()` follow `prefers-color-scheme` instead.

## How it works

1. While loading, the children render normally inside a `display: contents`
   wrapper that is `visibility: hidden`, `inert` and `aria-busy`. Layout is
   identical to the loaded state, and when data arrives the same tree stays
   mounted: no remount, no layout jump from swapping components. (Suspense
   is the exception; see above.)
2. In a layout effect (before the browser paints) one pass walks the DOM:
   - text nodes are measured with `Range.getClientRects()`, which gives one
     rect per rendered line. Fragments on the same line in the same inline
     formatting context are merged, so `Posted by <b>Ada</b> · 2h` is one bar,
     while separate flex items stay separate;
   - `img`, `svg`, `video`, `canvas`, form controls and `[role=img]` become
     blocks with the element's own border radius (round avatars stay round);
   - small elements with a background or border (buttons, chips, badges,
     pills) become one rounded block;
   - larger elements with chrome (cards, panels) keep their background,
     border and shadow as a surface behind their bones;
   - `overflow` ancestors clip their bones, and bones touching a rounded
     clipping corner inherit its radius.
3. The bones are absolutely positioned spans in a zero-size layer. Positions
   are relative to the layer's own box, so the result is correct whatever the
   containing block is. Inside table internals the layer is portaled next to
   the table so the markup stays valid.
4. A `ResizeObserver`, a `MutationObserver`, image `load` events, font loading,
   `animationend`/`transitionend` and (when needed) scroll trigger a
   re-measure, coalesced to one per frame. Content at `opacity: 0` gets no
   bones, unless an opacity animation or transition is running on it
   (entrance animations like `from { opacity: 0 }`). Content moved by a
   running transform, translate, scale or rotate animation is measured where
   it comes to rest, so bones don't jump when the animation ends.
5. When loading ends, the layer fades out over the already-visible content.

On the server, content is hidden with an inline style (so placeholder text
never flashes before CSS loads) and a CSS-only approximation shows until
hydration measures the real thing: text is transparent; media, controls and
boxes holding only text (avatars with initials, chips, badges, lines of text)
become bone-coloured blocks with their own radius, brand colours, borders and
shadows removed; boxes with block children (cards) keep their surface.

### Performance

Measured with `npm run bench` (Chrome, a feed of posts with avatar, name,
text, image and actions; one layout pass):

| Posts | Without culling | With viewport culling (shipped) |
| --- | --- | --- |
| 50 | ~9 ms | ~1.5 ms |
| 200 | ~30 ms | ~2 ms |
| 1,000 | ~150 ms | ~6 ms |

Subtrees more than a viewport away are skipped (they still count toward the
layout size) and measured when you scroll near them. Animation is a
`transform` on a pseudo-element per bone, with every bone in a skeleton
sharing one sweep.

## Prior art and what's different

These projects were studied before writing autoskeleton, and several ideas
come from them. The descriptions are from their own docs as of October 2026
and haven't been benchmarked head to head here, so check them yourself before
relying on the comparison.

| Project | Approach | Taken from it | Different here |
| --- | --- | --- | --- |
| [boneyard-js](https://github.com/0xgf/boneyard) | Captures layouts at build time: a CLI/Vite plugin opens your app in a headless browser at set breakpoints (375/768/1280 by default) and writes `.bones.json` files you import as a registry. | `<Skeleton name loading>`-style wrapping; remembering layouts so a skeleton can be drawn with no data (our `id` cache); fade-out transition. | No build step or headless browser. Layout is measured live at the real width, font and data shape, and remeasured on resize; the cache only fills the gap when nothing can render. |
| [shimmer-from-structure](https://github.com/darula-hpp/shimmer-from-structure) | Runtime: measures leaf elements with `getBoundingClientRect()` in `useLayoutEffect` when `loading` turns true, keeps container backgrounds by making text transparent, and spreads `templateProps` onto the first child for mock data. | Measuring the real component at runtime in a layout effect; keeping card backgrounds; copying border radius. | Text is measured per *line* with `Range.getClientRects()`, not per element box. Remeasures on resize, mutations, image and font loads. Typed placeholder data through a hook or render prop instead of props spread on the first child. Viewport culling for long lists. Content is `inert`/`aria-busy` while hidden. |
| [react-skeletonify](https://dev.to/sinan0333/building-dynamic-skeleton-loaders-in-react-the-easy-way-1fae) | Runtime `SkeletonWrapper loading` that turns the wrapped tree into skeletons, with a global `SkeletonProvider` config. | The provider for global defaults. | Its docs are thin, so this row is the least verified. Compare directly. |
| [react-stencilize](https://dev.to/t4y3/withstencil-stop-writing-skeleton-components-twice-2dfk) | `withStencil(Component)` HOC that renders the component with a deep "safe" Proxy as props and blanks the output, usually as a Suspense fallback. | The goal (never write a component twice) and the "same component as the Suspense fallback" pattern. | A Proxy for automatic placeholder data was tried and dropped: React can't render a Proxy as a text child, so text lengths (the thing that makes skeletons look right) are lost. `fake.*` keeps lengths realistic and data typed. |
| [instaskeleton](https://www.npmjs.com/package/instaskeleton) | No DOM scanning: infers shapes from the JSX element tree, with an optional manual schema and an LRU cache. | | Measures the DOM instead, so CSS (wrapping, grid, aspect ratios, clamping) is reflected exactly. |
| [react-loading-skeleton](https://github.com/dvtng/react-loading-skeleton) | Hand-placed `<Skeleton />` primitives that size themselves to the surrounding text. | The baseline: this is the "write it twice" approach autoskeleton replaces. | Nothing to place by hand, and the skeleton can't drift from the component. |

If you want zero runtime measurement in production, boneyard's build-time
capture is the better fit. If you want the skeleton to follow your real
layout at whatever width, font and data it's rendered with, that's what this
library is for.

## For AI coding agents

The package ships a skill at `skill/autoskeleton/SKILL.md` (also in
`node_modules/autoskeleton/skill/`). Point Claude Code, Cursor or similar at it
when asking them to add loading states. It covers placeholders, refetching,
pagination, Suspense, side effects and the hints above.

`evals/` contains the harness used to test it: two "before" apps full of
hand-written skeletons, spinners and `return null`s, a grader that checks the
result in a real browser (skeleton shown in every section, layout shift when
data arrives, side effects on placeholder data, runtime errors), and the
results in [`evals/RESULTS.md`](evals/RESULTS.md).

## Development

```sh
npm ci
npx playwright install chromium   # once
npm run dev          # demo gallery at http://127.0.0.1:5173
npm run lint
npm run typecheck
npm test             # Playwright suite against the demo
npm run build && npm run test:ssr
npm run check:package
```

### Releases

- `main` publishes a nightly to npm under the `nightly` dist-tag
  (`0.1.0-nightly.<run>`) and a GitHub prerelease.
- `release/X.Y` branches publish stable `X.Y.Z` to `latest`, once per version.
- Fixes for a released line go to its `release/X.Y` branch with a patch bump.

See [`.github/workflows/release.yml`](.github/workflows/release.yml).

## License

MIT
