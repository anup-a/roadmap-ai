import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareGate, scoreGate } from '../lib/gate.mjs';

const q = (objective, n = 4) => ({
  objective,
  q: `about ${objective}`,
  options: Array.from({ length: n }, (_, i) =>
    i === 0 ? { text: `${objective} right`, correct: true } : { text: `${objective} wrong ${i}`, correct: false, misconception: `belief ${objective}${i}` },
  ),
  explain: `why ${objective}`,
});

const gate = { node: 'x', questions: [q('o1'), q('o1'), q('o2'), q('o3')] };

test('prepareGate moves the correct option off a fixed position, deterministically', () => {
  const a = prepareGate(gate, { seed: 'run-1' });
  const b = prepareGate(gate, { seed: 'run-1' });
  assert.deepEqual(a, b);
  const keys = a.questions.map((x) => x.options.findIndex((o) => o.correct));
  assert.ok(new Set(keys).size > 1, `keys all at ${keys[0]}`);
  a.questions.forEach((x, i) => assert.equal(x.options.find((o) => o.correct).text, gate.questions[i].options[0].text));
  assert.equal(gate.questions[0].options[0].correct, true, 'input is not mutated');
});

test('scoreGate computes score, misconceptions picked and objectives not shown', () => {
  const g = prepareGate(gate, { seed: 's' });
  const right = (i) => g.questions[i].options.findIndex((o) => o.correct);
  const wrong = (i) => g.questions[i].options.findIndex((o) => !o.correct);
  const answers = [right(0), wrong(1), wrong(2), right(3)];
  const r = scoreGate(g, answers);
  assert.equal(r.score, 0.5);
  assert.deepEqual(r.missed, [
    g.questions[1].options[wrong(1)].misconception,
    g.questions[2].options[wrong(2)].misconception,
    'objective not shown: o2',
  ]);
  assert.equal(r.results[1].correct, false);
  assert.equal(r.results[1].explain, 'why o1');
});

test('scoreGate rejects a wrong number of answers or out-of-range choices', () => {
  assert.throws(() => scoreGate(gate, [0]), /4 answers/);
  assert.throws(() => scoreGate(gate, [0, 0, 0, 9]), /question 4/);
});
