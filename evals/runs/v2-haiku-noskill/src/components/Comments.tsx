import { useEffect, useState } from "react";
import { Skeleton, fake } from "autoskeleton";
import type { Comment } from "../api";
import { initials, shortDate } from "../format";

/** Resolves a promise into state, so the list can render a skeleton instead of suspending. */
function useResolved<T>(promise: Promise<T>): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let alive = true;
    promise.then((v) => {
      if (alive) setValue(v);
    });
    return () => {
      alive = false;
    };
  }, [promise]);
  return value;
}

const placeholderComments = (): Comment[] =>
  fake.list(3, (i) => ({
    id: `placeholder-${i}`,
    author: { name: fake.name(i), avatarUrl: "" },
    body: fake.sentence(i === 1 ? 20 : 6, i),
    createdAt: fake.date(),
  }));

export function Comments({ promise }: { promise: Promise<Comment[]> }) {
  const comments = useResolved(promise);
  return (
    <Skeleton data={comments} placeholder={placeholderComments}>
      {(list) => (
        <ul className="comments">
          {list.map((c) => (
            <li key={c.id}>
              <span className="comment-avatar">{initials(c.author.name)}</span>
              <div>
                <div className="comment-head">
                  <strong>{c.author.name}</strong> <span className="muted">{shortDate(c.createdAt)}</span>
                </div>
                <p>{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Skeleton>
  );
}
