import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToText, quoteMatch, checkCitations, snippets } from '../lib/citations.mjs';

test('snippets returns raw text around each case-insensitive match', () => {
  const text = 'alpha Future beta gamma future delta';
  assert.deepEqual(snippets(text, 'FUTURE', { radius: 2 }), ['a Future b', 'a future d']);
  assert.deepEqual(snippets(text, 'missing'), []);
});

const page = `<html><head><script>var x = "Futures alone are inert";</script><style>p{}</style></head>
<body><p>Futures alone are <em>inert</em>;
they must be actively   polled to make progress, meaning&nbsp;that each time&hellip;</p></body></html>`;

test('htmlToText drops script and style, decodes entities, collapses whitespace', () => {
  const text = htmlToText(page);
  assert.doesNotMatch(text, /var x/);
  assert.match(text, /Futures alone are inert; they must be actively polled to make progress, meaning that each time…/);
});

test('exact quote across inline tags is found', () => {
  const r = quoteMatch('Futures alone are inert; they must be actively polled to make progress', htmlToText(page));
  assert.equal(r.found, true);
  assert.equal(r.score, 1);
});

test('curly quotes and dashes normalise', () => {
  const r = quoteMatch('it’s a “future” — really', "it's a \"future\" - really");
  assert.equal(r.found, true);
});

test('a lightly altered quote scores high but a fabricated one fails', () => {
  const text = htmlToText(page);
  const close = quoteMatch('Futures alone are inert; they must be actively polled to make progress, meaning each time', text);
  assert.ok(close.score >= 0.9, `score=${close.score}`);
  const fake = quoteMatch('Futures run eagerly on a background thread as soon as they are created', text);
  assert.equal(fake.found, false);
  assert.ok(fake.score < 0.6);
});

test('checkCitations reports per source using an injected fetcher', async () => {
  const lesson = {
    sources: [
      { id: 's1', url: 'https://a.dev', quote: 'Futures alone are inert; they must be actively polled' },
      { id: 's2', url: 'https://b.dev', quote: 'this sentence is not on the page at all, anywhere' },
      { id: 's3', url: 'https://c.dev', quote: 'fetch will fail for this one completely' },
    ],
  };
  const fetcher = async (url) => {
    if (url === 'https://c.dev') throw new Error('HTTP 404');
    return page;
  };
  const report = await checkCitations(lesson, { fetcher });
  assert.equal(report.ok, false);
  assert.deepEqual(report.results.map((r) => [r.id, r.status]), [
    ['s1', 'verified'],
    ['s2', 'not_found'],
    ['s3', 'fetch_failed'],
  ]);
  assert.match(report.results[2].error, /404/);
});
