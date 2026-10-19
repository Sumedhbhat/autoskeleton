import { use } from "react";
import type { Comment } from "../api";
import { initials, shortDate } from "../format";

export function Comments({ promise }: { promise: Promise<Comment[]> }) {
  return <CommentList comments={use(promise)} />;
}

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
