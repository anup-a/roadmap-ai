# Build the skill graph

Build the base skill graph for **{{TOPIC_TITLE}}** from the research in `{{RESEARCH}}`.
It is shared by every learner of this topic. Personalisation happens later, when a diagnostic
removes the nodes a learner already knows.

Read `{{DOCS}}/data-model.md` for the exact `graph.json` shape.

How to cut nodes:

- One node is one lesson: 10 to 20 minutes of reading plus an exercise. Split a concept that
  needs more time than that; merge concepts too small to stand alone.
- Aim for 10 to 20 nodes; the validator allows 6 to 30. Start from what a competent programmer
  new to this topic already knows, and do not teach general programming.
- `prereqs` lists **direct** prerequisites only. If A → B → C, C lists B, not A. Keep the graph
  shallow where you honestly can, so learners have parallel choices.
- `objectives` are 1 to 4 observable abilities with verbs a gate question can test: *predict*,
  *explain why*, *fix*, *choose between*, *write*. Avoid "understand".
- `misconceptions`: copy the relevant beliefs from research into the node they belong to.
- `sources`: the research ids (`r1`…) that cover this node, best first, 1 to 4 of them.
- Order `nodes` so that reading them top to bottom is a sensible default path.

Research ids: number `research.sources` as `r1`, `r2`, … in the order they appear in the file.
The orchestrator has already done this in `{{RESEARCH}}`.

Write the graph to `{{OUT}}` with the Write tool, then run
`node {{LP}} validate-graph {{OUT}} --research {{RESEARCH}}` and fix the graph until `ok` is
true. Reply with the node count and the ids in order.
