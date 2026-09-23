// Merges the partial research files written by parallel researchers into one
// research.json with stable r1…rN source ids.

const urlKey = (url) => url.replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase();
const textKey = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function uniqueBy(items, key, merge = (a) => a) {
  const seen = new Map();
  for (const item of items) {
    const k = key(item);
    seen.set(k, seen.has(k) ? merge(seen.get(k), item) : item);
  }
  return [...seen.values()];
}

export function mergeResearch({ topic, parts }) {
  const sources = uniqueBy(
    parts.flatMap((p) => p.sources ?? []).filter((s) => /^https:\/\//.test(s.url ?? '')),
    (s) => urlKey(s.url),
  ).map((s, i) => ({ id: `r${i + 1}`, ...s }));

  const concepts = uniqueBy(
    parts.flatMap((p) => p.concepts ?? []).filter((c) => c.name),
    (c) => textKey(c.name),
    (a, b) => ({ ...a, depends_on: [...new Set([...(a.depends_on ?? []), ...(b.depends_on ?? [])])] }),
  );

  const misconceptions = uniqueBy(
    parts.flatMap((p) => p.misconceptions ?? []).filter((m) => m.belief),
    (m) => textKey(m.belief),
  );

  return { version: 1, topic, sources, concepts, misconceptions };
}
