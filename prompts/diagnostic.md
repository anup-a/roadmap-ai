# Diagnostic

Write a placement check for **{{TOPIC_TITLE}}** using the graph in `{{GRAPH}}`, for this
learner:

{{PROFILE}}

The aim is to find which nodes this person already knows so the path can skip them. People
rate themselves badly, so test them; don't ask.

- Write 6 to 8 questions. Cover the graph from roots toward deeper nodes, and put more
  questions at the level the profile suggests they are at.
- Each question tests exactly one node, and tests **applying** it: predict an output, spot the
  bug, choose between designs. Recall questions don't count.
- Each question has exactly 3 answer options plus a 4th, `"I don't know"`. The tool that asks
  them allows at most 4 options, and an honest "don't know" is better than a lucky guess.
- Wrong options should be misconceptions from the graph, not obvious filler.
- Keep each question under 250 characters. Put code in `code`, at most 8 lines.

Write JSON to `{{OUT}}`:

```json
{ "questions": [
  { "node": "future-trait", "q": "…", "code": "optional", "lang": "rust",
    "options": ["…", "…", "…", "I don't know"], "correct": 1 } ] }
```

`correct` is the 0-based index. Reply with the file path only.
