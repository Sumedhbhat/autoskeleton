// Fake backend. ?hold=1 keeps every request pending forever; ?delay=<ms>
// sets latency (default 900ms).
const params = new URLSearchParams(location.search);
const HOLD = params.get("hold") === "1";
const DELAY = Number(params.get("delay") ?? 900);

function respond<T>(value: T): Promise<T> {
  if (HOLD) return new Promise<T>(() => {});
  return new Promise((r) => setTimeout(() => r(value), DELAY));
}

export interface Person {
  name: string;
  avatarUrl: string;
}

export interface Label {
  name: string;
  color: string;
}

export interface Issue {
  id: string;
  title: string;
  status: "open" | "closed";
  assignee: Person | null;
  labels: Label[];
  createdAt: string; // ISO date
  estimate: number; // days
}

export interface IssuePage {
  items: Issue[];
  nextPage: number | null;
}

export interface Velocity {
  label: string;
  series: number[];
}

export interface Comment {
  id: string;
  author: Person;
  body: string;
  createdAt: string;
}

const LABELS: Label[] = [
  { name: "bug", color: "#dc2626" },
  { name: "api", color: "#2563eb" },
  { name: "design", color: "#9333ea" },
  { name: "perf", color: "#ea580c" },
];
const PEOPLE: Person[] = [
  { name: "Rin Okada", avatarUrl: "https://i.pravatar.cc/64?img=12" },
  { name: "Theo Grant", avatarUrl: "https://i.pravatar.cc/64?img=33" },
];
const TITLES = [
  "API returns 500 when filter list is empty",
  "Redesign onboarding checklist",
  "Slow dashboard load for large teams",
  "Bug: avatar upload ignores EXIF rotation",
  "Add rate limit headers to public API",
  "Dark mode contrast on secondary buttons",
  "Bug: duplicate notifications after reconnect",
  "Paginate audit log export",
  "Perf: memoize permission checks",
  "API: support cursor pagination on /issues",
];
const ALL_ISSUES: Issue[] = TITLES.map((title, i) => ({
  id: `ISS-${101 + i}`,
  title,
  status: i % 4 === 3 ? "closed" : "open",
  assignee: i % 3 === 2 ? null : PEOPLE[i % 2]!,
  labels: LABELS.filter((l) => title.toLowerCase().includes(l.name) || (i % 3 === 0 && l.name === "design")),
  createdAt: new Date(Date.UTC(2026, 8, 1 + i * 3)).toISOString(),
  estimate: 0.5 + (i % 5),
}));

const PAGE_SIZE = 5;

export const api = {
  issues: (page: number) =>
    respond<IssuePage>({
      items: ALL_ISSUES.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
      nextPage: (page + 1) * PAGE_SIZE < ALL_ISSUES.length ? page + 1 : null,
    }),
  search: (q: string) => respond<Issue[]>(ALL_ISSUES.filter((i) => i.title.toLowerCase().includes(q.toLowerCase())).slice(0, 4)),
  velocity: () =>
    respond<Velocity>({ label: "Points completed per week", series: [12, 18, 9, 22, 17, 25, 19, 28, 24, 30, 21, 27] }),
  comments: () =>
    respond<Comment[]>([
      { id: "c1", author: PEOPLE[0]!, body: "I can reproduce this on staging with an empty filter.", createdAt: "2026-10-01T10:00:00Z" },
      { id: "c2", author: PEOPLE[1]!, body: "Root cause is the query builder skipping the WHERE clause. Fix incoming, should land before the release cut on Thursday.", createdAt: "2026-10-02T15:30:00Z" },
      { id: "c3", author: PEOPLE[0]!, body: "Thanks! Verified.", createdAt: "2026-10-03T09:12:00Z" },
    ]),
};

// Side-effect sinks the grader inspects.
declare global {
  interface Window {
    __analytics: { event: string; payload: unknown }[];
    __seen: string[];
  }
}
window.__analytics = [];
window.__seen = [];
export function track(event: string, payload: unknown) {
  window.__analytics.push({ event, payload });
}
/** Marks an issue as seen by the current user (server call in real life). */
export function markSeen(id: string) {
  window.__seen.push(id);
}
