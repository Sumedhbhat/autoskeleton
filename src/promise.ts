import * as React from "react";

/**
 * A thenable carrying its settled state, the convention React 19's `use()`
 * and libraries like React Query use. When the fields are already there we
 * read them; otherwise we track the promise ourselves.
 */
interface TrackedThenable<T> extends PromiseLike<T> {
  status?: "pending" | "fulfilled" | "rejected";
  value?: T;
  reason?: unknown;
}

type Settled<T> = { status: "pending" } | { status: "fulfilled"; value: T } | { status: "rejected"; reason: unknown };

// Read through the namespace so React 18 (no `use` export) still links.
const reactUse = (React as unknown as { use?: <T>(usable: PromiseLike<T>) => T }).use;

const tracked = new WeakMap<PromiseLike<unknown>, Settled<unknown>>();
/** Promises React 19 suspended on through use(): read them through use() from then on. */
const suspendedOn = new WeakSet<PromiseLike<unknown>>();

/**
 * Read a promise during render, suspending until it settles.
 *
 * A settled promise is read synchronously: the value is returned, the
 * rejection thrown to the nearest error boundary. It never suspends, so the
 * content is in the first commit (also inside `act()`). "Settled" means
 * marked `status: "fulfilled"`/`"rejected"` (the `use()` convention), or, on
 * React 18, seen settling here before.
 *
 * A pending one suspends: through `use()` on React 19, and on React 18 by
 * throwing the promise for Suspense to wait on. React 19 marks the promises
 * it suspends on, and expects a component that suspended on one to call
 * `use()` again once it settles (it warns otherwise), so those keep going
 * through `use()`, which returns their value synchronously then.
 */
export function readPromise<T>(promise: PromiseLike<T>): T {
  if (reactUse && suspendedOn.has(promise)) return reactUse(promise);
  const t = promise as TrackedThenable<T>;
  if (t.status === "fulfilled") return t.value as T;
  if (t.status === "rejected") throw t.reason;
  if (reactUse) {
    suspendedOn.add(promise);
    return reactUse(promise);
  }
  let s = tracked.get(promise) as Settled<T> | undefined;
  if (!s) {
    s = { status: "pending" };
    tracked.set(promise, s);
    promise.then(
      (value) => void tracked.set(promise, { status: "fulfilled", value }),
      (reason: unknown) => void tracked.set(promise, { status: "rejected", reason }),
    );
  }
  if (s.status === "fulfilled") return s.value;
  if (s.status === "rejected") throw s.reason;
  throw promise;
}
