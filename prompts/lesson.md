# Write a {{KIND}}: {{NODE_TITLE}}

You write one lesson in a personal learning path on **{{TOPIC_TITLE}}**. It will be published
as an interactive page, and a separate grader will check it before anyone sees it.

## Inputs

- Lesson format: `{{DOCS}}/lesson-dsl.md`. Read it before you start. You write JSON, never HTML.
- A good example: `{{EXAMPLE}}`
- Node spec (objectives, misconceptions, research source ids): see below
- Research, including source URLs: `{{RESEARCH}}`
- Warmup nodes to review first: {{WARMUP}}
- Grader feedback from the previous attempt, if any: {{FEEDBACK}}

{{NODE_SPEC}}

{{BRIEF}}

## What makes the lesson good

- **Written for this learner.** Build analogies from their background, and say plainly where
  the analogy stops working. If they learn examples-first, open with code, not definitions.
- **One idea per block.** Explain an idea, show it, and let them check themselves before the
  next idea. No preamble, no "in this lesson we will", no closing summary that repeats the
  lesson.
- **Misconceptions head-on.** Every known misconception for this node gets a `misconception`
  callout or a quiz distractor whose `why` corrects it. Anything under *Open misconceptions*
  or *Gate attempts* in the brief must be addressed directly.
- **Worked example, then exercise.** The worked example solves a problem fully, step by step.
  The exercise asks for something similar but not identical, doable in 5 to 10 minutes with
  only this lesson.
- **Quizzes have one defensible answer.** Distractors are plausible, and each `why` teaches
  something.
- **The warmup reviews earlier nodes** with fresh application questions, not copies of old
  ones. Put `from` on the warmup block. Skip the warmup if the list above is empty.
- **Length fits the learner's daily time.** Set `minutes` honestly.
- **Code is correct.** Use the current stable edition and API names. If you're unsure whether
  something compiles, simplify the example until you are sure.

For `remedial`: the learner read the main lesson and failed its gate. Target the items listed
under *Gate attempts* using a **different angle** from the original lesson: a new analogy,
worked example or visualisation. Keep it short, and include a quiz that tests exactly the
missed items.

## Citations: verbatim or not at all

Mark factual claims with `[sN]`. For each source:

1. Start from the research source ids in the node spec. Add others only if they're better.
2. Find the sentence that supports your claim:
   `node {{LP}} source <url> --find "<distinctive phrase>"`
3. Copy the quote **character for character** from the `matches` output. Never write a quote
   from memory: a checker fetches the page, and a paraphrase fails.

Never take quotes from a web tool that summarises pages. You need the page's own words.

## Finish line

Write the lesson to `{{OUT}}`, then run:

```bash
node {{LP}} validate-lesson {{OUT}} {{WARMUP_FLAGS}}
node {{LP}} check-cites {{OUT}}
```

Fix the lesson until both print `"ok": true`. If a source cannot be fetched at all
(`fetch_failed`), replace it with one that can. Reply with one line: the file path, the word
count, and the source ids.
