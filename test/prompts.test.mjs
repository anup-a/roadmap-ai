import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillTemplate, renderPrompt } from '../lib/prompts.mjs';
import { createLearner } from '../lib/learner.mjs';
import { sampleGraph } from './graph.test.mjs';

test('fillTemplate fills and refuses leftovers', () => {
  assert.equal(fillTemplate('a {{X}} b', { X: 1 }), 'a 1 b');
  assert.throws(() => fillTemplate('{{X}} {{Y}}', { X: 1 }), /Y/);
});

test('every shipped prompt fills from graph, learner and a few --set values', () => {
  const graph = sampleGraph();
  const research = { sources: [{ id: 'r1', title: 'Book', url: 'https://x.dev' }] };
  const learner = createLearner({ graph, run: 'r', profile: { goal: 'g', mode: 'exam', background: 'b', style: 's', deadline: null, minutes_per_day: 15 } });
  const base = { graph, graphPath: '/g.json', research, researchPath: '/r.json', learner, node: 'b', warmup: ['a'] };
  const set = { OUT: '/out.json', LESSON: '/l.json', FOCUS: 'sources' };
  for (const name of ['research', 'graph', 'diagnostic', 'lesson', 'grader', 'gate', 'patch']) {
    const text = renderPrompt(name, { ...base, set });
    assert.doesNotMatch(text, /\{\{/, name);
  }
  const lesson = renderPrompt('lesson', { ...base, set });
  assert.match(lesson, /r1: Book <https:\/\/x.dev>/);
  assert.match(lesson, /mode: exam/);
  assert.match(lesson, /--warmup a/);
});
