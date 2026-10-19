import { fake } from "autoskeleton";
import type { Comment, Issue, Person, Velocity } from "./api";

const PERSON: Person = { name: fake.name(), avatarUrl: fake.image(64, 64) };

export const ISSUES_PLACEHOLDER: Issue[] = fake.list(5, (i) => ({
  id: fake.id(i),
  title: fake.sentence(6, i),
  status: "open" as const,
  assignee: PERSON,
  labels: [{ name: "design", color: "#9333ea" }],
  createdAt: "2026-09-01T00:00:00.000Z",
  estimate: 1.5,
}));

export const SEARCH_PLACEHOLDER: Issue[] = ISSUES_PLACEHOLDER.slice(0, 4);

export const VELOCITY_PLACEHOLDER: Velocity = {
  label: "Points completed per week",
  series: [12, 18, 9, 22, 17, 25, 19, 28, 24, 30, 21, 27],
};

export const COMMENTS_PLACEHOLDER: Comment[] = fake.list(3, (i) => ({
  id: fake.id(i),
  author: PERSON,
  body: fake.sentence(i === 1 ? 20 : 10, i),
  createdAt: "2026-10-01T10:00:00Z",
}));
