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

## Use

Installed as a skill via a symlink: `~/.claude/skills/learnpath -> this repo`. Say "teach me
async Rust" or run `/learnpath`. State lives in `~/.learnpath` (override with
`LEARNPATH_HOME`).

## Develop

Node 20+, no dependencies.

```bash
npm test                                       # node --test test/
node bin/lp.mjs validate-lesson examples/lesson-future-trait.json
node bin/lp.mjs check-cites examples/lesson-future-trait.json   # live network check
```

`SKILL.md` is the orchestration; `bin/lp.mjs` lists every command.
