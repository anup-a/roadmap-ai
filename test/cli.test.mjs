import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sampleGraph } from './graph.test.mjs';

const LP = new URL('../bin/lp.mjs', import.meta.url).pathname;
const FIXTURE = new URL('../examples/lesson-future-trait.json', import.meta.url).pathname;

const lp = (...args) => {
  try {
    return { code: 0, out: JSON.parse(execFileSync('node', [LP, ...args], { encoding: 'utf8' })) };
  } catch (err) {
    return { code: err.status, out: JSON.parse(err.stdout) };
  }
};

test('learner lifecycle through the CLI', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lp-'));
  const graph = join(dir, 'graph.json');
  const learner = join(dir, 'learner.json');
  writeFileSync(graph, JSON.stringify(sampleGraph()));
  const profile = JSON.stringify({ goal: 'g', mode: 'build', background: 'b', style: 's', deadline: null, minutes_per_day: 20 });

  assert.equal(lp('validate-graph', graph).out.ok, true);
  assert.equal(lp('learner', 'init', '--graph', graph, '--learner', learner, '--run', 'demo', '--profile', profile).code, 0);
  assert.equal(lp('learner', 'init', '--graph', graph, '--learner', learner, '--run', 'demo', '--profile', profile).code, 1, 'refuses to overwrite');
  lp('learner', 'diagnostic', '--graph', graph, '--learner', learner, '--known', 'a');
  lp('learner', 'start', '--graph', graph, '--learner', learner, '--node', 'b');
  lp('learner', 'lesson', '--learner', learner, '--key', 'b', '--kind', 'lesson', '--artifact', 'x', '--url', 'https://byagent.dev/a/x/');
  lp('learner', 'lesson', '--learner', learner, '--key', 'c', '--kind', 'lesson', '--artifact', 'y', '--url', 'https://byagent.dev/a/y/');

  const gate = lp('learner', 'gate', '--graph', graph, '--learner', learner, '--node', 'b', '--score', '0.5', '--missed', 'm1', '--missed', 'm2');
  assert.equal(gate.out.passed, false);
  assert.deepEqual(gate.out.stale, ['c']);

  const planned = lp('plan', '--graph', graph, '--learner', learner).out;
  assert.equal(planned.current, 'b');
  assert.deepEqual(planned.generate.map((g) => g.key), ['b~remedial-1', 'c']);

  const saved = JSON.parse(readFileSync(learner, 'utf8'));
  assert.equal(saved.nodes.a.source, 'diagnostic');
  assert.deepEqual(saved.misconceptions.map((m) => m.text), ['m1', 'm2']);
  assert.match(lp('brief', '--graph', graph, '--learner', learner, '--node', 'b').out.brief, /m2/);
});

test('validate-lesson exits non-zero with errors', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lp-'));
  const bad = join(dir, 'bad.json');
  writeFileSync(bad, JSON.stringify({ ...JSON.parse(readFileSync(FIXTURE, 'utf8')), blocks: [] }));
  const r = lp('validate-lesson', bad);
  assert.equal(r.code, 1);
  assert.ok(r.out.errors.length > 0);
  assert.equal(lp('validate-lesson', FIXTURE).out.ok, true);
});

test('prompt --set KEY=@file reads the value from a file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lp-'));
  const graph = join(dir, 'graph.json');
  const feedback = join(dir, 'grade.json');
  writeFileSync(graph, JSON.stringify(sampleGraph()));
  writeFileSync(feedback, '{"verdict":"revise","issues":[{"problem":"join! is not a future"}]}\n');
  const r = lp('prompt', 'lesson', '--graph', graph, '--node', 'b', '--set', `FEEDBACK=@${feedback}`, '--set', 'OUT=/x.json', '--set', 'RESEARCH=/r.json', '--set', 'BRIEF=b');
  assert.equal(r.code, 0);
  assert.match(r.out.prompt, /join! is not a future/);
});

test('unknown command is a JSON error', () => {
  const r = lp('nope');
  assert.equal(r.code, 1);
  assert.match(r.out.error, /unknown command/);
});

test('render-lesson writes index.html', { skip: !existsSync(new URL('../lib/render-lesson.mjs', import.meta.url)) }, () => {
  const out = join(mkdtempSync(join(tmpdir(), 'lp-')), 'site');
  const r = lp('render-lesson', FIXTURE, '--out', out, '--map', 'https://byagent.dev/a/map/');
  assert.equal(r.code, 0);
  assert.match(readFileSync(join(out, 'index.html'), 'utf8'), /What a Future actually is/);
});
