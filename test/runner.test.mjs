import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HARNESS, composeScript, runInNode, checkRunnableExercises } from '../lib/runner.mjs';
import { validateLesson } from '../lib/validate-lesson.mjs';
import { renderLesson } from '../lib/render-lesson.mjs';

const fixture = () =>
  JSON.parse(readFileSync(new URL('../examples/lesson-future-trait.json', import.meta.url), 'utf8'));

const TESTS = 'test("adds", () => assertEqual(add(2, 3), 5));\ntest("close", () => assertClose(half(1), 0.5));';
const SOLUTION = 'function add(a: number, b: number): number { return a + b; }\nconst half = (x: number) => x / 2;';
const STARTER = 'function add(a: number, b: number): number {\n  // TODO\n  return 0;\n}\nconst half = (x: number) => x / 2;';

// Swap the fixture's Rust exercise for a runnable TypeScript one.
const runnable = (overrides = {}) => {
  const lesson = fixture();
  lesson.blocks = lesson.blocks.map((b) => (b.type === 'exercise'
    ? { ...b, lang: 'ts', starter: STARTER, tests: TESTS, solution_code: SOLUTION, ...overrides }
    : b));
  return lesson;
};

test('composeScript reports where the learner code and the tests start', () => {
  const { script, codeLine, testsLine } = composeScript('A\nB', 'T', HARNESS);
  const lines = script.split('\n');
  assert.equal(lines[codeLine - 1], 'A');
  assert.equal(lines[codeLine], 'B');
  assert.equal(lines[testsLine - 1], 'T');
});

test('runInNode passes, fails with the assertion message, and captures crashes', () => {
  assert.deepEqual(runInNode({ lang: 'ts', code: SOLUTION, tests: TESTS }), { ok: true, total: 2, passed: 2, failed: [] });
  const failing = runInNode({ lang: 'ts', code: STARTER, tests: TESTS });
  assert.equal(failing.ok, false);
  assert.deepEqual(failing.failed, [{ name: 'adds', error: 'expected 5, got 0' }]);
  const crash = runInNode({ lang: 'js', code: 'missing();', tests: TESTS });
  assert.match(crash.crash, /ReferenceError/);
});

test('runInNode stops a script that never finishes', () => {
  const res = runInNode({ lang: 'js', code: 'while (true) {}', tests: TESTS, timeoutMs: 1000 });
  assert.equal(res.ok, false);
  assert.match(res.error, /did not finish/);
});

test('runInNode reports a syntax error from the script', () => {
  const res = runInNode({ lang: 'js', code: 'function add( {', tests: TESTS });
  assert.equal(res.ok, false);
  assert.match(res.error, /SyntaxError/);
});

test('a runnable exercise passes when the solution passes and the starter does not', () => {
  const lesson = runnable();
  assert.deepEqual(validateLesson(lesson).errors, []);
  const run = checkRunnableExercises(lesson);
  assert.deepEqual(run.errors, []);
  assert.deepEqual(run.exercises, [{ block: 9, tests: 2, solution_passes: true, starter_fails: true }]);
});

test('a solution that fails its own tests is rejected', () => {
  const { errors } = checkRunnableExercises(runnable({ solution_code: STARTER }));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /solution_code fails its own tests: "adds": expected 5, got 0/);
});

test('a starter that already passes is rejected', () => {
  const { errors } = checkRunnableExercises(runnable({ starter: SOLUTION }));
  assert.deepEqual(errors, ['block 9 (exercise): starter already passes every test; leave the work for the learner']);
});

test('tests that register nothing are rejected', () => {
  const { errors } = checkRunnableExercises(runnable({ tests: '// nothing yet' }));
  assert.match(errors[0], /registered no test\(\) cases/);
});

test('runnable exercises need ts or js, all three code fields, and no modules', () => {
  const wrongLang = validateLesson(runnable({ lang: 'rust' }));
  assert.ok(wrongLang.errors.some((e) => /need lang "ts" or "js"/.test(e)));
  const missing = validateLesson(runnable({ solution_code: '' }));
  assert.ok(missing.errors.some((e) => /missing "solution_code"/.test(e)));
  const imports = validateLesson(runnable({ starter: `import fs from "node:fs";\n${STARTER}` }));
  assert.ok(imports.errors.some((e) => /"starter" can't import/.test(e)));
});

test('only exercises with tests get the editor and the runner script', () => {
  const plain = renderLesson(fixture());
  assert.ok(!plain.includes('class="runner"'));
  assert.ok(!plain.includes('new Worker'));
  const html = renderLesson(runnable({ starter: '// <b>start</b> & go\n' + STARTER }));
  assert.equal((html.match(/class="runner"/g) || []).length, 1);
  assert.ok(html.includes('// &lt;b&gt;start&lt;/b&gt; &amp; go'), 'starter is escaped inside the textarea');
  assert.ok(html.includes('class="tests-src" hidden'));
  assert.ok(html.includes('new Worker'));
  assert.ok(html.includes('What the tests check'));
});

test('the runner script cannot close its own script element early', () => {
  const html = renderLesson(runnable({ tests: `${TESTS}\n// </script><script>alert(1)</script>` }));
  const scripts = html.match(/<script>[\s\S]*?<\/script>/g);
  assert.equal(scripts.length, 3);
  assert.ok(!scripts[2].includes('alert(1)'), 'test code never reaches a script element');
});
