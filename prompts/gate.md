# Mastery gate: {{NODE_TITLE}}

Write the check that decides whether the learner has mastered this node. Reading the lesson
isn't mastery; passing this is.

{{NODE_SPEC}}

{{BRIEF}}

The lesson they read is `{{LESSON}}`. Do **not** reuse its quiz, warmup, predict or exercise
content. Ask about new situations that need the same understanding.

- Write 4 questions, at least one per objective. Every question is transfer or application:
  a new code snippet, a new scenario, a design choice. None of them is recall.
- For interview and exam modes, make at least one question interview-hard.
- Each question has exactly 4 options (the tool that asks them allows no more). One is
  correct. Each wrong option is a **specific misconception**, labelled in plain words so the
  label can go straight into the learner model if they pick it.
- Keep each question under 300 characters. Put code in `code`, at most 10 lines.

Write JSON to `{{OUT}}`:

```json
{ "node": "{{NODE}}",
  "questions": [
    { "objective": "…", "q": "…", "code": "optional", "lang": "rust",
      "options": [
        { "text": "…", "correct": true },
        { "text": "…", "correct": false, "misconception": "believes calling an async fn starts it" } ],
      "explain": "2 to 3 sentences, shown after answering" } ] }
```

Reply with the file path only.
