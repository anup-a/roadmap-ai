import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeResearch } from '../lib/research.mjs';

test('merges partial research, dedupes, and numbers sources', () => {
  const a = {
    focus: 'sources',
    sources: [
      { title: 'Book', url: 'https://x.dev/book/', kind: 'book', quality: 'q', concepts: ['futures'] },
      { title: 'Docs', url: 'https://x.dev/docs', kind: 'docs', quality: 'q' },
    ],
    concepts: [{ name: 'Futures', depends_on: ['traits'] }],
    misconceptions: [],
  };
  const b = {
    focus: 'concepts',
    sources: [{ title: 'Book again', url: 'https://x.dev/book', kind: 'book', quality: 'q2' }],
    concepts: [{ name: 'futures', depends_on: ['closures'] }, { name: 'Pin', depends_on: ['futures'] }],
    misconceptions: [{ belief: 'Async fn runs eagerly', correction: 'c', concept: 'futures' }],
  };
  const c = { focus: 'misconceptions', misconceptions: [{ belief: 'async fn runs eagerly.', correction: 'c2', concept: 'futures' }] };

  const r = mergeResearch({ topic: 't', parts: [a, b, c] });
  assert.equal(r.version, 1);
  assert.deepEqual(r.sources.map((s) => [s.id, s.url]), [['r1', 'https://x.dev/book/'], ['r2', 'https://x.dev/docs']]);
  assert.deepEqual(r.concepts.map((x) => [x.name, x.depends_on]), [['Futures', ['traits', 'closures']], ['Pin', ['futures']]]);
  assert.equal(r.misconceptions.length, 1);
});

test('drops non-https sources', () => {
  const r = mergeResearch({ topic: 't', parts: [{ sources: [{ title: 'x', url: 'http://x.dev' }] }] });
  assert.equal(r.sources.length, 0);
});
