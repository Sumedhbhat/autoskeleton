import { fake } from "autoskeleton";
import type { Comment, Issue, Velocity } from "./api";

const person = (i: number) => ({ name: fake.name(i), avatarUrl: fake.image(28, 28) });

export const issuePlaceholders = (count: number, offset = 0): Issue[] =>
  fake.list(count, (i) => ({
    id: fake.id(offset + i),
    title: fake.sentence(6, offset + i).slice(0, -1),
    status: "open",
    assignee: person(i),
    labels: i % 2 ? [{ name: "bug", color: "#999" }] : [],
    createdAt: fake.date(),
    estimate: 1,
  }));

export const VELOCITY_PLACEHOLDER: Velocity = { label: fake.text(26), series: Array(12).fill(1) };

export const COMMENTS_PLACEHOLDER: Comment[] = fake.list(3, (i) => ({
  id: fake.id(i),
  author: person(i),
  body: fake.sentence([10, 22, 3][i]!, i),
  createdAt: fake.date(),
}));
