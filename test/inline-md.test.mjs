import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderInline, renderSpan, escapeHtml } from '../lib/inline-md.mjs';

const sources = [
  { id: 's1', title: 'Book', url: 'https://example.com/a', quote: 'He said "poll" & <left>' },
  { id: 's2', title: 'Docs', url: 'https://example.com/b', quote: 'Futures alone are inert' },
];

test('escapeHtml escapes the five HTML-significant characters', () => {
  assert.equal(escapeHtml(`<a href="x" title='y'>&</a>`),
    '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(42), '42');
});

test('empty input renders nothing', () => {
  assert.equal(renderInline(''), '');
  assert.equal(renderInline(undefined), '');
  assert.equal(renderInline('  \n\n  '), '');
});

test('plain text becomes one paragraph; blank lines split paragraphs', () => {
  assert.equal(renderInline('hello world'), '<p>hello world</p>');
  assert.equal(renderInline('one\n\ntwo'), '<p>one</p>\n<p>two</p>');
  assert.equal(renderInline('one\n  \n\ntwo'), '<p>one</p>\n<p>two</p>');
});

test('a single newline stays inside the paragraph', () => {
  assert.equal(renderInline('line a\nline b'), '<p>line a\nline b</p>');
});

test('consecutive "- " lines become a bullet list', () => {
  assert.equal(renderInline('- a\n- b'), '<ul><li>a</li><li>b</li></ul>');
  assert.equal(renderInline('Intro:\n- **a**\n- b\nafter'),
    '<p>Intro:</p>\n<ul><li><strong>a</strong></li><li>b</li></ul>\n<p>after</p>');
});

test('"-" without a following space is not a list', () => {
  assert.equal(renderInline('-5 degrees'), '<p>-5 degrees</p>');
});

test('bold, em and code', () => {
  assert.equal(renderSpan('**b** and *e* and `c`'),
    '<strong>b</strong> and <em>e</em> and <code>c</code>');
});

test('em nested in bold and bold nested in em', () => {
  assert.equal(renderSpan('**bold *em* x**'), '<strong>bold <em>em</em> x</strong>');
  assert.equal(renderSpan('*em **bold** x*'), '<em>em <strong>bold</strong> x</em>');
});

test('unclosed markers stay literal', () => {
  assert.equal(renderSpan('**never closed'), '**never closed');
  assert.equal(renderSpan('2 * 3 = 6'), '2 * 3 = 6');
  assert.equal(renderSpan('a `tick'), 'a `tick');
});

test('code spans interpret nothing inside', () => {
  const html = renderSpan('`**x** [s1] <b> [a](https://x.com)`', { sources });
  assert.equal(html, '<code>**x** [s1] &lt;b&gt; [a](https://x.com)</code>');
});

test('code span inside bold is not broken by a * inside the code', () => {
  assert.equal(renderSpan('**use `a*b` here**'), '<strong>use <code>a*b</code> here</strong>');
});

test('raw HTML is escaped, never passed through', () => {
  const html = renderInline('<script>alert(1)</script> <img src=x onerror=alert(1)>');
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('https links render with rel and target', () => {
  assert.equal(renderSpan('[the **book**](https://rust-lang.github.io/async-book/)'),
    '<a href="https://rust-lang.github.io/async-book/" rel="noopener" target="_blank">the <strong>book</strong></a>');
});

test('javascript:, data:, http: and relative links are plain escaped text', () => {
  for (const url of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,<b>x</b>',
    'http://example.com', '/etc/passwd', 'javascript:https://x.com']) {
    const html = renderSpan(`[click](${url})`);
    assert.ok(!html.includes('<a'), `${url} must not become a link: ${html}`);
    assert.ok(html.startsWith('[click]('), html);
    assert.ok(!html.includes('<b>'));
  }
});

test('quotes in a link url cannot inject attributes', () => {
  const html = renderSpan('[x](https://a.com/"onmouseover="alert(1))');
  assert.ok(!html.includes('"onmouseover'), html);
  // Exactly the three attributes we emit, nothing smuggled in.
  const tag = html.match(/<a [^>]*>/);
  if (tag) assert.deepEqual([...tag[0].matchAll(/\s([a-z]+)=/g)].map((m) => m[1]), ['href', 'rel', 'target']);
});

test('quotes and angle brackets in a link label are escaped', () => {
  const html = renderSpan('[a "b" <i>](https://x.com)');
  assert.equal(html, '<a href="https://x.com" rel="noopener" target="_blank">a &quot;b&quot; &lt;i&gt;</a>');
});

test('known citation renders a numbered superscript with the escaped quote as title', () => {
  const html = renderSpan('inert [s2].', { sources });
  assert.equal(html,
    'inert <sup class="cite"><a href="#src-s2" title="Futures alone are inert">2</a></sup>.');
  const withQuote = renderSpan('x [s1]', { sources });
  assert.ok(withQuote.includes('title="He said &quot;poll&quot; &amp; &lt;left&gt;"'), withQuote);
});

test('unknown citation stays as escaped text', () => {
  assert.equal(renderSpan('see [s9]', { sources }), 'see [s9]');
  assert.equal(renderSpan('see [s1]'), 'see [s1]');
});

test('citation inside bold still links', () => {
  assert.equal(renderSpan('**inert [s2]**', { sources }),
    '<strong>inert <sup class="cite"><a href="#src-s2" title="Futures alone are inert">2</a></sup></strong>');
});

test('ampersands and entities in text are escaped once', () => {
  assert.equal(renderSpan('a & b &amp; c'), 'a &amp; b &amp;amp; c');
});

test('renderSpan flattens newlines and never emits block tags', () => {
  const html = renderSpan('a\n\n- b');
  assert.ok(!html.includes('<p>') && !html.includes('<ul>'));
});
