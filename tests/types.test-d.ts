// Type-level tests, checked by `npm run typecheck` (never run or shipped).
import { fake, useSuspenseData, type SkeletonListProps, type SkeletonSuspenseProps } from "autoskeleton";

interface Comment {
  id: string;
  body: string;
}
declare const promise: Promise<Comment[]>;
declare const thenable: PromiseLike<{ name: string }>;
declare const status: Promise<{ state: "ok" | "failed" }>;
const COMMENTS: Comment[] = [{ id: "1", body: "Text" }];
const MAYBE: (Comment | null)[] = [null];
const COMMENT: Comment = { id: fake.id(), body: fake.sentence(8) };
// A list placeholder declared once: one item, repeated with its own id per row.
const LIST = fake.list(3, (i) => ({ ...COMMENT, id: fake.id(i) }));
const WRONG_LIST = fake.list(3, (i) => ({ id: fake.id(i) }));
// Numeric ids (Hacker News-style items): fake.id(i, "number").
interface Story {
  id: number;
  title: string;
}
declare const stories: Promise<Story[]>;
const STORY: Story = { id: fake.id(0, "number"), title: fake.sentence(8) };
const STORIES = fake.list(3, (i) => ({ ...STORY, id: fake.id(i, "number") }));

type Equal<A, B> = (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2 ? true : false;
const expect = <T extends true>(): T => true as T;

export function Typed() {
  // T comes from the promise, and the placeholder is checked against it.
  const a = useSuspenseData(promise, COMMENTS);
  expect<Equal<typeof a, Comment[]>>();
  const b = useSuspenseData(promise, () => COMMENTS);
  expect<Equal<typeof b, Comment[]>>();
  const c = useSuspenseData(promise, [{ id: "2", body: "Inline literal" }]);
  expect<Equal<typeof c, Comment[]>>();
  const d = useSuspenseData(thenable, { name: "Ada" });
  expect<Equal<typeof d, { name: string }>>();
  // Without a placeholder (the boundary's untyped `fallback`, or none).
  const e = useSuspenseData(promise);
  expect<Equal<typeof e, Comment[]>>();
  // An empty list is a valid Comment[]; it doesn't widen T.
  const f = useSuspenseData(promise, []);
  expect<Equal<typeof f, Comment[]>>();
  // fake.list returns a plain T[]: a list of Comment-shaped items is a Comment[].
  expect<Equal<typeof LIST, { id: string; body: string }[]>>();
  const g = useSuspenseData(promise, LIST);
  expect<Equal<typeof g, Comment[]>>();
  const h = useSuspenseData(promise, fake.list(2, (i) => ({ ...COMMENT, id: fake.id(i) })));
  expect<Equal<typeof h, Comment[]>>();
  const k = useSuspenseData(promise, () => fake.list(2, (i) => ({ ...COMMENT, id: fake.id(i) })));
  expect<Equal<typeof k, Comment[]>>();
  // Numeric ids: fake.id(i, "number") keeps `id: number`.
  expect<Equal<typeof STORIES, { id: number; title: string }[]>>();
  const m = useSuspenseData(stories, STORIES);
  expect<Equal<typeof m, Story[]>>();
  const n = useSuspenseData(stories, fake.list(2, (i) => ({ ...STORY, id: fake.id(i, "number") })));
  expect<Equal<typeof n, Story[]>>();
  return [a, b, c, d, e, f, g, h, k, m, n];
}

export function Rejected() {
  // @ts-expect-error wrong shape: missing `body`
  useSuspenseData(promise, [{ id: "1" }]);
  // @ts-expect-error wrong shape: not a list
  useSuspenseData(promise, COMMENTS[0]!);
  // @ts-expect-error wrong field type
  useSuspenseData(thenable, { name: 1 });
  // @ts-expect-error excess field in a literal
  useSuspenseData(thenable, { name: "Ada", extra: true });
  // @ts-expect-error a lazy placeholder of the wrong shape
  useSuspenseData(promise, () => [{ id: "1" }]);
  // @ts-expect-error a wider placeholder doesn't widen T (NoInfer): it must be a Comment[]
  useSuspenseData(promise, MAYBE);
  // @ts-expect-error same for a union field
  useSuspenseData(status, { state: "loading" as string });
  // @ts-expect-error a fake.list placeholder of the wrong item shape: missing `body`
  useSuspenseData(promise, WRONG_LIST);
  // @ts-expect-error same, inline
  useSuspenseData(promise, fake.list(2, (i) => ({ id: fake.id(i) })));
  // @ts-expect-error a fake.list item with a wrong field type
  useSuspenseData(promise, fake.list(2, (i) => ({ ...COMMENT, id: i })));
  // @ts-expect-error a string fake.id where the item's id is a number
  useSuspenseData(stories, fake.list(2, (i) => ({ ...STORY, id: fake.id(i) })));
  // @ts-expect-error one fake item where the promise gives a list
  useSuspenseData(promise, fake.list(1, () => COMMENT)[0]!);
  // @ts-expect-error not a promise
  useSuspenseData(COMMENTS, COMMENTS);
}

// SkeletonSuspense takes the wrapper's HTML attributes, like <Skeleton>.
export const suspenseAttributes: SkeletonSuspenseProps = {
  as: "ul",
  id: "posts",
  label: "Loading posts",
  "aria-label": "Posts",
  "data-section": "posts",
  role: "list",
  title: "Posts",
  onClick: () => {},
};
// @ts-expect-error `id` is the cache key, a string
export const suspenseNumericId: SkeletonSuspenseProps = { id: 1 };
// @ts-expect-error not an HTML attribute
export const suspenseUnknown: SkeletonSuspenseProps = { notAnAttribute: true };

// SkeletonList takes the wrapper's HTML attributes too; `id` stays the cache key.
export const listAttributes: SkeletonListProps<Comment> = {
  as: "ul",
  id: "stories",
  label: "Loading stories",
  "aria-label": "Stories",
  "data-section": "stories",
  title: "Stories",
  onClick: () => {},
  items: null,
  placeholder: COMMENT,
  count: 5,
  children: (c) => c.body,
};
// @ts-expect-error `id` is the cache key, a string
export const listNumericId: SkeletonListProps<Comment> = { id: 1, placeholder: COMMENT, children: () => null };
// @ts-expect-error not an HTML attribute
export const listUnknown: SkeletonListProps<Comment> = { notAnAttribute: true, placeholder: COMMENT, children: () => null };
