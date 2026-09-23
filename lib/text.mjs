// Text helpers shared by the validator and the learner brief.

const CODE_SPAN = /`[^`]*`/g;
const CITATION = /\[(s\d+)\]/g;

export function extractCitations(md = '') {
  const withoutCode = md.replace(CODE_SPAN, ' ');
  return new Set([...withoutCode.matchAll(CITATION)].map((m) => m[1]));
}

export function wordCount(md = '') {
  const plain = md
    .replace(CITATION, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*`]/g, ' ');
  return plain.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

const questionTexts = (questions = []) =>
  questions.flatMap((q) => [q.q, ...(q.options ?? []).flatMap((o) => [o.text, o.why])]);

// Every piece of learner-facing text in a block, in reading order.
export function blockTexts(block) {
  switch (block.type) {
    case 'prose':
      return [block.md];
    case 'callout':
      return [block.title, block.md];
    case 'code':
      return [block.caption];
    case 'stepper':
      return [block.title, ...(block.steps ?? []).flatMap((s) => [s.label, s.md])];
    case 'worked_example':
      return [block.title, block.setup, ...(block.steps ?? []).map((s) => s.md), block.takeaway];
    case 'predict':
      return [block.prompt, block.answer];
    case 'quiz':
    case 'warmup':
      return questionTexts(block.questions);
    case 'exercise':
      return [block.prompt, ...(block.hints ?? []), block.solution];
    case 'clarification':
      return [block.question, block.md];
    default:
      return [];
  }
}

export function lessonTexts(lesson) {
  return (lesson.blocks ?? []).flatMap(blockTexts).filter((t) => typeof t === 'string');
}
