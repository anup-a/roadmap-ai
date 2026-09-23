// Mastery gate mechanics: option shuffling (models put the right answer first
// far too often) and scoring into the score + missed list the learner model takes.

const hash = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

function rng(seed) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const keyOf = (question) => question.options.findIndex((o) => o.correct);

export function prepareGate(gate, { seed }) {
  const questions = gate.questions.map((q, i) => ({ ...q, options: shuffled(q.options, rng(`${seed}:${i}`)) }));
  // A shuffle can still land every key on the same letter; rotate one so it doesn't.
  const keys = questions.map(keyOf);
  if (questions.length > 1 && new Set(keys).size === 1) {
    const last = questions[questions.length - 1];
    questions[questions.length - 1] = { ...last, options: [...last.options.slice(1), last.options[0]] };
  }
  return { ...gate, questions };
}

// answers: chosen option index per question; -1 means no valid choice (e.g. a free-text reply).
export function scoreGate(gate, answers) {
  const { questions } = gate;
  if (answers.length !== questions.length) throw new Error(`expected ${questions.length} answers, got ${answers.length}`);
  const results = questions.map((q, i) => {
    const choice = answers[i];
    if (!Number.isInteger(choice) || choice < -1 || choice >= q.options.length) {
      throw new Error(`question ${i + 1}: choice ${choice} is out of range`);
    }
    const picked = choice === -1 ? null : q.options[choice];
    return { objective: q.objective, correct: Boolean(picked?.correct), misconception: picked?.correct ? null : picked?.misconception ?? null, explain: q.explain };
  });
  const shown = new Set(results.filter((r) => r.correct).map((r) => r.objective));
  const notShown = [...new Set(results.map((r) => r.objective))].filter((o) => o && !shown.has(o));
  const missed = [
    ...new Set(results.filter((r) => r.misconception).map((r) => r.misconception)),
    ...notShown.map((o) => `objective not shown: ${o}`),
  ];
  const score = Math.round((results.filter((r) => r.correct).length / results.length) * 100) / 100;
  return { score, missed, results };
}
