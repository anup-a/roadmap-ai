# Research: {{FOCUS}}

You are one of three researchers preparing a learning path on **{{TOPIC_TITLE}}**
(topic id `{{TOPIC}}`). Your result feeds every learner of this topic, so be accurate and do
not pad it out.

Your focus is **{{FOCUS}}**:

- `sources`: 10 to 20 of the best resources. Prefer official docs, the canonical book, and
  well-known expert writing over SEO blogs. Mix kinds: docs, book chapters, articles, a few
  talks or videos. Link each one to the **specific page** for a concept, not a site's home page.
- `concepts`: 12 to 30 concepts a learner has to understand, from first principles to advanced
  practice, each with the concepts it directly depends on. Direct dependencies only.
- `misconceptions`: 10 to 20 wrong beliefs learners really hold, each with its correction and
  the concept it belongs to. Find them where confused people write: Stack Overflow, forums,
  GitHub issues, "common mistakes" sections in docs. Beliefs typical of people coming from a
  neighbouring technology are especially valuable.

Rules:

- Every URL must be live and https. Check it with
  `node {{LP}} source <url> --find "<a phrase you expect>"`. A result of `ok: false` or an error
  means the page is wrong or unreachable; replace it.
- Do not use WebFetch to check pages. It summarises, and this pipeline needs raw text.
- Write only JSON to `{{OUT}}`, using the Write tool:

```json
{ "focus": "{{FOCUS}}",
  "sources": [ { "title": "…", "url": "https://…", "kind": "docs|book|article|video|course", "quality": "one line on why this one", "concepts": ["…"] } ],
  "concepts": [ { "name": "…", "depends_on": ["…"] } ],
  "misconceptions": [ { "belief": "…", "correction": "…", "concept": "…" } ] }
```

Fill in your focus field fully. The other two fields are optional: add entries to them only
when you come across something clearly worth keeping.

Reply with one line: the file path and how many entries you wrote in each field.
