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
| `exercise` | `prompt` (md), `hints: [md]`, `solution` (md), `solution_code?`, `lang?`, `starter?`, `tests?` | Hands-on task with progressive hints and a hidden solution. With `starter` + `tests` it becomes a runnable exercise (below) |
| `clarification` | `question`, `md`, `thread?` | Appended after a learner asks about a line. Never replaces existing text |

### Runnable exercises (TypeScript / JavaScript)

Give an `exercise` a `starter` and `tests` and the page gets an editor, a **Run tests** button
and a pass/fail line per test, so the learner never leaves the lesson. The code runs in a Web
Worker that is stopped after 5 seconds; TypeScript types are stripped in the browser first.

```json
{ "type": "exercise", "lang": "ts",
  "prompt": "Implement `candidates()` so the tests pass.",
  "starter": "function candidates(logits: number[]): number[] {\n  // TODO\n  return [];\n}",
  "tests": "test(\"keeps the top token\", () => {\n  assertEqual(candidates([2, 1])[0], 0);\n});",
  "solution_code": "function candidates(logits: number[]): number[] { … }",
  "solution": "Sort by probability, then …",
  "hints": ["…"] }
```

- `lang` is `ts` or `js`, and `starter`, `tests` and `solution_code` are all required. **(rule)**
- No `import`, `export` or `require`: only language built-ins that browsers and Node share
  (no DOM, `fs`, `fetch` or npm packages). **(rule)**
- TypeScript must be *erasable*: types, interfaces and `as` casts are fine; `enum`,
  `namespace` and constructor parameter properties are not.
- `lp validate-lesson` runs `solution_code` + `tests` in Node and fails unless every test
  passes, and fails if `starter` + `tests` already pass. **(rule)**
- Randomness must be seeded (write a small PRNG such as mulberry32 into the starter) so a
  correct answer passes every time.

`tests` runs after the learner's code, in the same scope, and can use:

| Helper | Checks |
|---|---|
| `test(name, fn)` | registers a test; `fn` may be `async` |
| `assert(cond, msg?)` | `cond` is truthy |
| `assertEqual(actual, expected, msg?)` | deep equality (arrays, plain objects, `Map`, `Set`) |
| `assertClose(actual, expected, tol = 1e-6, msg?)` | a number, or an array of numbers, within `tol` |
| `assertThrows(fn, msg?)` | `fn()` throws |

Name each test after the behaviour it checks ("top-p keeps the smallest set over p"): the name
is all the learner sees when it passes. A failure shows the assertion message, so pass a `msg`
that says what was expected in the lesson's terms. `console.log` output is shown too.

Other languages keep the hints + solution flow; Rust `code` blocks can still link to the Rust
Playground with `playground: true`.

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
- at least one `exercise` **(rule)**; when the lesson's code is TypeScript or JavaScript, make
  it runnable
- at least one `quiz` with 2 or more questions **(rule)**
- at least 2 sources **(rule)**
- 350 to 2500 words of explanatory text across `md` fields **(rule)**
- the first block is a `warmup` when the learner has earlier mastered nodes due for review (the
  orchestrator passes these in; the validator checks it when `--warmup` ids are given) **(rule)**

For `kind: "remedial"`: at least one `quiz` and at least one `callout` with tone
`misconception`; 1 or more sources; 150 to 1200 words.

The LLM grader (`prompts/grader.md`) handles what code cannot: whether each claim is true,
whether each quote supports the sentence citing it, and whether the lesson fits the learner.
