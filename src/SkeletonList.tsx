"use client";

import { Fragment, type ReactElement, type ReactNode } from "react";
import { Skeleton, type BaseProps } from "./Skeleton";

interface ListCommon<T> extends Omit<BaseProps, "loading"> {
  /** One stand-in item (or `() => item`), repeated `count` times while loading. */
  placeholder: T | (() => T);
  /** Placeholder rows while loading. Default: 3. */
  count?: number;
  /** Renders one item. Return a keyed element, as in `.map()`; placeholder rows are keyed for you. */
  children: (item: T, index: number) => ReactNode;
}

interface ListItemsProps<T> extends ListCommon<T> {
  /** The real items. While null/undefined, `count` placeholder rows are rendered and measured. */
  items?: readonly T[] | null;
  /** Override the loading flag. Default: `items == null`. */
  loading?: boolean;
  promise?: never;
}

interface ListPromiseProps<T> extends ListCommon<T> {
  /** The items, as a promise. Same Suspense behavior as `<Skeleton promise>`. */
  promise: PromiseLike<readonly T[]> | null | undefined;
  items?: never;
  loading?: never;
}

export type SkeletonListProps<T = unknown> = ListItemsProps<T> | ListPromiseProps<T>;

// Lists built from `placeholder`, so their rows get index keys (the items are
// identical, so any key derived from them would collide).
const placeholderLists = new WeakSet<readonly unknown[]>();

/**
 * A `<Skeleton>` for lists: declare one placeholder item and a `count`, and
 * the skeleton is that item rendered `count` times. When the items arrive
 * (`items`, or `promise` resolving), the same function renders each of them.
 */
export function SkeletonList<T>(props: SkeletonListProps<T>): ReactElement {
  const { placeholder, count = 3, children, items, promise, loading, ...rest } = props as ListCommon<T> &
    Omit<ListItemsProps<T>, keyof ListCommon<T>> & { promise?: PromiseLike<readonly T[]> | null };

  const makePlaceholder = (): readonly T[] => {
    const item = typeof placeholder === "function" ? (placeholder as () => T)() : placeholder;
    const list = Array.from({ length: Math.max(0, Math.floor(count)) }, () => item);
    placeholderLists.add(list);
    return list;
  };
  const render = (list: readonly T[]): ReactNode =>
    placeholderLists.has(list)
      ? list.map((item, i) => <Fragment key={i}>{children(item, i)}</Fragment>)
      : list.map((item, i) => children(item, i));

  if ("promise" in props) {
    return (
      <Skeleton<readonly T[]> {...rest} promise={promise} placeholder={makePlaceholder}>
        {render}
      </Skeleton>
    );
  }
  return (
    <Skeleton<readonly T[]> {...rest} data={items} loading={loading} placeholder={makePlaceholder}>
      {render}
    </Skeleton>
  );
}
