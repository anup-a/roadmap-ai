# Data model

Everything lives under `$LEARNPATH_HOME` (default `~/.learnpath`).

```
topics/<topic>/research.json   shared by every learner of this topic (cached)
topics/<topic>/graph.json      the base skill graph for this topic (cached)
runs/<run>/learner.json        one learner working through one topic
runs/<run>/lessons/<node>.json lesson DSL documents, see lesson-dsl.md
runs/<run>/site/map/           rendered skill map, published to byagent
runs/<run>/site/<node>/        rendered lesson, published to byagent
```

Research and the base graph depend on the topic, not the person, so they are paid for once.
Only the diagnostic pruning, the lessons and the learner model are per learner.

## graph.json

```json
{
  "version": 1,
  "topic": "rust-async",
  "title": "Async Rust",
  "nodes": [
    {
      "id": "future-trait",
      "title": "The Future trait",
      "summary": "One sentence on what this node covers.",
      "objectives": ["Explain what poll returns and who calls it"],
      "prereqs": ["ownership-basics"],
      "sources": ["r3", "r7"],
      "misconceptions": ["Calling an async fn starts running it"]
    }
  ]
}
```

- `id` is kebab-case and unique. `prereqs` reference other node ids. The graph must be acyclic.
- `sources` reference ids in `research.json`.
- 6 to 30 nodes.

## research.json

```json
{
  "version": 1,
  "topic": "rust-async",
  "sources": [ { "id": "r1", "title": "…", "url": "https://…", "kind": "docs|book|article|video|course", "quality": "why this one is good" } ],
  "concepts": [ { "name": "…", "depends_on": ["…"] } ],
  "misconceptions": [ { "belief": "…", "correction": "…", "concept": "…" } ]
}
```

## learner.json

```json
{
  "version": 1,
  "topic": "rust-async",
  "run": "rust-async-anup",
  "profile": {
    "goal": "Build a Tokio web service",
    "mode": "build",
    "background": "TypeScript, some Rust ownership",
    "style": "examples first",
    "deadline": null,
    "minutes_per_day": 30
  },
  "nodes": {
    "future-trait": {
      "state": "in_progress",
      "mastery": 0.0,
      "source": null,
      "attempts": [ { "at": "2026-09-23T10:00:00Z", "score": 0.4, "missed": ["…"] } ]
    }
  },
  "misconceptions": [ { "node": "future-trait", "text": "…", "at": "…", "resolved": false } ],
  "questions": [ { "node": "future-trait", "text": "…", "answer": "…", "at": "…" } ],
  "lessons": {
    "future-trait": { "kind": "lesson", "artifact": "abc123", "url": "https://byagent.dev/a/abc123/", "stale": false, "written_after": 2 }
  },
  "map": { "artifact": "def456", "url": "https://byagent.dev/a/def456/" }
}
```

- `state` is one of `locked`, `ready`, `in_progress`, `mastered`. `ready` and `locked` are
  derived: a node is ready when every prereq is mastered.
- `source` records how a node became mastered: `diagnostic` or `gate`.
- `mode` is `interview`, `build`, `exam` or `curious`. It sets the gate pass mark.
- `written_after` is the number of gate attempts recorded when the lesson was written. A lesson
  written before the latest gate result is marked `stale` and regenerated, so it can adapt.
- Remedial lessons are keyed `<node>~remedial-<n>`.
