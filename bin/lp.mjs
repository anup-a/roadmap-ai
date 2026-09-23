#!/usr/bin/env node
// lp: the deterministic tooling the learnpath skill drives. Every command prints
// exactly one JSON object and exits 1 on failure.

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { validateGraph } from '../lib/graph.mjs';
import { validateLesson } from '../lib/validate-lesson.mjs';
import { checkCitations, curlFetch, htmlToText, snippets } from '../lib/citations.mjs';
import * as L from '../lib/learner.mjs';
import { mergeResearch } from '../lib/research.mjs';
import { renderPrompt } from '../lib/prompts.mjs';

const REPEATABLE = new Set(['missed', 'known', 'unknown', 'warmup', 'set']);

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) {
      positional.push(argv[i]);
      continue;
    }
    const key = argv[i].slice(2);
    const value = argv[i + 1] === undefined || argv[i + 1].startsWith('--') ? true : argv[++i];
    flags[key] = REPEATABLE.has(key) ? [...(flags[key] ?? []), value] : value;
  }
  return { positional, flags };
}

// "a,b" and repeated flags both work for id lists; missed items keep their commas.
const ids = (v) => (v ?? []).flatMap((s) => String(s).split(',')).map((s) => s.trim()).filter(Boolean);

const readJson = (path) => {
  if (!path) throw new Error('missing a required file path');
  return JSON.parse(readFileSync(path, 'utf8'));
};

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tmp, path);
}

const need = (flags, ...names) => {
  const missing = names.filter((n) => flags[n] === undefined || flags[n] === true);
  if (missing.length) throw new Error(`missing ${missing.map((n) => `--${n}`).join(', ')}`);
};

const home = () => process.env.LEARNPATH_HOME || join(homedir(), '.learnpath');

function learnerCommand(sub, f) {
  need(f, 'learner');
  const save = (learner, extra = {}) => {
    writeJson(f.learner, learner);
    return { ok: true, ...extra };
  };
  if (sub === 'init') {
    need(f, 'graph', 'run', 'profile');
    if (existsSync(f.learner) && !f.force) throw new Error(`${f.learner} exists; pass --force to replace it`);
    const profile = f.profile.trim().startsWith('{') ? JSON.parse(f.profile) : readJson(f.profile);
    return save(L.createLearner({ graph: readJson(f.graph), run: f.run, profile }));
  }
  const learner = readJson(f.learner);
  switch (sub) {
    case 'diagnostic': {
      need(f, 'graph');
      const graph = readJson(f.graph);
      const answers = { known: ids(f.known), unknown: ids(f.unknown) };
      const { credited, discounted } = L.creditDiagnostic(graph, answers);
      return save(L.applyDiagnostic(graph, learner, answers.known, { unknown: answers.unknown }), { credited, discounted });
    }
    case 'start':
      need(f, 'graph', 'node');
      return save(L.startNode(readJson(f.graph), learner, f.node));
    case 'gate': {
      need(f, 'graph', 'node', 'score');
      const missed = (f.missed ?? []).map(String).filter(Boolean);
      const result = L.recordGate(readJson(f.graph), learner, f.node, { score: Number(f.score), missed });
      return save(result.learner, { passed: result.passed, stale: result.stale, pass_mark: L.passMark(learner.profile.mode) });
    }
    case 'lesson':
      need(f, 'key', 'kind', 'artifact', 'url');
      return save(L.recordLesson(learner, f.key, { kind: f.kind, artifact: f.artifact, url: f.url, warmup: ids(f.warmup) }));
    case 'question':
      need(f, 'node', 'text');
      return save(L.noteQuestion(learner, f.node, f.text, f.answer === true ? '' : f.answer ?? ''));
    case 'misconception':
      need(f, 'node', 'text');
      return save(L.noteMisconception(learner, f.node, f.text));
    case 'map':
      need(f, 'artifact', 'url');
      return save(L.setMap(learner, { artifact: f.artifact, url: f.url }));
    default:
      throw new Error(`unknown learner subcommand "${sub}"`);
  }
}

function status(graph, learner) {
  const l = L.deriveStates(graph, learner);
  const rows = graph.nodes.map((n) => ({
    id: n.id,
    title: n.title,
    state: l.nodes[n.id].state,
    mastery: l.nodes[n.id].mastery,
    lesson: l.lessons[n.id]?.url ?? null,
  }));
  const mastered = rows.filter((r) => r.state === 'mastered').length;
  return { ok: true, mastered, total: rows.length, map: l.map?.url ?? null, nodes: rows };
}

async function renderLessonCommand(file, f) {
  need(f, 'out');
  const { renderLesson } = await import('../lib/render-lesson.mjs');
  const lesson = readJson(file);
  const check = validateLesson(lesson);
  if (!check.ok) return { ok: false, errors: check.errors };
  const html = renderLesson(lesson, { mapUrl: f.map ?? null, prevUrl: f.prev ?? null, nextUrl: f.next ?? null });
  mkdirSync(f.out, { recursive: true });
  writeFileSync(join(f.out, 'index.html'), html);
  return { ok: true, out: join(f.out, 'index.html') };
}

async function renderMapCommand(f) {
  need(f, 'graph', 'learner', 'out');
  const { renderMap } = await import('../lib/render-map.mjs');
  const learner = readJson(f.learner);
  const lessonUrls = Object.fromEntries(
    Object.entries(learner.lessons)
      .filter(([key]) => !key.includes('~'))
      .map(([key, lesson]) => [key, lesson.url]),
  );
  mkdirSync(f.out, { recursive: true });
  writeFileSync(join(f.out, 'index.html'), renderMap(readJson(f.graph), learner, { lessonUrls }));
  return { ok: true, out: join(f.out, 'index.html') };
}

async function main([command, ...rest]) {
  const { positional, flags: f } = parseArgs(rest);
  switch (command) {
    case 'paths': {
      const topic = f.topic && f.topic !== true ? join(home(), 'topics', f.topic) : null;
      const run = f.run && f.run !== true ? join(home(), 'runs', f.run) : null;
      return { ok: true, home: home(), topic, run };
    }
    case 'prompt': {
      const set = Object.fromEntries(
        (f.set ?? []).map((kv) => {
          const at = String(kv).indexOf('=');
          if (at < 1) throw new Error(`--set expects KEY=VALUE, got "${kv}"`);
          return [kv.slice(0, at), kv.slice(at + 1)];
        }),
      );
      const prompt = renderPrompt(positional[0], {
        graph: f.graph ? readJson(f.graph) : null,
        graphPath: f.graph,
        research: f.research ? readJson(f.research) : null,
        researchPath: f.research,
        learner: f.learner ? readJson(f.learner) : null,
        node: f.node,
        kind: f.kind ?? 'lesson',
        warmup: ids(f.warmup),
        set,
      });
      if (f.out && f.out !== true) {
        mkdirSync(dirname(f.out), { recursive: true });
        writeFileSync(f.out, prompt);
        return { ok: true, out: f.out, chars: prompt.length };
      }
      return { ok: true, prompt };
    }
    case 'merge-research': {
      need(f, 'topic', 'out');
      const research = mergeResearch({ topic: f.topic, parts: positional.map(readJson) });
      writeJson(f.out, research);
      const counts = { sources: research.sources.length, concepts: research.concepts.length, misconceptions: research.misconceptions.length };
      return { ok: counts.sources > 0, out: f.out, ...counts };
    }
    case 'validate-graph': {
      const result = validateGraph(readJson(positional[0]), f.research ? readJson(f.research) : null);
      return { ...result };
    }
    case 'validate-lesson':
      return validateLesson(readJson(positional[0]), { warmup: ids(f.warmup) });
    case 'check-cites':
      return checkCitations(readJson(positional[0]));
    case 'source': {
      if (!positional[0]) throw new Error('usage: lp source <url> [--find <phrase>]');
      const text = htmlToText(await curlFetch(positional[0]));
      if (!f.find || f.find === true) return { ok: true, url: positional[0], chars: text.length, head: text.slice(0, 4000) };
      const matches = snippets(text, f.find);
      return { ok: matches.length > 0, url: positional[0], chars: text.length, find: f.find, matches };
    }
    case 'render-lesson':
      return renderLessonCommand(positional[0], f);
    case 'render-map':
      return renderMapCommand(f);
    case 'learner':
      return learnerCommand(positional[0], f);
    case 'plan':
      need(f, 'graph', 'learner');
      return { ok: true, ...L.plan(readJson(f.graph), readJson(f.learner), { prefetch: f.prefetch ? Number(f.prefetch) : 1 }) };
    case 'brief':
      need(f, 'graph', 'learner', 'node');
      return { ok: true, brief: L.brief(readJson(f.graph), readJson(f.learner), f.node) };
    case 'status':
      need(f, 'graph', 'learner');
      return status(readJson(f.graph), readJson(f.learner));
    default:
      throw new Error(`unknown command "${command ?? ''}"; see SKILL.md for the command list`);
  }
}

main(process.argv.slice(2))
  .then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.ok === false ? 1 : 0;
  })
  .catch((err) => {
    process.stdout.write(`${JSON.stringify({ ok: false, error: err.message })}\n`);
    process.exitCode = 1;
  });
