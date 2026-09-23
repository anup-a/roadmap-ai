// Skill graph validation and ordering. See docs/data-model.md.

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const nodeById = (graph) => new Map(graph.nodes.map((n) => [n.id, n]));

// Kahn's algorithm, ties broken by declaration order. Nodes on a cycle are left out.
export function topoOrder(graph) {
  const ids = graph.nodes.map((n) => n.id);
  const known = new Set(ids);
  const pending = new Map(graph.nodes.map((n) => [n.id, new Set((n.prereqs ?? []).filter((p) => known.has(p)))]));
  const order = [];
  while (order.length < ids.length) {
    const next = ids.find((id) => !order.includes(id) && pending.get(id).size === 0);
    if (!next) break;
    order.push(next);
    for (const deps of pending.values()) deps.delete(next);
  }
  return order;
}

export function validateGraph(graph, research = null) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const ids = nodes.map((n) => n.id);
  const known = new Set(ids);
  const researchIds = research ? new Set((research.sources ?? []).map((s) => s.id)) : null;
  const errors = [];

  if (graph?.version !== 1) errors.push('version must be 1');
  if (!graph?.topic) errors.push('missing "topic"');
  if (nodes.length < 6 || nodes.length > 30) errors.push(`graph needs 6 to 30 nodes, has ${nodes.length}`);

  for (const id of new Set(ids.filter((id, i) => ids.indexOf(id) !== i))) errors.push(`duplicate node id "${id}"`);
  for (const n of nodes) {
    if (!ID.test(n.id ?? '')) errors.push(`node id "${n.id}" must be kebab-case`);
    if (!n.title) errors.push(`node ${n.id}: missing title`);
    if (!n.summary) errors.push(`node ${n.id}: missing summary`);
    if (!Array.isArray(n.objectives) || n.objectives.length === 0) errors.push(`node ${n.id}: needs objectives`);
    for (const p of n.prereqs ?? []) if (!known.has(p)) errors.push(`node ${n.id}: unknown prereq "${p}"`);
    if (researchIds) {
      for (const s of n.sources ?? []) if (!researchIds.has(s)) errors.push(`node ${n.id}: unknown research source "${s}"`);
    }
  }

  const ordered = new Set(topoOrder(graph));
  const onCycle = [...new Set(ids)].filter((id) => !ordered.has(id));
  if (onCycle.length) errors.push(`prereqs form a cycle through: ${onCycle.join(', ')}`);

  return { ok: errors.length === 0, errors };
}

export function ancestors(graph, id) {
  const byId = nodeById(graph);
  const seen = new Set();
  const visit = (nid) => {
    for (const p of byId.get(nid)?.prereqs ?? []) {
      if (!seen.has(p)) {
        seen.add(p);
        visit(p);
      }
    }
  };
  visit(id);
  return seen;
}
