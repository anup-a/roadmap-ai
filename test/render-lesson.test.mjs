import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderLesson } from '../lib/render-lesson.mjs';

const fixture = JSON.parse(readFileSync(new URL('../examples/lesson-future-trait.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(fixture);
// Count elements whose class attribute contains `cls` as a whole word.
const countClass = (html, cls) =>
  (html.match(new RegExp(`class="(?:[^"]*\\s)?${cls}(?:\\s[^"]*)?"`, 'g')) || []).length;

test('renders the fixture as a complete HTML document', () => {
  const html = renderLesson(fixture);
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('</html>'));
  assert.ok(html.includes('What a Future actually is'));
  assert.ok(html.includes('12 min'));
});

test('contains a widget for every block type in the fixture', () => {
  const html = renderLesson(fixture);
  for (const type of new Set(fixture.blocks.map((b) => b.type))) {
    assert.equal(countClass(html, `blk-${type}`), fixture.blocks.filter((b) => b.type === type).length, `blk-${type}`);
  }
  for (const cls of ['stepper', 'step', 'predict', 'q', 'opt', 'hint', 'solution', 'answer',
    'worked', 'quiz', 'exercise', 'callout-misconception']) {
    assert.ok(countClass(html, cls) > 0, `missing class ${cls}`);
  }
});

test('renders all stepper steps and hints in HTML so the page works without JS', () => {
  const html = renderLesson(fixture);
  assert.equal(countClass(html, 'step'), 5);
  assert.equal(countClass(html, 'hint'), 2);
  assert.ok(html.includes('<html lang="en" class="no-js">'));
});

test('predict has a textarea and a reveal button', () => {
  const html = renderLesson(fixture);
  assert.ok(/<textarea id="b\d+-guess"/.test(html));
  assert.ok(html.includes('data-act="reveal"'));
});

test('source list has anchors for every declared source and citations link to them', () => {
  const html = renderLesson(fixture);
  assert.ok(html.includes('id="src-s1"'));
  assert.ok(html.includes('id="src-s2"'));
  assert.ok(html.includes('href="#src-s2"'));
  for (const s of fixture.sources) assert.ok(html.includes(`<blockquote>${s.quote}</blockquote>`), s.id);
});

test('rust playground link carries the encoded code', () => {
  const html = renderLesson(fixture);
  const code = fixture.blocks.find((b) => b.type === 'code').code;
  const url = `https://play.rust-lang.org/?version=stable&mode=debug&edition=2021&code=${encodeURIComponent(code)}`;
  assert.ok(html.includes(url.replace(/&/g, '&amp;')), 'playground url missing');
});

test('no playground link when playground is not set or the language has none', () => {
  const l = clone();
  l.blocks = l.blocks.filter((b) => b.type !== 'code');
  l.blocks.push({ type: 'code', lang: 'python', code: 'print(1)', playground: true });
  assert.ok(!renderLesson(l).includes('play.rust-lang.org'));
});

test('highlighted code lines are marked', () => {
  const html = renderLesson(fixture);
  assert.equal((html.match(/class="ln hl"/g) || []).length, 1);
  const listing = html.slice(html.indexOf('blk-code'));
  const lines = listing.slice(0, listing.indexOf('</code>')).match(/<span class="ln[ "]/g);
  assert.equal(lines.length, 9);
  assert.ok(/<span class="ln hl">[^\n]*poll/.test(html), 'line 3 (fn poll) should be the highlighted one');
});

test('code highlighting escapes code and marks keywords, strings and comments', async () => {
  const { highlightLines } = await import('../lib/render-lesson.mjs');
  const lines = highlightLines('// a <b>\nlet s = "x</script>";', 'rust');
  assert.equal(lines.length, 2);
  assert.equal(lines[0], '<span class="t-com">// a &lt;b&gt;</span>');
  assert.ok(lines[1].includes('<span class="t-kw">let</span>'));
  assert.ok(lines[1].includes('<span class="t-str">&quot;x&lt;/script&gt;&quot;</span>'));
  assert.deepEqual(highlightLines('a <b>\n', 'brainfuck'), ['a &lt;b&gt;', '']);
  const block = highlightLines('/* one\ntwo */ x', 'ts');
  assert.deepEqual(block, ['<span class="t-com">/* one</span>', '<span class="t-com">two */</span> x']);
});

test('rejects unknown block types by name', () => {
  const l = clone();
  l.blocks.push({ type: 'carousel', items: [] });
  assert.throws(() => renderLesson(l), /carousel/);
});

test('remedial lessons get a badge; normal lessons do not', () => {
  assert.ok(!renderLesson(fixture).includes('class="badge-remedial"'));
  const l = clone();
  l.kind = 'remedial';
  assert.ok(renderLesson(l).includes('class="badge-remedial"'));
});

test('no external scripts', () => {
  const html = renderLesson(fixture, { mapUrl: '../map/' });
  assert.ok(!/<script[^>]*\ssrc=/i.test(html));
});

test('malicious lesson text is escaped everywhere', () => {
  const evil = '<script>alert("x")</script><img src=x onerror=alert(1)>';
  const l = clone();
  l.title = evil;
  l.objectives = [evil];
  l.blocks.unshift({ type: 'prose', md: evil });
  l.blocks.push({ type: 'callout', tone: 'note', title: evil, md: evil });
  l.blocks.push({ type: 'clarification', question: evil, md: evil, thread: '"><script>alert(2)</script>' });
  l.blocks.push({ type: 'code', lang: 'rust', code: evil, caption: evil });
  l.blocks.push({ type: 'quiz', questions: [{ q: evil, options: [
    { text: evil, correct: true, why: evil }, { text: 'b', correct: false, why: evil }] }] });
  l.sources[0].quote = evil;
  l.sources[0].title = evil;
  const html = renderLesson(l);
  assert.ok(!html.includes('<script>alert'), 'unescaped script tag');
  assert.ok(!html.includes('<img'), 'unescaped img tag');
  assert.ok(html.includes('&lt;script&gt;alert'));
});

test('non-https source urls do not become links', () => {
  const l = clone();
  l.sources[0].url = 'javascript:alert(1)';
  assert.ok(!renderLesson(l).includes('javascript:'));
});

test('header link back to the map and prev/next nav when given', () => {
  const html = renderLesson(fixture, { mapUrl: '../map/', prevUrl: '../ownership-basics/', nextUrl: '../pin/' });
  assert.ok(html.includes('href="../map/"'));
  assert.ok(html.includes('href="../ownership-basics/"'));
  assert.ok(html.includes('href="../pin/"'));
  const bare = renderLesson(fixture);
  assert.ok(!bare.includes('class="lesson-nav"'));
});

test('unsafe nav urls are dropped', () => {
  const html = renderLesson(fixture, { mapUrl: 'javascript:alert(1)' });
  assert.ok(!html.includes('javascript:'));
});

test('clarification shows the learner question as a distinct note', () => {
  const l = clone();
  l.blocks.push({ type: 'clarification', question: 'Why does poll take &mut self?', md: 'Because it **mutates** state.' });
  const html = renderLesson(l);
  assert.ok(html.includes('blk-clarification'));
  assert.ok(html.includes('Why does poll take &amp;mut self?'));
  assert.ok(html.includes('<strong>mutates</strong>'));
});

test('quiz options are buttons with correctness data and every why is rendered', () => {
  const html = renderLesson(fixture);
  assert.equal((html.match(/<button type="button" class="opt"/g) || []).length, 2 + 3 + 3);
  assert.equal(countClass(html, 'why'), 2 + 3 + 3);
  assert.ok(html.includes('data-correct="true"'));
});

test('byagent credit and relative-only asset references', () => {
  const html = renderLesson(fixture);
  assert.ok(html.includes('href="https://byagent.dev"'));
  assert.ok(!/(?:src|href)="\/(?!\/)/.test(html), 'leading-slash asset path');
});
