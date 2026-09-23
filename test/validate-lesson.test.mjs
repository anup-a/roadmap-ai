import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateLesson } from '../lib/validate-lesson.mjs';
import { extractCitations, wordCount } from '../lib/text.mjs';

const fixture = () =>
  JSON.parse(readFileSync(new URL('../examples/lesson-future-trait.json', import.meta.url), 'utf8'));

const withBlocks = (lesson, blocks) => ({ ...lesson, blocks });
const errorsMatching = (result, re) => result.errors.filter((e) => re.test(e));

test('the example lesson passes', () => {
  const result = validateLesson(fixture());
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  assert.ok(result.stats.words >= 350, `words=${result.stats.words}`);
});

test('extractCitations ignores markers inside code spans', () => {
  assert.deepEqual([...extractCitations('a [s1] b `x[s2]` [s3]')].sort(), ['s1', 's3']);
});

test('wordCount strips markup', () => {
  assert.equal(wordCount('**one** `two` [three](https://x.dev) [s1]'), 3);
});

test('unknown block type is rejected', () => {
  const lesson = fixture();
  const result = validateLesson(withBlocks(lesson, [...lesson.blocks, { type: 'html', html: '<b>' }]));
  assert.equal(result.ok, false);
  assert.equal(errorsMatching(result, /unknown block type "html"/).length, 1);
});

test('citation to an undeclared source is rejected', () => {
  const lesson = fixture();
  const blocks = [...lesson.blocks, { type: 'prose', md: 'Claim [s9].' }];
  assert.equal(errorsMatching(validateLesson(withBlocks(lesson, blocks)), /\[s9\].*not declared/).length, 1);
});

test('declared source that is never cited is rejected', () => {
  const lesson = fixture();
  const sources = [...lesson.sources, { ...lesson.sources[0], id: 's3' }];
  assert.equal(errorsMatching(validateLesson({ ...lesson, sources }), /s3.*never cited/).length, 1);
});

test('quiz question needs exactly one correct option and a why on each', () => {
  const lesson = fixture();
  const bad = {
    type: 'quiz',
    questions: [
      { q: 'x', options: [{ text: 'a', correct: true, why: 'y' }, { text: 'b', correct: true, why: 'y' }] },
      { q: 'y', options: [{ text: 'a', correct: true, why: '' }, { text: 'b', correct: false, why: 'n' }] },
    ],
  };
  const result = validateLesson(withBlocks(lesson, [...lesson.blocks, bad]));
  assert.equal(errorsMatching(result, /exactly one correct/).length, 1);
  assert.equal(errorsMatching(result, /why/).length, 1);
});

test('a lesson needs a worked example, an exercise and a 2-question quiz', () => {
  const lesson = fixture();
  const blocks = lesson.blocks.filter((b) => !['worked_example', 'exercise', 'quiz'].includes(b.type));
  const result = validateLesson(withBlocks(lesson, blocks));
  assert.ok(errorsMatching(result, /worked_example/).length === 1);
  assert.ok(errorsMatching(result, /exercise/).length === 1);
  assert.ok(errorsMatching(result, /quiz/).length === 1);
});

test('too short a lesson fails the depth rule', () => {
  const q = { q: 'q', options: [{ text: 'a', correct: true, why: 'y' }, { text: 'b', correct: false, why: 'n' }] };
  const blocks = [
    { type: 'prose', md: 'Short [s1] [s2].' },
    { type: 'worked_example', title: 't', setup: 's', steps: [{ md: 'm' }], takeaway: 'k' },
    { type: 'exercise', prompt: 'p', hints: [], solution: 's' },
    { type: 'quiz', questions: [q, q] },
  ];
  const result = validateLesson(withBlocks(fixture(), blocks));
  assert.deepEqual(errorsMatching(result, /words/), [`lesson needs 350 to 2500 words, has ${result.stats.words}`]);
  assert.equal(result.errors.length, 1);
});

test('warmup is required first when review nodes are due', () => {
  const lesson = fixture();
  const noWarmup = withBlocks(lesson, lesson.blocks.filter((b) => b.type !== 'warmup'));
  assert.equal(errorsMatching(validateLesson(noWarmup, { warmup: ['ownership-basics'] }), /warmup/).length, 1);
  assert.equal(validateLesson(lesson, { warmup: ['ownership-basics'] }).ok, true);
  const missing = validateLesson(lesson, { warmup: ['ownership-basics', 'traits'] });
  assert.equal(errorsMatching(missing, /traits/).length, 1);
});

test('sources need https urls and a verbatim-length quote', () => {
  const lesson = fixture();
  const sources = [{ ...lesson.sources[0], url: 'http://x.dev' }, { ...lesson.sources[1], quote: 'short' }];
  const result = validateLesson({ ...lesson, sources });
  assert.equal(errorsMatching(result, /https/).length, 1);
  assert.equal(errorsMatching(result, /quote/).length, 1);
});

test('remedial lessons use the lighter rule set', () => {
  const remedial = {
    ...fixture(),
    kind: 'remedial',
    sources: [fixture().sources[1]].map((s) => ({ ...s, id: 's1' })),
    blocks: [
      { type: 'callout', tone: 'misconception', md: `${'word '.repeat(160)} [s1]` },
      {
        type: 'quiz',
        questions: [{ q: 'q', options: [{ text: 'a', correct: true, why: 'y' }, { text: 'b', correct: false, why: 'n' }] }],
      },
    ],
  };
  assert.deepEqual(validateLesson(remedial).errors, []);
});
