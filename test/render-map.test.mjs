import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMap, layoutLayers, deriveStates } from '../lib/render-map.mjs';

const node = (id, prereqs = [], extra = {}) => ({
  id, title: `Title ${id}`, summary: `Summary of ${id}.`, objectives: ['x'], prereqs, sources: [], misconceptions: [], ...extra,
});

// Diamond a -> (b, c) -> d, then a chain d -> e -> f, plus an independent root g feeding f.
const graph = {
  version: 1, topic: 't', title: 'Test topic',
  nodes: [node('a'), node('b', ['a']), node('c', ['a']), node('d', ['b', 'c']),
    node('e', ['d']), node('f', ['e', 'g']), node('g')],
};

const learner = {
  version: 1, topic: 't', run: 'r',
  profile: { goal: 'Ship a <b>thing</b>', mode: 'build' },
  nodes: {
    a: { state: 'mastered' },
    b: { state: 'mastered' },
    c: { state: 'in_progress' },
    g: { state: 'mastered' },
  },
};

test('layoutLayers groups nodes by longest prerequisite chain', () => {
  assert.deepEqual(layoutLayers(graph), [['a', 'g'], ['b', 'c'], ['d'], ['e'], ['f']]);
});

test('layoutLayers on a pure chain', () => {
  const g = { nodes: [node('z', ['y']), node('y', ['x']), node('x')] };
  assert.deepEqual(layoutLayers(g), [['x'], ['y'], ['z']]);
});

test('layoutLayers rejects cycles and unknown prereqs', () => {
  assert.throws(() => layoutLayers({ nodes: [node('p', ['q']), node('q', ['p'])] }), /cycle/i);
  assert.throws(() => layoutLayers({ nodes: [node('p', ['nope'])] }), /nope/);
});

test('deriveStates keeps mastered/in_progress and derives ready/locked', () => {
  const s = deriveStates(graph, learner);
  assert.deepEqual(s, { a: 'mastered', b: 'mastered', c: 'in_progress', d: 'locked', e: 'locked', f: 'locked', g: 'mastered' });
});

test('deriveStates ignores a stale stored ready/locked and recomputes it', () => {
  const l = structuredClone(learner);
  l.nodes.c = { state: 'mastered' };
  l.nodes.d = { state: 'locked' };
  l.nodes.e = { state: 'ready' };
  const s = deriveStates(graph, l);
  assert.equal(s.d, 'ready');
  assert.equal(s.e, 'locked');
});

test('deriveStates treats a learner with no nodes as all roots ready', () => {
  const s = deriveStates(graph, { nodes: {} });
  assert.equal(s.a, 'ready');
  assert.equal(s.g, 'ready');
  assert.equal(s.b, 'locked');
});

test('renders every node with its state', () => {
  const html = renderMap(graph, learner);
  assert.ok(html.startsWith('<!doctype html>'));
  for (const n of graph.nodes) assert.ok(html.includes(`data-node="${n.id}"`), n.id);
  assert.ok(html.includes('data-node="d" data-state="locked"'));
  assert.ok(html.includes('data-node="c" data-state="in_progress"'));
});

test('nodes are links only when a lesson url exists', () => {
  const html = renderMap(graph, learner, { lessonUrls: { c: '../c/', a: '../a/' } });
  assert.ok(html.includes('href="../c/"'));
  assert.ok(html.includes('href="../a/"'));
  assert.equal((html.match(/<a class="node/g) || []).length, 2);
});

test('unsafe lesson urls are not linked', () => {
  const html = renderMap(graph, learner, { lessonUrls: { c: 'javascript:alert(1)' } });
  assert.ok(!html.includes('javascript:'));
});

test('legend lists the four states', () => {
  const html = renderMap(graph, learner);
  assert.ok(html.includes('class="legend"'));
  for (const label of ['Locked', 'Ready', 'In progress', 'Mastered']) assert.ok(html.includes(label), label);
});

test('progress summary, goal and mode are shown; profile text is escaped', () => {
  const html = renderMap(graph, learner);
  assert.ok(html.includes('3 of 7'));
  assert.ok(html.includes('Ship a &lt;b&gt;thing&lt;/b&gt;'));
  assert.ok(html.includes('build'));
});

test('draws one edge per prerequisite link', () => {
  const html = renderMap(graph, learner);
  assert.equal((html.match(/class="edge/g) || []).length, 7);
});

test('node text from the graph is escaped', () => {
  const g = structuredClone(graph);
  g.nodes[0].title = '<script>alert(1)</script>';
  g.nodes[0].summary = '"><img src=x>';
  const html = renderMap(g, learner);
  assert.ok(!html.includes('<script>alert'));
  assert.ok(!html.includes('<img'));
});

test('no external scripts', () => {
  assert.ok(!/<script[^>]*\ssrc=/i.test(renderMap(graph, learner)));
});
