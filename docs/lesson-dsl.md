# Lesson DSL

Lesson agents never write HTML. They write one JSON document in this shape, and
`lp render-lesson` turns it into a page built only from the tested widgets below.
`lp validate-lesson` enforces every rule marked **(rule)**.

## Document

```json
{
  "version": 1,
  "topic": "rust-async",
  "node": "future-trait",
  "kind": "lesson",
  "title": "What a Future actually is",
  "minutes": 12,
  "objectives": ["Explain what poll returns and who calls it"],
  "sources": [
    { "id": "s1", "title": "Asynchronous Programming in Rust: Under the Hood",
      "url": "https://rust-lang.github.io/async-book/02_execution/02_future.html",
      "quote": "exact sentence copied from the page" }
  ],
  "blocks": [ ... ]
}
```

- `kind` is `lesson` or `remedial`. Remedial lessons are micro-lessons written after a failed gate.
- `minutes` is the reading estimate, 3 to 30. **(rule)**
- `objectives`: 1 to 5 strings. **(rule)**
- `sources`: every source needs `id` matching `s<number>`, `title`, an `https` `url` and a `quote`
  of 30 to 400 characters copied verbatim from that page. `lp check-cites` fetches the url and
  confirms the quote is really there. **(rule)**

## Inline text (`md` fields)

A small, safe subset. Everything else is escaped as text.

| Syntax | Renders |
|---|---|
| `**bold**` | bold |
| `*em*` | italic |
| `` `code` `` | inline code |
| `[label](https://…)` | link, `https` only |
| `[s1]` | citation marker linked to source `s1` |
| blank line | new paragraph |
| lines starting `- ` | bullet list |

Every `[sN]` must reference a declared source. **(rule)** Every declared source must be cited
at least once. **(rule)**

## Blocks

| `type` | Fields | Purpose |
|---|---|---|
| `warmup` | `from: [nodeId]`, `questions: [Question]` | Spaced-repetition questions from earlier nodes, shown first |
| `prose` | `md` | Explanation text |
| `callout` | `tone: note \| warning \| misconception`, `title?`, `md` | A highlighted aside. `misconception` names a wrong belief and corrects it |
| `code` | `lang`, `code`, `caption?`, `highlight?: [lineNumber]`, `playground?: bool` | A code listing. `playground` adds an "Open in playground" link when the language has one (Rust only for now) |
| `stepper` | `title`, `steps: [{ label, md, code?, lang? }]` | Step-through walk of a process, one step visible at a time, 2 to 12 steps |
| `worked_example` | `title`, `setup` (md), `steps: [{ md, code?, lang? }]`, `takeaway` (md) | A fully solved problem, 1 to 8 steps |
| `predict` | `prompt` (md), `code?`, `lang?`, `answer` (md) | Learner commits to a prediction, then reveals the answer |
| `quiz` | `questions: [Question]` | Self-check with instant feedback. This is **not** the mastery gate |
| `exercise` | `prompt` (md), `hints: [md]`, `solution` (md), `solution_code?`, `lang?` | Hands-on task with progressive hints and a hidden solution |
| `clarification` | `question`, `md`, `thread?` | Appended after a learner asks about a line. Never replaces existing text |

`Question`:

```json
{ "q": "What does poll return when the value is not ready?",
  "options": [
    { "text": "Poll::Pending", "correct": true,  "why": "…" },
    { "text": "None",          "correct": false, "why": "…the misconception this distractor targets…" }
  ] }
```

- 2 to 5 options, exactly one `correct: true`, every option has a non-empty `why`. **(rule)**

## Structure rules (the deterministic half of the grader)

For `kind: "lesson"`:

- at least one `worked_example` **(rule)**
- at least one `exercise` **(rule)**
- at least one `quiz` with 2 or more questions **(rule)**
- at least 2 sources **(rule)**
- 350 to 2500 words of explanatory text across `md` fields **(rule)**
- the first block is a `warmup` when the learner has earlier mastered nodes due for review (the
  orchestrator passes these in; the validator checks it when `--warmup` ids are given) **(rule)**

For `kind: "remedial"`: at least one `quiz` and at least one `callout` with tone
`misconception`; 1 or more sources; 150 to 1200 words.

The LLM grader (`prompts/grader.md`) handles what code cannot: whether each claim is true,
whether each quote supports the sentence citing it, and whether the lesson fits the learner.
