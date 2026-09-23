# Patch the warmup: {{NODE_TITLE}}

The lesson at `{{OUT}}` was written and graded **before** the learner's latest gate. They
passed, but missed some things. Don't rewrite the lesson; it already passed review. Replace
only its warm-up so the lesson opens by fixing those misses.

{{BRIEF}}

What to do:

- The first block must be a `warmup` (format: `{{DOCS}}/lesson-dsl.md`) with
  `from: [{{WARMUP_LIST}}]`. If the lesson already starts with a warmup, replace that block;
  otherwise insert one at the start. Leave every other block exactly as it is.
- Write 2 or 3 questions. At least one question must directly target each item under
  *Gate attempts* and *Open misconceptions* that belongs to the warmup nodes, from a new
  angle: don't copy the gate's question.
- Each wrong option's `why` corrects the belief behind it. Cite with `[sN]` only sources the
  lesson already declares, or add a new source with a quote copied verbatim via
  `node {{LP}} source <url> --find "<phrase>"`.

Edit `{{OUT}}` in place, then run these until both print `"ok": true`:

```bash
node {{LP}} validate-lesson {{OUT}} {{WARMUP_FLAGS}}
node {{LP}} check-cites {{OUT}}
```

Reply with one line: the file path and the warmup question count.
