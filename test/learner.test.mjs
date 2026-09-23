import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleGraph } from './graph.test.mjs';
import {
  createLearner,
  applyDiagnostic,
  creditDiagnostic,
  startNode,
  recordGate,
  recordLesson,
  noteQuestion,
  plan,
  passMark,
  brief,
} from '../lib/learner.mjs';

const profile = { goal: 'ship', mode: 'build', background: 'ts', style: 'examples', deadline: null, minutes_per_day: 30 };
const fresh = () => createLearner({ graph: sampleGraph(), run: 'demo-me', profile });
const states = (l) => Object.fromEntries(Object.entries(l.nodes).map(([k, v]) => [k, v.state]));

test('a new learner has roots ready and the rest locked', () => {
  assert.deepEqual(states(fresh()), { a: 'ready', b: 'locked', c: 'locked', d: 'locked', e: 'locked', f: 'locked' });
});

test('diagnostic marks known nodes and their ancestors mastered, and unlocks dependents', () => {
  const l = applyDiagnostic(sampleGraph(), fresh(), ['b']);
  assert.equal(l.nodes.a.state, 'mastered');
  assert.equal(l.nodes.a.source, 'diagnostic');
  assert.equal(l.nodes.b.state, 'mastered');
  assert.equal(l.nodes.c.state, 'ready');
  assert.equal(l.nodes.d.state, 'locked');
});

test('a correct answer is discounted when an ancestor was answered wrong', () => {
  // d depends on b and c; b was failed directly, so getting d right was a guess.
  const { credited, discounted } = creditDiagnostic(sampleGraph(), { known: ['a', 'd'], unknown: ['b'] });
  assert.deepEqual(credited, ['a']);
  assert.deepEqual(discounted, ['d']);
  const l = applyDiagnostic(sampleGraph(), fresh(), ['a', 'd'], { unknown: ['b'] });
  assert.deepEqual(states(l), { a: 'mastered', b: 'ready', c: 'ready', d: 'locked', e: 'locked', f: 'locked' });
});

test('updates never mutate the input learner', () => {
  const before = fresh();
  const snapshot = JSON.stringify(before);
  applyDiagnostic(sampleGraph(), before, ['a']);
  startNode(sampleGraph(), before, 'a');
  assert.equal(JSON.stringify(before), snapshot);
});

test('cannot start a locked node', () => {
  assert.throws(() => startNode(sampleGraph(), fresh(), 'd'), /locked/);
});

test('pass mark depends on goal mode', () => {
  assert.equal(passMark('interview'), 0.8);
  assert.equal(passMark('curious'), 0.6);
  assert.throws(() => passMark('nope'), /mode/);
});

test('passing a gate masters the node and unlocks dependents', () => {
  const g = sampleGraph();
  let l = startNode(g, fresh(), 'a');
  const { learner, passed } = recordGate(g, l, 'a', { score: 0.9, missed: [] });
  assert.equal(passed, true);
  assert.equal(learner.nodes.a.state, 'mastered');
  assert.equal(learner.nodes.a.source, 'gate');
  assert.equal(learner.nodes.b.state, 'ready');
  assert.equal(learner.nodes.c.state, 'ready');
});

test('failing a gate records misconceptions and marks prefetched lessons stale', () => {
  const g = sampleGraph();
  let l = startNode(g, fresh(), 'a');
  l = recordLesson(l, 'a', { kind: 'lesson', artifact: 'x1', url: 'u1' });
  l = recordLesson(l, 'b', { kind: 'lesson', artifact: 'x2', url: 'u2' });
  const { learner, passed, stale } = recordGate(g, l, 'a', { score: 0.4, missed: ['thinks poll blocks'] });
  assert.equal(passed, false);
  assert.equal(learner.nodes.a.state, 'in_progress');
  assert.deepEqual(stale, ['b']);
  assert.equal(learner.lessons.b.stale, true);
  assert.equal(learner.lessons.a.stale, false, 'the lesson being read is not replaced under the learner');
  assert.equal(learner.misconceptions[0].text, 'thinks poll blocks');
});

test('passing with misses marks prefetched lessons for a warmup patch, not a rewrite', () => {
  const g = sampleGraph();
  let l = startNode(g, fresh(), 'a');
  l = recordLesson(l, 'a', { kind: 'lesson', artifact: 'x1', url: 'u1' });
  l = recordLesson(l, 'b', { kind: 'lesson', artifact: 'x2', url: 'u2' });
  const { learner, passed, stale, patch } = recordGate(g, l, 'a', { score: 0.75, missed: ['m1'] });
  assert.equal(passed, true);
  assert.deepEqual(stale, []);
  assert.deepEqual(patch, ['b']);
  assert.equal(learner.lessons.b.stale, false);
  assert.equal(learner.lessons.b.patch, true);
  assert.deepEqual(
    learner.misconceptions.map((m) => [m.text, m.resolved]),
    [['m1', false]],
    'a pass does not resolve what was missed on that same gate',
  );
  const text = brief(g, learner, 'b', { warmup: ['a'] });
  assert.match(text, /Gate attempts on a[\s\S]*score 0.75; missed: m1/);

  const p = plan(g, learner);
  assert.equal(p.current, 'b');
  assert.deepEqual(p.generate.map((x) => [x.key, x.reason]), [['b', 'patch'], ['c', 'missing']]);
  assert.deepEqual(p.warmup, ['a']);
  const patched = recordLesson(learner, 'b', { kind: 'lesson', artifact: 'x2', url: 'u2', warmup: ['a'] });
  assert.equal(patched.lessons.b.patch, false);
  assert.deepEqual(plan(g, patched).generate.map((x) => x.key), ['c']);
});

test('gate on a node that is not in progress is refused', () => {
  assert.throws(() => recordGate(sampleGraph(), fresh(), 'a', { score: 1, missed: [] }), /in progress/);
});

test('plan: current lesson plus one prefetch, then remedial after a failed gate', () => {
  const g = sampleGraph();
  const l0 = startNode(g, fresh(), 'a');
  const p0 = plan(g, l0);
  assert.equal(p0.current, 'a');
  assert.deepEqual(p0.generate.map((x) => x.key), ['a', 'b']);
  assert.equal(p0.generate[1].prefetch, true);

  let l1 = recordLesson(l0, 'a', { kind: 'lesson', artifact: 'x', url: 'u' });
  l1 = recordLesson(l1, 'b', { kind: 'lesson', artifact: 'y', url: 'v' });
  const failed = recordGate(g, l1, 'a', { score: 0.3, missed: ['m1'] }).learner;
  const p1 = plan(g, failed);
  assert.deepEqual(p1.generate.map((x) => x.key), ['a~remedial-1', 'b']);
  assert.equal(p1.generate[0].kind, 'remedial');
  assert.equal(p1.generate[1].reason, 'stale');
});

test('plan: warmup picks gate-mastered nodes with the fewest reviews', () => {
  const g = sampleGraph();
  let l = startNode(g, fresh(), 'a');
  l = recordGate(g, l, 'a', { score: 0.85, missed: [] }).learner;
  l = startNode(g, l, 'b');
  assert.deepEqual(plan(g, l).warmup, ['a']);
  l = recordLesson(l, 'b', { kind: 'lesson', artifact: 'x', url: 'u', warmup: ['a'] });
  assert.equal(l.nodes.a.reviews, 1);
});

test('plan: nothing current when everything is mastered', () => {
  const g = sampleGraph();
  const l = applyDiagnostic(g, fresh(), ['f']);
  assert.equal(plan(g, l).current, null);
  assert.equal(plan(g, l).done, true);
});

test('brief summarizes what the lesson writer needs', () => {
  const g = sampleGraph();
  let l = startNode(g, fresh(), 'a');
  l = recordGate(g, l, 'a', { score: 0.4, missed: ['thinks poll blocks'] }).learner;
  l = noteQuestion(l, 'a', 'why Pin?', 'because self-references');
  const text = brief(g, l, 'a');
  assert.match(text, /thinks poll blocks/);
  assert.match(text, /why Pin\?/);
  assert.match(text, /mode: build/);
});
