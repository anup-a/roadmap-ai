// Fills prompts/*.md templates. Unfilled {{PLACEHOLDERS}} are an error, so an
// agent is never dispatched with a half-built prompt.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { nodeById } from './graph.mjs';
import { brief } from './learner.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

export function fillTemplate(template, vars) {
  const filled = template.replace(/\{\{([A-Z_]+)\}\}/g, (m, key) => (vars[key] === undefined ? m : String(vars[key])));
  const missing = [...new Set([...filled.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1]))];
  if (missing.length) throw new Error(`prompt needs values for: ${missing.join(', ')}`);
  return filled;
}

export function nodeSpec(graph, research, id) {
  const node = nodeById(graph).get(id);
  if (!node) throw new Error(`unknown node "${id}"`);
  const byId = new Map((research?.sources ?? []).map((s) => [s.id, s]));
  const sources = (node.sources ?? []).map((sid) => {
    const s = byId.get(sid);
    return s ? `- ${sid}: ${s.title} <${s.url}>` : `- ${sid}`;
  });
  return [
    `## Node spec: ${node.title} (${node.id})`,
    node.summary,
    `Prereqs: ${(node.prereqs ?? []).join(', ') || 'none'}`,
    'Objectives:',
    ...(node.objectives ?? []).map((o) => `- ${o}`),
    'Misconceptions:',
    ...((node.misconceptions ?? []).length ? node.misconceptions.map((m) => `- ${m}`) : ['- none listed']),
    'Research sources:',
    ...(sources.length ? sources : ['- none listed']),
  ].join('\n');
}

const profileText = (p) =>
  Object.entries(p)
    .map(([k, v]) => `- ${k}: ${v ?? 'none'}`)
    .join('\n');

// Everything derivable from the files; explicit --set values win.
export function buildVars({ graph, graphPath, research, researchPath, learner, node, kind = 'lesson', warmup = [], set = {} }) {
  const vars = {
    LP: join(ROOT, 'bin', 'lp.mjs'),
    DOCS: join(ROOT, 'docs'),
    EXAMPLE: join(ROOT, 'examples', 'lesson-future-trait.json'),
    KIND: kind,
    FEEDBACK: 'none',
    WARMUP: warmup.length ? warmup.join(', ') : 'none',
    WARMUP_FLAGS: warmup.length ? `--warmup ${warmup.join(',')}` : '',
  };
  if (graph) Object.assign(vars, { TOPIC: graph.topic, TOPIC_TITLE: graph.title, GRAPH: graphPath });
  if (researchPath) vars.RESEARCH = researchPath;
  if (learner) vars.PROFILE = profileText(learner.profile);
  if (graph && node) {
    const n = nodeById(graph).get(node);
    if (!n) throw new Error(`unknown node "${node}"`);
    Object.assign(vars, { NODE: node, NODE_TITLE: n.title, NODE_SPEC: nodeSpec(graph, research, node) });
    if (learner) vars.BRIEF = brief(graph, learner, node);
  }
  return { ...vars, ...set };
}

export function renderPrompt(name, options) {
  if (!/^[a-z-]+$/.test(name)) throw new Error(`bad prompt name "${name}"`);
  const template = readFileSync(join(ROOT, 'prompts', `${name}.md`), 'utf8');
  return fillTemplate(template, buildVars(options));
}
