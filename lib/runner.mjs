// Runnable exercises: one test harness shared by the lesson page (a blob: Web
// Worker) and `lp validate-lesson` (a Node child process), so the checks the
// validator runs are exactly the checks the learner sees.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const RUNNABLE_LANGS = { js: 'js', javascript: 'js', ts: 'ts', typescript: 'ts' };
export const runnableLang = (lang) => RUNNABLE_LANGS[String(lang ?? '').toLowerCase()] ?? null;

// Pinned so a lesson page behaves the same every time it is opened. 3.35.1 on
// jsdelivr resolves a sourcemap-codec that lacks `encode`; 3.35.0 pins its deps.
export const SUCRASE_URL = 'https://cdn.jsdelivr.net/npm/sucrase@3.35.0/+esm';
export const BROWSER_TIMEOUT_MS = 5000;
const NODE_TIMEOUT_MS = 10000;
const MAX_LOG_LINES = 200;

// Plain JS, no types: it is prepended to the learner's code as-is. `__emit`
// posts to the page from a worker and writes JSON lines from Node.
export const HARNESS = String.raw`"use strict";
const __emit = typeof postMessage === 'function' && typeof process === 'undefined'
  ? (m) => postMessage(m)
  : (m) => process.stdout.write('\u0000lp ' + JSON.stringify(m) + '\n');
const __fmt = (v, seen = new Set()) => {
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'bigint') return v + 'n';
  if (typeof v === 'function') return '[Function ' + (v.name || 'anonymous') + ']';
  if (typeof v !== 'object' || v === null) return String(v);
  if (seen.has(v)) return '[Circular]';
  seen.add(v);
  if (v instanceof Error) return v.name + ': ' + v.message;
  if (Array.isArray(v) || ArrayBuffer.isView(v)) return '[' + Array.from(v, (x) => __fmt(x, seen)).join(', ') + ']';
  if (v instanceof Map) return 'Map(' + [...v].map(([k, x]) => __fmt(k, seen) + ' => ' + __fmt(x, seen)).join(', ') + ')';
  if (v instanceof Set) return 'Set(' + [...v].map((x) => __fmt(x, seen)).join(', ') + ')';
  return '{ ' + Object.keys(v).map((k) => k + ': ' + __fmt(v[k], seen)).join(', ') + ' }';
};
let __lines = 0;
for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
  console[level] = (...args) => {
    if (++__lines > ${MAX_LOG_LINES}) {
      if (__lines === ${MAX_LOG_LINES + 1}) __emit({ t: 'log', level: 'warn', text: '(output cut off after ${MAX_LOG_LINES} lines)' });
      return;
    }
    __emit({ t: 'log', level, text: args.map((a) => (typeof a === 'string' ? a : __fmt(a))).join(' ') });
  };
}
class AssertionError extends Error { constructor(m) { super(m); this.name = 'AssertionError'; } }
const __eq = (a, b) => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b) || Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  if (a instanceof Map || a instanceof Set) return a.size === b.size && __eq([...a], [...b]);
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && __eq(a[k], b[k]));
};
const __say = (msg, detail) => (msg ? msg + ': ' : '') + detail;
function assert(cond, msg) { if (!cond) throw new AssertionError(msg || 'expected a truthy value, got ' + __fmt(cond)); }
function assertEqual(actual, expected, msg) {
  if (!__eq(actual, expected)) throw new AssertionError(__say(msg, 'expected ' + __fmt(expected) + ', got ' + __fmt(actual)));
}
function assertClose(actual, expected, tol = 1e-6, msg) {
  const a = typeof actual === 'number' ? [actual] : Array.from(actual ?? []);
  const e = typeof expected === 'number' ? [expected] : Array.from(expected);
  const ok = a.length === e.length && a.every((x, i) => typeof x === 'number' && Math.abs(x - e[i]) <= tol);
  if (!ok) throw new AssertionError(__say(msg, 'expected ' + __fmt(expected) + ' (within ' + tol + '), got ' + __fmt(actual)));
}
function assertThrows(fn, msg) {
  try { fn(); } catch { return; }
  throw new AssertionError(msg || 'expected the call to throw');
}
const __tests = [];
function test(name, fn) { __tests.push([String(name), fn]); }
const __where = (e) => {
  const m = /:(\d+):(\d+)\)?\s*$/m.exec(String(e && e.stack || '').split('\n').slice(1).join('\n'));
  return m ? Number(m[1]) : null;
};
const __crash = (e) => __emit({ t: 'crash', name: e && e.name || 'Error', message: String(e && e.message || e), line: __where(e) });
const __run = async () => {
  for (const [name, fn] of __tests) {
    try { await fn(); __emit({ t: 'test', name, ok: true }); }
    catch (e) { __emit({ t: 'test', name, ok: false, error: String(e && e.message || e), line: e instanceof AssertionError ? null : __where(e) }); }
  }
  __emit({ t: 'done', total: __tests.length });
};
`;

/**
 * Wrap the learner's code and the tests into one script. Both run inside one
 * async function so tests see the learner's declarations and can await.
 * `codeLine` is the script line where the learner's code starts, so an error
 * line can be shown as a line of what they typed. Self-contained: the lesson
 * page embeds this function's source.
 */
export function composeScript(code, tests, harness) {
  const codeLine = harness.split('\n').length + 1;
  const codeLines = String(code).split('\n').length;
  const script = harness + '(async () => { try {\n' + code + '\n;\n' + tests
    + '\n} catch (e) { __crash(e); return; }\nawait __run();\n})();\n';
  return { script, codeLine, testsLine: codeLine + codeLines + 1 };
}

// Node strips TypeScript types natively from 22.18 / 23.6; 22.6 to 22.17 need the flag.
function tsFlags() {
  if (process.features?.typescript) return [];
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major > 22 || (major === 22 && minor >= 6)) return ['--experimental-strip-types'];
  return null;
}

/** Run code + tests in a child Node process. Returns the parsed harness messages. */
export function runInNode({ lang, code, tests, timeoutMs = NODE_TIMEOUT_MS }) {
  const kind = runnableLang(lang);
  if (!kind) return { ok: false, error: `language "${lang}" can't be run` };
  const flags = kind === 'ts' ? tsFlags() : [];
  if (!flags) return { ok: false, error: `checking TypeScript exercises needs Node 22.6 or newer (this is ${process.version})` };
  const dir = mkdtempSync(join(tmpdir(), 'lp-run-'));
  try {
    const file = join(dir, kind === 'ts' ? 'exercise.cts' : 'exercise.cjs');
    writeFileSync(file, composeScript(code, tests, HARNESS).script);
    const res = spawnSync(process.execPath, ['--no-warnings', ...flags, file], {
      cwd: dir, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024,
    });
    const messages = (res.stdout || '').split('\n').filter((l) => l.startsWith('\u0000lp '))
      .map((l) => JSON.parse(l.slice(4)));
    const results = messages.filter((m) => m.t === 'test');
    const crash = messages.find((m) => m.t === 'crash');
    const done = messages.find((m) => m.t === 'done');
    const timedOut = res.error?.code === 'ETIMEDOUT' || res.signal === 'SIGTERM';
    const errLines = (res.stderr || '').trim().split('\n');
    const stderr = errLines.find((l) => /^\w*Error\b/.test(l)) || errLines.slice(0, 3).join('\n');
    return {
      ok: Boolean(done) && !crash && results.every((r) => r.ok),
      total: done ? done.total : results.length,
      passed: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).map(({ name, error }) => ({ name, error })),
      ...(crash ? { crash: `${crash.name}: ${crash.message}` } : {}),
      ...(timedOut ? { error: `did not finish within ${timeoutMs / 1000} s` } : {}),
      ...(!done && !crash && !timedOut ? { error: stderr || 'the script exited before the tests finished' } : {}),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The executable half of exercise validation: the solution must pass every
 * test, and the starter must fail at least one (or it is already solved).
 */
export function checkRunnableExercises(lesson) {
  const errors = [];
  const report = [];
  (lesson.blocks ?? []).forEach((b, i) => {
    // Structural problems (missing fields, wrong lang) are validateLesson's to report.
    if (b.type !== 'exercise' || !runnableLang(b.lang)) return;
    if (![b.starter, b.tests, b.solution_code].every((v) => typeof v === 'string' && v.trim())) return;
    const where = `block ${i + 1} (exercise)`;
    const solution = runInNode({ lang: b.lang, code: b.solution_code ?? '', tests: b.tests });
    const starter = runInNode({ lang: b.lang, code: b.starter ?? '', tests: b.tests });
    report.push({ block: i + 1, tests: solution.total ?? 0, solution_passes: solution.ok, starter_fails: !starter.ok });
    if (solution.error && !solution.total) errors.push(`${where}: solution_code + tests: ${solution.error}`);
    else if (solution.crash) errors.push(`${where}: solution_code crashed: ${solution.crash}`);
    else if (!solution.total) errors.push(`${where}: tests registered no test() cases`);
    else if (!solution.ok) {
      const why = solution.failed.map((f) => `"${f.name}": ${f.error}`).join('; ') || solution.error;
      errors.push(`${where}: solution_code fails its own tests: ${why}`);
    }
    if (starter.ok) errors.push(`${where}: starter already passes every test; leave the work for the learner`);
  });
  return { errors, exercises: report };
}
