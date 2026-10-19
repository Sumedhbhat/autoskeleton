import { use } from "react";
import { fake } from "autoskeleton";
import type { Comment } from "../api";
import { initials, shortDate } from "../format";

export const COMMENTS_PLACEHOLDER: Comment[] = fake.list(3, (i): Comment => ({
  id: fake.id(i),
  author: { name: fake.name(i), avatarUrl: fake.image(64, 64) },
  body: fake.sentence(14, i),
  createdAt: "2026-10-01T10:00:00Z",
}));

export function CommentList({ comments }: { comments: Comment[] }) {
  return (
    <ul className="comments">
      {comments.map((c) => (
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
  );
}

export function Comments({ promise }: { promise: Promise<Comment[]> }) {
  const comments = use(promise);
  return <CommentList comments={comments} />;
}
