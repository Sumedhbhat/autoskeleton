import { useCallback, useEffect, useState } from "react";
import { api, type Issue } from "./api";

export function useAsync<T>(fn: () => Promise<T>): { data: T | undefined; loading: boolean } {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    fn().then((d) => {
      if (alive) {
        setData(d);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { data, loading };
}

/** Paginated issues with "load more". */
export function useIssues() {
  const [items, setItems] = useState<Issue[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    api.issues(0).then((p) => {
      setItems(p.items);
      setNextPage(p.nextPage);
      setLoading(false);
    });
  }, []);

  const loadMore = useCallback(() => {
    if (nextPage === null || loadingMore) return;
    setLoadingMore(true);
    api.issues(nextPage).then((p) => {
      setItems((prev) => [...prev, ...p.items]);
      setNextPage(p.nextPage);
      setLoadingMore(false);
    });
  }, [nextPage, loadingMore]);

  return { items, loading, loadingMore, hasMore: nextPage !== null, loadMore };
}

/** Search that refetches on every query change, keeping the previous results. */
export function useSearch(query: string) {
  const [data, setData] = useState<Issue[]>();
  const [fetching, setFetching] = useState(true);
  useEffect(() => {
    let alive = true;
    setFetching(true);
    api.search(query).then((d) => {
      if (alive) {
        setData(d);
        setFetching(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [query]);
  return { data, fetching };
}
