"use client";

import { Fragment, type ReactElement, type ReactNode } from "react";
import { Skeleton, type BaseProps } from "./Skeleton";

/**
 * Props for {@link SkeletonList}: every `<Skeleton>` prop, plus one
 * placeholder item, a `count` and the real `items`.
 *
 * @example
 * ```tsx
 * // A reusable list that fixes the placeholder and row, and forwards the rest.
 * function StoryList(props: Omit<SkeletonListProps<Story>, "placeholder" | "children">) {
 *   return (
 *     <SkeletonList {...props} placeholder={STORY_PLACEHOLDER}>
 *       {(story) => <StoryCard key={story.id} story={story} />}
 *     </SkeletonList>
 *   );
 * }
 *
 * <StoryList items={stories} count={5} />
 * ```
 */
export interface SkeletonListProps<T = unknown> extends Omit<BaseProps, "loading"> {
  /** The real items. While null/undefined, `count` placeholder rows are rendered and measured. */
  items?: readonly T[] | null;
  /** One stand-in item (or `() => item`), repeated `count` times while loading. */
  placeholder: T | (() => T);
  /** Placeholder rows while loading. Default: 3. */
  count?: number;
  /** Override the loading flag. Default: `items == null`. */
  loading?: boolean;
  /** Renders one item. Return a keyed element, as in `.map()`; placeholder rows are keyed for you. */
  children: (item: T, index: number) => ReactNode;
}

// Lists built from `placeholder`, so their rows get index keys (the items are
// identical, so any key derived from them would collide).
const placeholderLists = new WeakSet<readonly unknown[]>();

/**
 * A `<Skeleton>` for lists of same-shaped items: declare one placeholder item
 * and a `count`, and the skeleton is that item rendered `count` times. When
 * `items` arrive, the same function renders each of them.
 *
 * - Return a keyed element, as in `.map()`. Placeholder rows are keyed by
 *   index, so the one item's `id` doesn't collide.
 * - The wrapper is `display: contents`: put it straight inside the flex or
 *   grid container. In a table use `as="tbody"`; for a list, `as="ul"` and
 *   return `<li>`s.
 * - For load more, render a second `<SkeletonList loading>` for the next
 *   page only, below the loaded rows.
 * - Not for Suspense. There, pass
 *   `fake.list(count, (i) => ({ ...item, id: fake.id(i) }))` to
 *   `useSuspenseData(promise, placeholder)` and map its result; each copy
 *   needs its own `id` because you key those rows.
 *
 * @example
 * ```tsx
 * const STORY_PLACEHOLDER: Story = { id: fake.id(), title: fake.sentence(8), by: fake.name() };
 *
 * <SkeletonList items={stories} placeholder={STORY_PLACEHOLDER} count={5}>
 *   {(story) => <StoryCard key={story.id} story={story} />}
 * </SkeletonList>
 *
 * <table>
 *   <SkeletonList as="tbody" items={rows} placeholder={ROW_PLACEHOLDER} count={10}>
 *     {(r) => <Row key={r.id} row={r} />}
 *   </SkeletonList>
 * </table>
 * ```
 */
export function SkeletonList<T>({ placeholder, count = 3, children, items, loading, ...rest }: SkeletonListProps<T>): ReactElement {
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

  return (
    // An empty list has nothing to measure, so while loading it gets the placeholder rows.
    <Skeleton<readonly T[]>
      {...rest}
      data={loading && items?.length === 0 ? null : items}
      loading={loading}
      placeholder={makePlaceholder}
    >
      {render}
    </Skeleton>
  );
}
