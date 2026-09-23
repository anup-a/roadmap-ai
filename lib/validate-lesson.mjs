// The deterministic half of the grader: structure, citations and depth.
// Accuracy and fit are judged by the LLM grader (prompts/grader.md).

import { extractCitations, wordCount, blockTexts, lessonTexts } from './text.mjs';

const TONES = ['note', 'warning', 'misconception'];

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

function checkQuestions(questions, where) {
  if (!Array.isArray(questions) || questions.length === 0) return [`${where}: needs at least one question`];
  return questions.flatMap((q, i) => {
    const at = `${where} question ${i + 1}`;
    const options = Array.isArray(q.options) ? q.options : [];
    const errors = [];
    if (!nonEmpty(q.q)) errors.push(`${at}: missing "q"`);
    if (options.length < 2 || options.length > 5) errors.push(`${at}: needs 2 to 5 options`);
    if (options.filter((o) => o.correct === true).length !== 1) errors.push(`${at}: needs exactly one correct option`);
    if (options.some((o) => !nonEmpty(o.text))) errors.push(`${at}: every option needs "text"`);
    if (options.some((o) => !nonEmpty(o.why))) errors.push(`${at}: every option needs a non-empty "why"`);
    return errors;
  });
}

const steps = (list, min, max, where, needsLabel = false) => {
  if (!Array.isArray(list) || list.length < min || list.length > max) return [`${where}: needs ${min} to ${max} steps`];
  return list.flatMap((s, i) => [
    ...(nonEmpty(s.md) ? [] : [`${where} step ${i + 1}: missing "md"`]),
    ...(needsLabel && !nonEmpty(s.label) ? [`${where} step ${i + 1}: missing "label"`] : []),
  ]);
};

const required = (block, fields, where) => fields.filter((f) => !nonEmpty(block[f])).map((f) => `${where}: missing "${f}"`);

const BLOCK_CHECKS = {
  warmup: (b, w) => [
    ...(Array.isArray(b.from) && b.from.length ? [] : [`${w}: "from" must list the reviewed node ids`]),
    ...checkQuestions(b.questions, w),
  ],
  prose: (b, w) => required(b, ['md'], w),
  callout: (b, w) => [...required(b, ['md'], w), ...(TONES.includes(b.tone) ? [] : [`${w}: tone must be one of ${TONES.join(', ')}`])],
  code: (b, w) => required(b, ['lang', 'code'], w),
  stepper: (b, w) => [...required(b, ['title'], w), ...steps(b.steps, 2, 12, w, true)],
  worked_example: (b, w) => [...required(b, ['title', 'setup', 'takeaway'], w), ...steps(b.steps, 1, 8, w)],
  predict: (b, w) => required(b, ['prompt', 'answer'], w),
  quiz: (b, w) => checkQuestions(b.questions, w),
  exercise: (b, w) => [
    ...required(b, ['prompt', 'solution'], w),
    ...(Array.isArray(b.hints) && b.hints.every(nonEmpty) ? [] : [`${w}: "hints" must be a list of strings`]),
  ],
  clarification: (b, w) => required(b, ['question', 'md'], w),
};

function checkHeader(lesson) {
  const errors = [];
  if (lesson.version !== 1) errors.push('version must be 1');
  if (!['lesson', 'remedial'].includes(lesson.kind)) errors.push('kind must be "lesson" or "remedial"');
  for (const f of ['topic', 'node', 'title']) if (!nonEmpty(lesson[f])) errors.push(`missing "${f}"`);
  if (!Number.isFinite(lesson.minutes) || lesson.minutes < 3 || lesson.minutes > 30) errors.push('minutes must be 3 to 30');
  const objectives = lesson.objectives ?? [];
  if (!Array.isArray(objectives) || objectives.length < 1 || objectives.length > 5 || !objectives.every(nonEmpty)) {
    errors.push('objectives must be 1 to 5 strings');
  }
  return errors;
}

function checkSources(lesson) {
  const sources = Array.isArray(lesson.sources) ? lesson.sources : [];
  const ids = sources.map((s) => s.id);
  const errors = sources.flatMap((s, i) => {
    const at = `source ${s.id ?? i + 1}`;
    return [
      ...(/^s\d+$/.test(s.id ?? '') ? [] : [`${at}: id must look like s1`]),
      ...(nonEmpty(s.title) ? [] : [`${at}: missing title`]),
      ...(/^https:\/\//.test(s.url ?? '') ? [] : [`${at}: url must be https`]),
      ...(nonEmpty(s.quote) && s.quote.length >= 30 && s.quote.length <= 400
        ? []
        : [`${at}: quote must be 30 to 400 characters copied verbatim from the page`]),
    ];
  });
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  const cited = new Set(lessonTexts(lesson).flatMap((t) => [...extractCitations(t)]));
  return [
    ...errors,
    ...[...new Set(dupes)].map((id) => `source ${id}: duplicate id`),
    ...[...cited].filter((id) => !ids.includes(id)).map((id) => `citation [${id}] is not declared in sources`),
    ...ids.filter((id) => !cited.has(id)).map((id) => `source ${id} is never cited`),
  ];
}

const count = (blocks, type) => blocks.filter((b) => b.type === type);

function checkShape(lesson, blocks, words, warmup) {
  const errors = [];
  if (lesson.kind === 'remedial') {
    if (!count(blocks, 'quiz').length) errors.push('remedial lesson needs a quiz');
    if (!blocks.some((b) => b.type === 'callout' && b.tone === 'misconception')) {
      errors.push('remedial lesson needs a callout with tone "misconception"');
    }
    if ((lesson.sources ?? []).length < 1) errors.push('remedial lesson needs at least 1 source');
    if (words < 150 || words > 1200) errors.push(`remedial lesson needs 150 to 1200 words, has ${words}`);
    return errors;
  }
  if (!count(blocks, 'worked_example').length) errors.push('lesson needs at least one worked_example');
  if (!count(blocks, 'exercise').length) errors.push('lesson needs at least one exercise');
  if (!count(blocks, 'quiz').some((q) => (q.questions ?? []).length >= 2)) errors.push('lesson needs a quiz with 2 or more questions');
  if ((lesson.sources ?? []).length < 2) errors.push('lesson needs at least 2 sources');
  if (words < 350 || words > 2500) errors.push(`lesson needs 350 to 2500 words, has ${words}`);
  if (warmup.length) {
    if (blocks[0]?.type !== 'warmup') errors.push(`first block must be a warmup reviewing: ${warmup.join(', ')}`);
    const covered = new Set(blocks[0]?.type === 'warmup' ? blocks[0].from : []);
    const missing = warmup.filter((id) => !covered.has(id));
    if (blocks[0]?.type === 'warmup' && missing.length) errors.push(`warmup does not review: ${missing.join(', ')}`);
  }
  return errors;
}

export function validateLesson(lesson, { warmup = [] } = {}) {
  const blocks = Array.isArray(lesson.blocks) ? lesson.blocks : [];
  const blockErrors = blocks.flatMap((b, i) => {
    const where = `block ${i + 1} (${b.type})`;
    const check = BLOCK_CHECKS[b.type];
    return check ? check(b, where) : [`block ${i + 1}: unknown block type "${b.type}"`];
  });
  // Clarifications grow the lesson from the learner's own questions, so they
  // are not held to the length cap meant for the writer.
  const countWords = (list) => list.flatMap(blockTexts).filter((t) => typeof t === 'string').reduce((n, t) => n + wordCount(t), 0);
  const words = countWords(blocks.filter((b) => b.type !== 'clarification'));
  const clarificationWords = countWords(blocks.filter((b) => b.type === 'clarification'));
  const errors = [
    ...checkHeader(lesson),
    ...(blocks.length ? [] : ['lesson has no blocks']),
    ...blockErrors,
    ...checkSources(lesson),
    ...checkShape(lesson, blocks, words, warmup),
  ];
  return {
    ok: errors.length === 0,
    errors,
    stats: { words, clarification_words: clarificationWords, blocks: blocks.length, sources: (lesson.sources ?? []).length },
  };
}
