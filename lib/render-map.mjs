// graph.json + learner.json -> a self-contained skill map page.
// Stages (prerequisite depth, stage 1 = no prereqs) sit on one vertical spine and
// their topics branch left and right, so the map grows down, never sideways.

import { escapeHtml } from './inline-md.mjs';
import { FONT_LINKS, BASE_CSS, CREDIT, safeHref } from './render-lesson.mjs';

const STATES = ['locked', 'ready', 'in_progress', 'mastered'];
const STATE_LABEL = { locked: 'Locked', ready: 'Ready', in_progress: 'In progress', mastered: 'Mastered' };
const MAX_NEEDS = 2;

function nodeIndex(graph) {
  const byId = new Map();
  for (const n of graph.nodes || []) byId.set(n.id, n);
  for (const n of byId.values()) {
    for (const p of n.prereqs || []) {
      if (!byId.has(p)) throw new Error(`Node "${n.id}" has unknown prereq "${p}"`);
    }
  }
  return byId;
}

function depths(byId) {
  const depth = new Map();
  const visiting = new Set();
  const visit = (id) => {
    if (depth.has(id)) return depth.get(id);
    if (visiting.has(id)) throw new Error(`Cycle in graph at "${id}"`);
    visiting.add(id);
    const prereqs = byId.get(id).prereqs || [];
    const d = prereqs.length ? 1 + Math.max(...prereqs.map(visit)) : 0;
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };
  for (const id of byId.keys()) visit(id);
  return depth;
}

/** Node ids grouped by depth (longest prereq chain from a root), ordered to reduce edge crossings. */
export function layoutLayers(graph) {
  const byId = nodeIndex(graph);
  const depth = depths(byId);
  const layers = [];
  for (const id of byId.keys()) (layers[depth.get(id)] ||= []).push(id);
  const row = new Map();
  layers.forEach((layer, li) => {
    if (li > 0) {
      const bary = (id) => {
        const ps = byId.get(id).prereqs;
        return ps.reduce((sum, p) => sum + row.get(p), 0) / ps.length;
      };
      const keyed = layer.map((id, i) => ({ id, i, b: bary(id) }));
      keyed.sort((x, y) => x.b - y.b || x.i - y.i);
      layers[li] = keyed.map((k) => k.id);
    }
    layers[li].forEach((id, i) => row.set(id, i));
  });
  return layers;
}

/** mastered / in_progress come from the learner; ready / locked are always derived. */
export function deriveStates(graph, learner) {
  const stored = (id) => learner?.nodes?.[id]?.state;
  const out = {};
  for (const n of graph.nodes || []) {
    const s = stored(n.id);
    if (s === 'mastered' || s === 'in_progress') out[n.id] = s;
    else out[n.id] = (n.prereqs || []).every((p) => stored(p) === 'mastered') ? 'ready' : 'locked';
  }
  return out;
}

const GLYPH = {
  mastered: '<svg class="glyph" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M4.6 8.3l2.2 2.2 4.6-4.8" fill="none" stroke="var(--sheet)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  in_progress: '<svg class="glyph" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 1.8a6.2 6.2 0 0 1 0 12.4z" fill="currentColor"/></svg>',
  ready: '<svg class="glyph" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>',
  locked: '<svg class="glyph" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.4 2.2"/></svg>',
};

// Without wires, a locked card says what it is still waiting on.
function needsLine(n, state, states, byId) {
  if (state !== 'locked') return '';
  const unmet = (n.prereqs || []).filter((p) => states[p] !== 'mastered').map((p) => byId.get(p).title || p);
  if (!unmet.length) return '';
  const more = unmet.length > MAX_NEEDS ? ` +${unmet.length - MAX_NEEDS}` : '';
  return `<span class="n-needs">Needs <em>${escapeHtml(unmet.slice(0, MAX_NEEDS).join(', '))}</em>${more}</span>`;
}

function nodeCard(n, state, url, states, byId) {
  const summary = n.summary ? `<span class="n-sum">${escapeHtml(n.summary)}</span>` : '';
  const inner = `<span class="n-state">${GLYPH[state]}${STATE_LABEL[state]}</span>`
    + `<span class="n-title">${escapeHtml(n.title || n.id)}</span>${summary}${needsLine(n, state, states, byId)}`;
  const attrs = `data-node="${escapeHtml(n.id)}" data-state="${state}" data-prereqs="${escapeHtml((n.prereqs || []).join(' '))}" title="${escapeHtml(n.summary || n.title || n.id)}"`;
  return url
    ? `<a class="node node-${state} has-lesson" href="${escapeHtml(url)}" ${attrs}>${inner}<span class="n-go" aria-hidden="true">Lesson</span></a>`
    : `<div class="node node-${state}" ${attrs}>${inner}</div>`;
}

// Stage pills on the centre line; a stage's topics alternate left and right of it.
function spine(graph, layers, states, lessonUrls) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const card = (id) => nodeCard(byId.get(id), states[id], safeHref(lessonUrls[id]), states, byId);
  const stages = layers.map((ids, i) => {
    const done = ids.every((id) => states[id] === 'mastered');
    const side = (parity) => ids.filter((_, j) => j % 2 === parity).map(card).join('\n');
    return `<div class="pill${done ? ' done' : ''}">Stage ${i + 1}</div>\n`
      + `<div class="col l">${side(0)}\n</div>\n<div class="col r">${side(1)}\n</div>`;
  });
  return `<div class="spine" id="map">\n${stages.join('\n')}\n</div>`;
}

// Hovering a topic lights up what it needs and what it unlocks, and fades the rest.
const HOVER_JS = `(()=>{const m=document.getElementById('map');if(!m)return;
const cards=[...m.querySelectorAll('.node')];
const rel=(el)=>{const id=el.dataset.node;const s=new Set(el.dataset.prereqs.split(' ').filter(Boolean));
for(const c of cards)if(c.dataset.prereqs.split(' ').includes(id))s.add(c.dataset.node);return s;};
for(const el of cards){el.addEventListener('mouseenter',()=>{const s=rel(el);m.classList.add('hovering');
for(const c of cards){c.classList.toggle('rel',s.has(c.dataset.node));c.classList.toggle('me',c===el);}});
el.addEventListener('mouseleave',()=>m.classList.remove('hovering'));}})();`;

const MAP_CSS = `
.page{width:min(100% - 2.5rem,76rem);margin-inline:auto;padding:2.25rem 0 0}
.top{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:1.5rem 3rem;align-items:end;margin-bottom:1.75rem}
@media (max-width:52rem){.top{grid-template-columns:1fr}}
h1{font:780 clamp(2.3rem,6vw,4rem)/.98 var(--display);letter-spacing:-.03em;margin:.6rem 0 1rem;font-variation-settings:"opsz" 96}
.goal{font:400 1.1rem/1.5 var(--body);margin:0;max-width:40ch}
.goal b{font:600 .72rem/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-right:.5rem}
.chip{display:inline-block;font:600 .75rem/1 var(--mono);padding:.35rem .55rem;border-radius:999px;border:1px solid var(--rule);background:var(--sheet);margin-left:.4rem;vertical-align:.15em}
.progress p{margin:0 0 .6rem;font:650 1.15rem/1.3 var(--display)}
.progress p span{font:500 .8rem/1 var(--mono);color:var(--muted);margin-left:.4rem}
.strip{display:flex;gap:3px;height:12px}
.strip i{flex:1;border-radius:2px;background:var(--rule)}
.strip .s-mastered{background:var(--moss)}.strip .s-in_progress{background:var(--marker)}
.strip .s-ready{background:transparent;box-shadow:inset 0 0 0 2px var(--cobalt)}
.strip .s-locked{background:transparent;box-shadow:inset 0 0 0 1px var(--rule)}
.legend{display:flex;flex-wrap:wrap;gap:.4rem 1.25rem;margin:.9rem 0 0;padding:0;list-style:none;font:500 .78rem/1.4 var(--mono);color:var(--muted)}
.legend li{display:flex;align-items:center;gap:.4rem}
.legend .glyph{width:14px;height:14px}
.legend b{color:var(--ink);font-weight:700}
.next{margin:0 0 1.25rem;font:400 .98rem/1.5 var(--body)}
.next b{font:600 .72rem/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-right:.5rem}
.spine{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 3rem minmax(0,1fr);row-gap:.7rem;padding-bottom:1rem}
.spine::before{content:"";position:absolute;left:50%;top:.5rem;bottom:0;width:2px;margin-left:-1px;background:var(--rule)}
.pill{grid-column:1/-1;justify-self:center;position:relative;margin:1.25rem 0 .35rem;padding:.42rem .8rem;border:1px solid var(--rule);border-radius:999px;
background:var(--paper);font:600 .68rem/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.pill.done{color:var(--moss);border-color:var(--moss)}
.col{display:flex;flex-direction:column;gap:.7rem;min-width:0}
.col.l{grid-column:1}.col.r{grid-column:3}
.col .node::after{content:"";position:absolute;top:1.35rem;width:1.5rem;height:2px;background:var(--rule)}
.col.l .node::after{right:calc(-1.5rem - 1.5px)}.col.r .node::after{left:calc(-1.5rem - 1.5px)}
.col .node-mastered::after{background:var(--moss)}
@media (max-width:48rem){.spine{grid-template-columns:1.5rem minmax(0,1fr)}.spine::before{left:.75rem}
.col.l,.col.r{grid-column:2}.pill{justify-self:start;margin-left:-.1rem}
.col.l .node::after,.col.r .node::after{left:calc(-.75rem - 1.5px);right:auto;width:.75rem}}
.node{position:relative;display:flex;flex-direction:column;gap:.3rem;padding:.75rem .9rem .85rem;
border-radius:10px;border:1.5px solid var(--rule);background:var(--paper);color:var(--ink);text-decoration:none;transition:opacity .15s,box-shadow .15s}
.n-needs{font:400 .78rem/1.35 var(--body);color:var(--muted);margin-top:.15rem}
.n-needs em{font-style:normal;color:var(--ink)}
.hovering .node{opacity:.35}
.hovering .node.rel,.hovering .node.me{opacity:1}
.hovering .node.rel{border-color:var(--cobalt)}
.n-state{display:flex;align-items:center;gap:.4rem;font:700 .64rem/1 var(--mono);letter-spacing:.08em;text-transform:uppercase}
.glyph{width:15px;height:15px;flex:none}
.n-title{font:650 1.02rem/1.2 var(--display);letter-spacing:-.005em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;flex:none}
.n-sum{font:400 .8rem/1.35 var(--body);color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.n-go{position:absolute;top:.7rem;right:.8rem;font:600 .64rem/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--cobalt)}
.n-go::after{content:"\\00a0\\2192"}
a.node:hover{transform:translateY(-2px);box-shadow:0 6px 18px -8px rgba(22,32,51,.35)}
.node-mastered{background:var(--moss-soft);border-color:var(--moss)}
.node-mastered .n-state{color:var(--moss)}
.node-in_progress{background:var(--sheet);border:2px solid var(--marker);box-shadow:0 0 0 4px var(--marker-soft)}
.node-in_progress .n-state{color:var(--ink)}.node-in_progress .glyph{color:#C9A30A}
.node-ready{background:var(--sheet);border:2px solid var(--cobalt)}
.node-ready .n-state{color:var(--cobalt)}
.node-locked{background:var(--sheet);border-style:dashed;color:var(--muted)}
.node-locked .n-title{color:var(--muted);font-weight:550}
.node-locked .n-state{color:var(--muted)}
.legend .l-mastered{color:var(--moss)}.legend .l-in_progress{color:#C9A30A}.legend .l-ready{color:var(--cobalt)}
@media (prefers-color-scheme:dark){.node-in_progress .glyph,.legend .l-in_progress{color:var(--marker)}}
@media (prefers-reduced-motion:no-preference){a.node{transition:transform .15s,box-shadow .15s}
.node-in_progress{animation:breathe 2.8s ease-in-out infinite}
@keyframes breathe{50%{box-shadow:0 0 0 7px var(--marker-soft)}}}
`;

function header(graph, learner, states, layers) {
  const order = layers.flat();
  const total = order.length;
  const count = (s) => order.filter((id) => states[id] === s).length;
  const profile = learner?.profile || {};
  const strip = order.map((id) => `<i class="s-${states[id]}"></i>`).join('');
  const legend = [...STATES].reverse().map((s) => `<li class="l-${s}">${GLYPH[s]}<span>${STATE_LABEL[s]} <b>${count(s)}</b></span></li>`).join('');
  const mode = profile.mode ? `<span class="chip">${escapeHtml(profile.mode)} mode</span>` : '';
  return `<header class="top"><div><span class="eyebrow">Skill map · ${escapeHtml(graph.topic)}</span>`
    + `<h1>${escapeHtml(graph.title || graph.topic)}</h1>`
    + `<p class="goal"><b>Goal</b>${escapeHtml(profile.goal || 'Not set')}${mode}</p></div>`
    + `<div class="progress"><p>${count('mastered')} of ${total} mastered<span>${count('in_progress')} in progress</span></p>`
    + `<div class="strip" role="img" aria-label="${count('mastered')} of ${total} topics mastered">${strip}</div>`
    + `<ul class="legend" aria-label="Legend">${legend}</ul></div></header>`;
}

function upNext(graph, states, lessonUrls, remedialUrls) {
  const pick = (s) => graph.nodes.filter((n) => states[n.id] === s);
  const nodes = [...pick('in_progress'), ...pick('ready')].slice(0, 3);
  if (!nodes.length) return '';
  const items = nodes.map((n) => {
    const url = safeHref(lessonUrls[n.id]);
    const review = safeHref(remedialUrls[n.id]);
    const main = url ? `<a href="${escapeHtml(url)}">${escapeHtml(n.title)}</a>` : escapeHtml(n.title);
    // A node's cards link to its main lesson; after a failed gate the review lesson is read first.
    return review ? `<a href="${escapeHtml(review)}">Review first: ${escapeHtml(n.title)}</a>, then ${main}` : main;
  });
  return `<p class="next"><b>Up next</b>${items.join(' · ')}</p>`;
}

export function renderMap(graph, learner, { lessonUrls = {}, remedialUrls = {} } = {}) {
  const layers = layoutLayers(graph);
  const states = deriveStates(graph, learner);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(graph.title || graph.topic)} · skill map</title>
${FONT_LINKS}
<style>${BASE_CSS}${MAP_CSS}</style>
</head>
<body>
<div class="page">
${header(graph, learner, states, layers)}
${upNext(graph, states, lessonUrls, remedialUrls)}
${spine(graph, layers, states, lessonUrls)}
</div>
${CREDIT}
<script>${HOVER_JS}</script>
</body>
</html>
`;
}
