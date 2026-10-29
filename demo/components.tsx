// Ordinary app components. None of them know skeletons exist.

export interface User {
  name: string;
  handle: string;
  avatar: string;
  bio: string;
  followers: number;
  verified: boolean;
}

export function UserCard({ user }: { user: User }) {
  return (
    <div className="card user-card">
      <img className="avatar" src={user.avatar} alt="" width={56} height={56} />
      <div className="user-meta">
        <h3>
          {user.name} {user.verified && <span className="badge">Verified</span>}
        </h3>
        <p className="muted">@{user.handle}</p>
        <p>{user.bio}</p>
        <div className="row">
          <button className="btn">Follow</button>
          <span className="muted">{user.followers.toLocaleString()} followers</span>
        </div>
      </div>
    </div>
  );
}

export interface Post {
  id: string;
  author: string;
  time: string;
  body: string;
  image?: string;
  likes: number;
}

export function PostItem({ post }: { post: Post }) {
  return (
    <article className="post">
      <header className="row">
        <div className="avatar-sm" style={{ background: "#7c3aed" }} />
        <strong>{post.author}</strong>
        <span className="muted">· {post.time}</span>
      </header>
      <p>{post.body}</p>
      {post.image && <img className="post-img" src={post.image} alt="" />}
      <footer className="row muted">
        <span>♥ {post.likes}</span>
        <a href="#reply">Reply</a>
        <a href="#share">Share</a>
      </footer>
    </article>
  );
}

export function Feed({ posts }: { posts: Post[] }) {
  return (
    <div className="feed">
      {posts.map((p) => (
        <PostItem key={p.id} post={p} />
      ))}
    </div>
  );
}

export interface Invoice {
  id: string;
  customer: string;
  amount: string;
  status: "paid" | "due" | "overdue";
  date: string;
}

export function InvoiceRow({ row: r }: { row: Invoice }) {
  return (
    <tr>
      <td>{r.id}</td>
      <td>{r.customer}</td>
      <td className="num">{r.amount}</td>
      <td>
        <span className={`pill pill-${r.status}`}>{r.status}</span>
      </td>
      <td>{r.date}</td>
    </tr>
  );
}

export function InvoiceRows({ rows }: { rows: Invoice[] }) {
  return (
    <>
      {rows.map((r) => (
        <InvoiceRow key={r.id} row={r} />
      ))}
    </>
  );
}

export interface Stat {
  label: string;
  value: string;
  delta: string;
}

export function StatTiles({ stats }: { stats: Stat[] }) {
  return (
    <div className="stats">
      {stats.map((s) => (
        <div className="tile" key={s.label}>
          <div className="muted small">{s.label}</div>
          <div className="big">{s.value}</div>
          <div className="delta">{s.delta}</div>
        </div>
      ))}
    </div>
  );
}

export interface Article {
  title: string;
  lede: string;
  paragraphs: string[];
}

export function ArticleView({ article }: { article: Article }) {
  return (
    <div className="article">
      <h1>{article.title}</h1>
      <p className="lede">{article.lede}</p>
      {article.paragraphs.map((p, i) => (
        <p key={i}>
          {p} <code>useEffect</code> and <a href="#x">a link that may wrap across lines</a>.
        </p>
      ))}
    </div>
  );
}

export function SettingsForm({ email, plan }: { email: string; plan: string }) {
  return (
    <form className="form" onSubmit={(e) => e.preventDefault()}>
      <label>
        Email
        <input defaultValue={email} />
      </label>
      <label>
        Plan
        <select defaultValue={plan}>
          <option>Free</option>
          <option>Pro</option>
        </select>
      </label>
      <label className="check">
        <input type="checkbox" defaultChecked /> Send me product updates
      </label>
      <textarea defaultValue="Notes" rows={3} />
      <div className="row">
        <button className="btn">Save</button>
        <button className="btn btn-ghost" type="button">
          Cancel
        </button>
      </div>
    </form>
  );
}

export interface Product {
  id: string;
  title: string;
  price: string;
  image: string;
}

export function ProductCard({ product: p }: { product: Product }) {
  return (
    <div className="product">
      <img src={p.image} alt="" />
      <div className="product-title">{p.title}</div>
      <div className="price">{p.price}</div>
    </div>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="products">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

export interface Message {
  id: string;
  from: string;
  subject: string;
}

export function InboxItem({ message: m }: { message: Message }) {
  return (
    <li>
      <strong>{m.from}</strong>
      <span>{m.subject}</span>
    </li>
  );
}

export function Inbox({ items }: { items: Message[] }) {
  return (
    <ul className="inbox">
      {items.map((m) => (
        <InboxItem key={m.id} message={m} />
      ))}
    </ul>
  );
}

export function Toolbar({ tags }: { tags: string[] }) {
  return (
    <nav className="toolbar">
      <span className="brand">Acme</span>
      <div className="chips">
        {tags.map((t) => (
          <span className="chip" key={t}>
            {t}
          </span>
        ))}
      </div>
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
        <circle cx="10" cy="10" r="8" fill="currentColor" />
      </svg>
    </nav>
  );
}

export function CenteredHero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="hero">
      <h2>{title}</h2>
      <p>{subtitle}</p>
      <a className="btn" href="#go">
        Get started
      </a>
    </section>
  );
}
