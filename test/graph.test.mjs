import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateGraph, topoOrder } from '../lib/graph.mjs';

const node = (id, prereqs = []) => ({
  id,
  title: id,
  summary: `About ${id}`,
  objectives: [`Understand ${id}`],
  prereqs,
  sources: ['r1'],
  misconceptions: [],
});

export const sampleGraph = () => ({
  version: 1,
  topic: 'demo',
  title: 'Demo',
  nodes: [node('a'), node('b', ['a']), node('c', ['a']), node('d', ['b', 'c']), node('e', ['d']), node('f', ['e'])],
});

const research = { sources: [{ id: 'r1' }] };

test('a valid DAG passes', () => {
  assert.deepEqual(validateGraph(sampleGraph(), research).errors, []);
});

test('cycles are reported', () => {
  const g = sampleGraph();
  const nodes = g.nodes.map((n) => (n.id === 'a' ? { ...n, prereqs: ['f'] } : n));
  assert.ok(validateGraph({ ...g, nodes }).errors.some((e) => /cycle/.test(e)));
});

test('unknown prereq, duplicate id, bad id and unknown research source are reported', () => {
  const g = sampleGraph();
  const nodes = [...g.nodes, node('b'), node('Bad Id'), { ...node('g', ['zzz']), sources: ['r9'] }];
  const errors = validateGraph({ ...g, nodes }, research).errors;
  assert.ok(errors.some((e) => /duplicate.*b/.test(e)));
  assert.ok(errors.some((e) => /Bad Id/.test(e)));
  assert.ok(errors.some((e) => /zzz/.test(e)));
  assert.ok(errors.some((e) => /r9/.test(e)));
});

test('node count must be 6 to 30', () => {
  const g = sampleGraph();
  assert.ok(validateGraph({ ...g, nodes: g.nodes.slice(0, 3) }).errors.some((e) => /6 to 30/.test(e)));
});

test('topoOrder puts prereqs first and is stable by declaration order', () => {
  assert.deepEqual(topoOrder(sampleGraph()), ['a', 'b', 'c', 'd', 'e', 'f']);
});
