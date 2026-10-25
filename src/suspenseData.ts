"use client";

import { createContext, useContext } from "react";
import { readPromise } from "./promise";

/** A SkeletonSuspense fallback's placeholder, as seen by `useSuspenseData`. */
export interface PlaceholderSlot {
  /** The placeholder; marks the slot as used. */
  read(): unknown;
  /** True once, if nothing read the placeholder: time to warn. */
  unused(): boolean;
}

export function createSlot(fallback: unknown): PlaceholderSlot {
  let made: { value: unknown } | null = null;
  let used = false;
  let warned = false;
  return {
    read() {
      used = true;
      if (typeof fallback !== "function") return fallback;
      // Lazy form: called once per slot, shared by every call under the boundary.
      if (!made) made = { value: (fallback as () => unknown)() };
      return made.value;
    },
    unused() {
      if (used || warned) return false;
      warned = true;
      return true;
    },
  };
}

/** Set inside a SkeletonSuspense fallback; null in the real content. */
export const PlaceholderContext = createContext<PlaceholderSlot | null>(null);

/**
 * Read a promise like React's `use()`. Inside a `<SkeletonSuspense>`
 * fallback it returns the placeholder instead and doesn't suspend, so the
 * component renders itself as the skeleton.
 *
 * The boundary's `fallback` crosses a context, so it isn't checked against
 * `T`: it must have the shape `promise` resolves to. Pass `placeholder` to
 * use a typed one for this call instead (it wins over the boundary's).
 * Outside a fallback, `placeholder` is ignored and the promise is read.
 */
export function useSuspenseData<T>(promise: PromiseLike<T>, placeholder?: T | (() => T)): T {
  const slot = useContext(PlaceholderContext);
  if (!slot) return readPromise(promise);
  if (placeholder !== undefined) {
    return typeof placeholder === "function" ? (placeholder as () => T)() : placeholder;
  }
  return slot.read() as T;
}

let dev = true;
try {
  // Replaced by bundlers; throws where `process` doesn't exist (dev builds without it).
  dev = process.env.NODE_ENV !== "production";
} catch {
  /* not defined */
}
export const DEV = dev;
