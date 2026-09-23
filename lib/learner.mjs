// The learner model. Every function is pure: it returns a new learner and never
// mutates its input. See docs/data-model.md for the shape.

import { topoOrder, nodeById, ancestors } from './graph.mjs';

const PASS_MARKS = { interview: 0.8, exam: 0.8, build: 0.7, curious: 0.6 };
const WARMUP_SIZE = 2;
const now = () => new Date().toISOString();

export function passMark(mode) {
  if (!(mode in PASS_MARKS)) throw new Error(`unknown goal mode "${mode}", expected one of ${Object.keys(PASS_MARKS).join(', ')}`);
  return PASS_MARKS[mode];
}

const withNode = (learner, id, patch) => ({
  ...learner,
  nodes: { ...learner.nodes, [id]: { ...learner.nodes[id], ...patch } },
});

const requireNode = (graph, id) => {
  if (!nodeById(graph).has(id)) throw new Error(`unknown node "${id}"`);
};

export const nodeOfKey = (key) => key.split('~')[0];

export const gateCount = (learner) => Object.values(learner.nodes).reduce((n, s) => n + s.attempts.length, 0);

// Recompute locked/ready from prereqs; mastered and in_progress are sticky.
export function deriveStates(graph, learner) {
  const nodes = Object.fromEntries(
    graph.nodes.map((n) => {
      const current = learner.nodes[n.id];
      if (current.state === 'mastered' || current.state === 'in_progress') return [n.id, current];
      const unlocked = (n.prereqs ?? []).every((p) => learner.nodes[p]?.state === 'mastered');
      return [n.id, { ...current, state: unlocked ? 'ready' : 'locked' }];
    }),
  );
  return { ...learner, nodes };
}

export function createLearner({ graph, run, profile }) {
  passMark(profile.mode);
  const nodes = Object.fromEntries(
    graph.nodes.map((n) => [n.id, { state: 'locked', mastery: 0, source: null, attempts: [], reviews: 0 }]),
  );
  const learner = { version: 1, topic: graph.topic, run, profile, nodes, misconceptions: [], questions: [], lessons: {}, map: null };
  return deriveStates(graph, learner);
}

// A right answer only counts if no prerequisite of that node was answered wrong;
// otherwise it was a guess or a lucky analogy from another language.
export function creditDiagnostic(graph, { known, unknown = [] }) {
  [...known, ...unknown].forEach((id) => requireNode(graph, id));
  const failed = new Set(unknown);
  const credited = known.filter((id) => ![...ancestors(graph, id)].some((a) => failed.has(a)));
  return { credited, discounted: known.filter((id) => !credited.includes(id)) };
}

// Knowing a node implies knowing everything it builds on.
export function applyDiagnostic(graph, learner, knownIds, { unknown = [], at = now() } = {}) {
  const { credited } = creditDiagnostic(graph, { known: knownIds, unknown });
  const known = new Set(credited.flatMap((id) => [id, ...ancestors(graph, id)]));
  const updated = [...known].reduce(
    (l, id) => withNode(l, id, { state: 'mastered', mastery: 1, source: 'diagnostic', mastered_at: at }),
    learner,
  );
  return deriveStates(graph, updated);
}

export function startNode(graph, learner, id) {
  requireNode(graph, id);
  const { state } = deriveStates(graph, learner).nodes[id];
  if (state === 'in_progress') return learner;
  if (state === 'locked') throw new Error(`node "${id}" is locked: finish its prereqs first`);
  if (state === 'mastered') throw new Error(`node "${id}" is already mastered`);
  return withNode(learner, id, { state: 'in_progress' });
}

// Lessons written ahead of time for not-yet-started nodes no longer reflect the
// learner after a gate: a fail makes them stale (rewrite), a pass with misses
// only needs a warmup patch aimed at what was missed.
function markLessons(learner, flag) {
  const keys = Object.entries(learner.lessons)
    .filter(([key, lesson]) => {
      const state = learner.nodes[nodeOfKey(key)]?.state;
      return !lesson.stale && !lesson[flag] && state !== 'in_progress' && state !== 'mastered';
    })
    .map(([key]) => key);
  const lessons = Object.fromEntries(
    Object.entries(learner.lessons).map(([key, lesson]) => [key, keys.includes(key) ? { ...lesson, [flag]: true } : lesson]),
  );
  return { learner: { ...learner, lessons }, keys };
}

export function recordGate(graph, learner, id, { score, missed = [], at = now() }) {
  requireNode(graph, id);
  if (learner.nodes[id].state !== 'in_progress') throw new Error(`node "${id}" is not in progress; start it before gating`);
  if (!Number.isFinite(score) || score < 0 || score > 1) throw new Error('score must be between 0 and 1');

  const passed = score >= passMark(learner.profile.mode);
  const attempts = [...learner.nodes[id].attempts, { at, score, missed }];
  const nodePatch = passed
    ? { state: 'mastered', mastery: score, source: 'gate', mastered_at: at, attempts }
    : { state: 'in_progress', mastery: score, attempts };
  // A pass resolves this node's earlier misconceptions, but what was missed on
  // this very gate stays open for the next lessons to target.
  const misconceptions = [
    ...learner.misconceptions.map((m) => (passed && m.node === id ? { ...m, resolved: true } : m)),
    ...missed.map((text) => ({ node: id, text, at, resolved: false })),
  ];
  const updated = deriveStates(graph, { ...withNode(learner, id, nodePatch), misconceptions });
  if (!passed) {
    const { learner: result, keys } = markLessons(updated, 'stale');
    return { learner: result, passed, stale: keys, patch: [] };
  }
  if (missed.length) {
    const { learner: result, keys } = markLessons(updated, 'patch');
    return { learner: result, passed, stale: [], patch: keys };
  }
  return { learner: updated, passed, stale: [], patch: [] };
}

export function recordLesson(learner, key, { kind, artifact, url, warmup = [] }) {
  const reviewed = warmup.reduce(
    (l, id) => (l.nodes[id] ? withNode(l, id, { reviews: (l.nodes[id].reviews ?? 0) + 1 }) : l),
    learner,
  );
  return {
    ...reviewed,
    lessons: { ...reviewed.lessons, [key]: { kind, artifact, url, stale: false, patch: false, written_after: gateCount(learner) } },
  };
}

export const noteQuestion = (learner, node, text, answer, { at = now() } = {}) => ({
  ...learner,
  questions: [...learner.questions, { node, text, answer, at }],
});

export const noteMisconception = (learner, node, text, { at = now() } = {}) => ({
  ...learner,
  misconceptions: [...learner.misconceptions, { node, text, at, resolved: false }],
});

export const setMap = (learner, { artifact, url }) => ({ ...learner, map: { artifact, url } });

const lessonNeed = (learner, key) => {
  const lesson = learner.lessons[key];
  if (!lesson) return 'missing';
  if (lesson.stale) return 'stale';
  return lesson.patch ? 'patch' : null;
};

function remedialNeed(learner, id) {
  const { attempts } = learner.nodes[id];
  const last = attempts[attempts.length - 1];
  if (!last || last.score >= passMark(learner.profile.mode)) return null;
  const key = `${id}~remedial-${attempts.filter((a) => a.score < passMark(learner.profile.mode)).length}`;
  return learner.lessons[key] ? null : { key, node: id, kind: 'remedial', reason: 'failed_gate', missed: last.missed };
}

function warmupFor(learner, order) {
  return order
    .filter((id) => learner.nodes[id].state === 'mastered' && learner.nodes[id].source === 'gate')
    .map((id) => ({ id, ...learner.nodes[id] }))
    .sort((a, b) => a.reviews - b.reviews || a.mastery - b.mastery || String(a.mastered_at).localeCompare(String(b.mastered_at)))
    .slice(0, WARMUP_SIZE)
    .map((n) => n.id);
}

// What to write next: the current lesson (or a remedial one after a failed gate)
// plus a small prefetch window, and which earlier nodes the next lesson should review.
export function plan(graph, learner, { prefetch = 1 } = {}) {
  const l = deriveStates(graph, learner);
  const order = topoOrder(graph);
  const byId = nodeById(graph);
  const current =
    order.find((id) => l.nodes[id].state === 'in_progress') ?? order.find((id) => l.nodes[id].state === 'ready') ?? null;
  const done = order.every((id) => l.nodes[id].state === 'mastered');
  if (!current) return { current: null, done, generate: [], warmup: [], passMark: passMark(l.profile.mode) };

  const generate = [];
  const remedial = remedialNeed(l, current);
  if (remedial) generate.push(remedial);
  const need = lessonNeed(l, current);
  if (need) generate.push({ key: current, node: current, kind: 'lesson', reason: need });

  const upcoming = order
    .filter((id) => id !== current && l.nodes[id].state !== 'mastered' && l.nodes[id].state !== 'in_progress')
    .filter((id) => (byId.get(id).prereqs ?? []).every((p) => p === current || l.nodes[p].state === 'mastered'))
    .slice(0, prefetch);
  for (const id of upcoming) {
    const reason = lessonNeed(l, id);
    if (reason) generate.push({ key: id, node: id, kind: 'lesson', reason, prefetch: true });
  }

  return { current, done, generate, warmup: warmupFor(l, order), passMark: passMark(l.profile.mode) };
}

const list = (items) => (items.length ? items.map((i) => `- ${i}`).join('\n') : '- none');

const attemptLines = (learner, id) =>
  learner.nodes[id].attempts.map((a) => `score ${a.score}; missed: ${a.missed.join('; ') || 'nothing'}`);

// A compact text summary handed to the lesson writer and grader. Warmup nodes'
// gate history is included because the warmup is written to target it.
export function brief(graph, learner, nodeId, { warmup = [] } = {}) {
  const byId = nodeById(graph);
  const node = byId.get(nodeId);
  if (!node) throw new Error(`unknown node "${nodeId}"`);
  const p = learner.profile;
  const mastered = topoOrder(graph)
    .filter((id) => learner.nodes[id].state === 'mastered')
    .map((id) => `${byId.get(id).title} (${id}; ${learner.nodes[id].source}${learner.nodes[id].source === 'gate' ? ` ${learner.nodes[id].mastery}` : ''})`);
  const open = learner.misconceptions.filter((m) => !m.resolved).map((m) => `[${m.node}] ${m.text}`);
  const asked = learner.questions.slice(-8).map((q) => `[${q.node}] ${q.text}${q.answer ? ` → ${q.answer}` : ''}`);

  return [
    '## Learner',
    `- goal: ${p.goal}`,
    `- mode: ${p.mode} (gate pass mark ${passMark(p.mode)})`,
    `- background: ${p.background}`,
    `- learning style: ${p.style}`,
    `- time: ${p.minutes_per_day ?? '?'} min/day${p.deadline ? `, deadline ${p.deadline}` : ''}`,
    '',
    '## Already mastered',
    list(mastered),
    '',
    ...[nodeId, ...warmup.filter((id) => id !== nodeId && learner.nodes[id])].flatMap((id) => [
      `## Gate attempts on ${id}`,
      list(attemptLines(learner, id)),
      '',
    ]),
    '## Open misconceptions (all nodes)',
    list(open),
    '',
    '## Recent questions the learner asked',
    list(asked),
  ].join('\n');
}
