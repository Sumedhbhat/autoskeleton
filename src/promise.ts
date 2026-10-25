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

/**
 * Read a promise during render, suspending until it settles. React 19 uses
 * `use()`. React 18 gets the same contract by throwing the promise (which
 * Suspense waits on) and, once settled, returning its value or throwing its
 * rejection to the nearest error boundary.
 */
export function readPromise<T>(promise: PromiseLike<T>): T {
  if (reactUse) return reactUse(promise);
  const t = promise as TrackedThenable<T>;
  if (t.status === "fulfilled") return t.value as T;
  if (t.status === "rejected") throw t.reason;
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
