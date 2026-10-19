# Skill evals

Can a smaller model, given only `skill/autoskeleton/SKILL.md`, replace an
app's hand-written loading states with autoskeleton correctly?

Each run starts from a fresh copy of a "before" app and gets the same prompt:
migrate every loading state, delete the hand-written skeletons, keep behavior
the same, verify with `tsc`. The models can't run the app. `grade.mjs` /
`grade-v2.mjs` then check the result in Chrome.

## v1: shop dashboard (`template/`)

Profile header with a hand-written skeleton that has drifted, an orders table
behind a spinner, notifications that `return null`, a product grid with a
stale `ProductCardSkeleton`, and a self-fetching activity feed with an
analytics effect.

| Run | Score | Notes |
| --- | --- | --- |
| Untouched app (baseline) | 5/12 | Even the hand-written skeletons shift layout 16–22% when data arrives. |
| Reference (by hand) | 12/12 | |
| Haiku + skill, run 1 | 12/12 | |
| Haiku + skill, run 2 | 12/12 | |
| Sonnet + skill | 12/12 | |
| Haiku, types only (no skill) | 11/12 | Duplicate React keys in placeholders: the skill's "keep ids unique" rule. |

## v2: team workspace (`template-v2/`)

Harder: nullable nested data parsed with `new Date()`/`.toFixed()`,
`markSeen()` inside a row component's effect, a canvas chart that reports
analytics, `use(promise)` with Suspense, search that refetches, and "load
more" pagination.

| Run | Score | Notes |
| --- | --- | --- |
| Untouched app (baseline) | 7/13 | |
| Reference (by hand) | 13/13 | |
| Haiku + skill, run 1 | 12/13 | Comment placeholders too short/uniform: 17% height change. |
| Haiku + skill, run 2 | 12/13 | Same: 17% (search), 26% (comments). |
| Sonnet + skill | 12/13 | Same: 17% (comments). |
| Haiku, types only (no skill) | 13/13 | Avoided the shift by replacing Suspense with a hook (the brief allowed it). |

No run broke the library API, fired a side effect with placeholder data,
showed a skeleton for already-loaded rows, or crashed. Every miss was
placeholder *length*, so the skill now tells the model to copy lengths and
variation from real sample data. Both Haiku runs also flagged that putting
`isSkeleton` in an effect's dependency array re-fires the effect when the
skeleton ends; the skill now explains when that is what you want.

Runs were graded against the library as it was at the time (v1 before
viewport culling); directories in `runs/` hold each model's actual code and
`grade.json`.

## Running

```sh
npm run build && evals/refresh-lib.sh        # pack the library into the templates
evals/new-run.sh my-run template-v2          # fresh copy in evals/runs/my-run
# ...let an agent work in evals/runs/my-run...
node evals/grade-v2.mjs evals/runs/my-run    # or grade.mjs for template/
```
