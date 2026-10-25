import { useState } from "react";

export interface UsePlaceholderOptions {
  /** Override the loading flag. Default: `data == null`. */
  loading?: boolean;
}

export interface PlaceholderResult<T> {
  /** The real data, or the placeholder while loading. Never null. */
  data: T;
  loading: boolean;
}

/**
 * Real data when it's there, `placeholder` while loading, always typed as
 * `T`. Pair it with `<Skeleton loading={loading}>` to use the data directly in
 * JSX, nested fields included, without a children function.
 *
 * A function `placeholder` must be pure: it's called when first needed and
 * the result cached in the component's state. React may call it again if it
 * discards a render before that state is kept.
 * If `loading` is forced to false while `data` is still null, you get the
 * placeholder (visibly), since `data` is never null.
 */
export function usePlaceholder<T>(
  data: T | null | undefined,
  placeholder: T | (() => T),
  options?: UsePlaceholderOptions,
): PlaceholderResult<T> {
  const [made, setMade] = useState<{ value: T } | null>(null);
  const loading = options?.loading ?? data == null;
  if (!loading && data != null) return { data, loading };
  if (typeof placeholder !== "function") return { data: placeholder, loading };
  if (made) return { data: made.value, loading };
  // First time it's needed: store it (React re-renders before committing).
  const value = (placeholder as () => T)();
  setMade({ value });
  return { data: value, loading };
}
