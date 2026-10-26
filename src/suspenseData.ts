"use client";

import { createContext, useContext } from "react";
import { readPromise } from "./promise";

const NONE: unique symbol = Symbol("autoskeleton.none");

/** A SkeletonSuspense fallback, as seen by `useSuspenseData`. */
export interface PlaceholderSlot {
  /** The nearest boundary `fallback` (marking it used), or NONE. */
  read(): unknown;
  /** Record a call that had no placeholder at all. */
  miss(): void;
  /** True once, if this boundary's `fallback` was never read: time to warn. */
  unused(): boolean;
  /** True once, if a call had no placeholder: time to warn. */
  missed(): boolean;
}

/**
 * One per fallback render of a boundary. `fallback` undefined means the
 * boundary has none: reads go to the enclosing boundary's slot, if any.
 * `quiet` turns off the missing-placeholder warning (the `id` cache covers it).
 */
export function createSlot(fallback: unknown, parent: PlaceholderSlot | null, quiet: boolean): PlaceholderSlot {
  let made: { value: unknown } | null = null;
  let used = false;
  let missing = false;
  let warnedUnused = false;
  let warnedMissing = quiet;
  return {
    read() {
      if (fallback === undefined) return parent ? parent.read() : NONE;
      used = true;
      if (typeof fallback !== "function") return fallback;
      // Lazy form: called once per slot, shared by every call under the boundary.
      if (!made) made = { value: (fallback as () => unknown)() };
      return made.value;
    },
    miss() {
      missing = true;
    },
    unused() {
      if (fallback === undefined || used || warnedUnused) return false;
      warnedUnused = true;
      return true;
    },
    missed() {
      if (!missing || warnedMissing) return false;
      warnedMissing = true;
      return true;
    },
  };
}

/** Set inside a SkeletonSuspense fallback; null in the real content. */
export const PlaceholderContext = createContext<PlaceholderSlot | null>(null);

/**
 * Read a promise during render, like React's `use()`, with a typed
 * placeholder for the skeleton.
 *
 * - Inside a `<SkeletonSuspense>` fallback (the skeleton render) it returns
 *   `placeholder` and doesn't suspend, so the component renders itself as the
 *   skeleton. `placeholder` is checked against what `promise` resolves to.
 *   It can be `() => value`, called on each skeleton render.
 * - Everywhere else (the real content, or outside any `SkeletonSuspense`) it
 *   reads `promise`: it suspends until it settles, returns the value, and
 *   throws a rejection to the nearest error boundary. `placeholder` is ignored.
 *
 * Without `placeholder`, the nearest boundary's untyped `fallback` is used.
 * With neither, the call suspends inside the skeleton, which then drops the
 * children up to the nearest `<Suspense>` around the call (all of them if
 * there's none), and a development warning says to pass a placeholder.
 *
 * Don't create `promise` during render: start it in a loader, an event
 * handler or a cache, and pass it down.
 *
 * @example
 * ```tsx
 * function Comments({ promise }: { promise: Promise<Comment[]> }) {
 *   const comments = useSuspenseData(promise, COMMENTS_PLACEHOLDER);
 *   return <CommentList comments={comments} />;
 * }
 *
 * <SkeletonSuspense>
 *   <Comments promise={commentsPromise} />
 * </SkeletonSuspense>
 * ```
 */
export function useSuspenseData<T>(promise: PromiseLike<T>, placeholder?: NoInfer<T> | (() => NoInfer<T>)): T {
  const slot = useContext(PlaceholderContext);
  if (!slot) return readPromise(promise);
  if (placeholder !== undefined) {
    return typeof placeholder === "function" ? (placeholder as () => T)() : placeholder;
  }
  const shared = slot.read();
  if (shared !== NONE) return shared as T;
  // No placeholder anywhere: suspend on the real promise inside the skeleton.
  // SuspenseFallback's inner <Suspense> keeps it from suspending the fallback.
  slot.miss();
  return readPromise(promise);
}

let dev = true;
try {
  // Replaced by bundlers; throws where `process` doesn't exist (dev builds without it).
  dev = process.env.NODE_ENV !== "production";
} catch {
  /* not defined */
}
export const DEV = dev;
