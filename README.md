# learnpath

Personal adaptive learning paths, as a Claude Code skill. It plans the whole path up front and
writes lessons one at a time, just before they're needed.

```
research (3 agents, cached per topic) → skill graph → interview → diagnostic
  → live skill map → [ write lesson → validate → verify quotes → grade → publish ] → mastery gate
                          ↑                                                            │
                          └──── remedial + regenerate stale prefetch on a miss ────────┘
```

- **Lessons are JSON, not HTML.** Agents write the DSL in `docs/lesson-dsl.md`, and
  `lib/render-lesson.mjs` builds the page from tested widgets: quiz, stepper, predict, worked
  example, exercise, callouts, code with a Rust Playground link.
- **Quotes are verified, not trusted.** `lp check-cites` fetches every cited page and checks
  that the quote is really on it. The LLM grader then judges whether each quote supports its
  claim.
- **Adaptation is explicit.** `learner.json` records mastery per node, gate attempts,
  misconceptions and questions. A failed gate triggers a remedial micro-lesson and marks
  lessons written ahead of time as stale so they're rewritten.
- **Research is paid for once per topic.** Only the diagnostic, the lessons and the learner
  model are per learner.
- **Pages publish to byagent.** Line comments on a lesson become questions the skill answers in
  the thread and records in the learner model.

## Install

It's a [Claude Code](https://claude.com/claude-code) skill. Clone it into your skills folder,
then say "teach me async Rust" or run `/learnpath`:

```bash
git clone https://github.com/anup-a/roadmap-ai ~/.claude/skills/learnpath
```

Needs Node 20+ and `curl`. Pages are published with [byagent](https://byagent.dev)
(`npx byagent login`). State lives in `~/.learnpath` (override with `LEARNPATH_HOME`).

## See it

A dogfood run on async Rust, with a simulated TypeScript developer as the learner:

- [Skill map](https://byagent.dev/a/k2PhXJlzTVm1/): 20 nodes, updated as the learner progresses
- [Lesson: join!](https://byagent.dev/a/z9dobDiDFY9r/): warmup rewritten after a gate miss, plus a
  clarification added from a comment on the page
- [Remedial lesson](https://byagent.dev/a/N47iG3fJ6mW2/) written after a failed gate
- [learnpath vs plain chat](https://byagent.dev/a/RXgcRdQxy8K3/): same lesson, same grader.
  Plain chat was as accurate on the first try; the pipeline's edge is adapting to the learner,
  at about 8x the cost per lesson

## Develop

Node 20+, no dependencies.

```bash
npm test                                       # node --test test/
node bin/lp.mjs validate-lesson examples/lesson-future-trait.json
node bin/lp.mjs check-cites examples/lesson-future-trait.json   # live network check
```

`SKILL.md` is the orchestration; `bin/lp.mjs` lists every command.
