// Type-level tests, checked by `npm run typecheck` (never run or shipped).
import { useSuspenseData, type SkeletonSuspenseProps } from "autoskeleton";

interface Comment {
  id: string;
  body: string;
}
declare const promise: Promise<Comment[]>;
declare const thenable: PromiseLike<{ name: string }>;
declare const status: Promise<{ state: "ok" | "failed" }>;
const COMMENTS: Comment[] = [{ id: "1", body: "Text" }];
const MAYBE: (Comment | null)[] = [null];

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
  return [a, b, c, d, e, f];
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
