// The inline markdown subset from docs/lesson-dsl.md, rendered to HTML.
//
// This is the security boundary for LLM-written lesson text: every character
// that is not part of a recognised construct is HTML-escaped, links are https
// only, and attribute values are always escaped. Nothing here emits raw input.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

const LINK_RE = /^\[([^[\]\n]+)\]\(([^()\s]+)\)/;
const CITE_RE = /^\[(s(\d+))\]/;

function httpsUrl(raw) {
  if (!/^https:\/\//i.test(raw)) return null;
  try {
    return new URL(raw).protocol === 'https:' ? raw : null;
  } catch {
    return null;
  }
}

// Index of the next closing delimiter at or after `from`, skipping code spans.
// For a single `*`, a `**` pair is skipped as a unit so `*a **b** c*` nests.
function findClose(text, from, delim) {
  let i = from;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '`') {
      const end = text.indexOf('`', i + 1);
      if (end === -1) return -1;
      i = end + 1;
      continue;
    }
    if (delim === '**' && text.startsWith('**', i)) return i;
    if (delim === '*' && ch === '*') {
      if (text[i + 1] === '*') {
        const end = text.indexOf('**', i + 2);
        if (end === -1) return -1;
        i = end + 2;
        continue;
      }
      return i;
    }
    i += 1;
  }
  return -1;
}

function citeHtml(id, n, sourceMap) {
  const src = sourceMap.get(id);
  return `<sup class="cite"><a href="#src-${escapeHtml(id)}" title="${escapeHtml(src.quote)}">${escapeHtml(n)}</a></sup>`;
}

function spanHtml(text, ctx) {
  let out = '';
  let plain = '';
  const flush = () => {
    out += escapeHtml(plain);
    plain = '';
  };
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    const ch = text[i];

    if (ch === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > i + 1) {
        flush();
        out += `<code>${escapeHtml(text.slice(i + 1, end))}</code>`;
        i = end + 1;
        continue;
      }
    }

    if (ch === '[') {
      const link = ctx.inLink ? null : LINK_RE.exec(rest);
      if (link) {
        const url = httpsUrl(link[2]);
        if (url) {
          flush();
          const label = spanHtml(link[1], { ...ctx, inLink: true });
          out += `<a href="${escapeHtml(url)}" rel="noopener" target="_blank">${label}</a>`;
        } else {
          plain += link[0];
        }
        i += link[0].length;
        continue;
      }
      const cite = CITE_RE.exec(rest);
      if (cite && ctx.sourceMap.has(cite[1]) && !ctx.inLink) {
        flush();
        out += citeHtml(cite[1], cite[2], ctx.sourceMap);
        i += cite[0].length;
        continue;
      }
    }

    if (ch === '*') {
      const delim = text.startsWith('**', i) ? '**' : '*';
      const start = i + delim.length;
      const end = text[start] && !/\s/.test(text[start]) ? findClose(text, start, delim) : -1;
      if (end > start && !/\s/.test(text[end - 1])) {
        flush();
        const tag = delim === '**' ? 'strong' : 'em';
        out += `<${tag}>${spanHtml(text.slice(start, end), ctx)}</${tag}>`;
        i = end + delim.length;
        continue;
      }
      plain += delim;
      i += delim.length;
      continue;
    }

    plain += ch;
    i += 1;
  }
  flush();
  return out;
}

function makeCtx(sources) {
  const sourceMap = new Map();
  for (const s of sources || []) if (s && typeof s.id === 'string') sourceMap.set(s.id, s);
  return { sourceMap, inLink: false };
}

/** Inline-only rendering (no <p>/<ul>): for question text, options, titles. */
export function renderSpan(md, { sources = [] } = {}) {
  if (md === null || md === undefined) return '';
  const text = String(md).replace(/\r\n?/g, '\n').replace(/\s*\n\s*/g, ' ').trim();
  return spanHtml(text, makeCtx(sources));
}

function renderParagraphBlock(lines, ctx) {
  const parts = [];
  let para = [];
  let items = [];
  const flushPara = () => {
    if (para.length) parts.push(`<p>${spanHtml(para.join('\n'), ctx)}</p>`);
    para = [];
  };
  const flushList = () => {
    if (items.length) parts.push(`<ul>${items.map((t) => `<li>${spanHtml(t, ctx)}</li>`).join('')}</ul>`);
    items = [];
  };
  for (const line of lines) {
    if (line.startsWith('- ')) {
      flushPara();
      items.push(line.slice(2).trim());
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return parts;
}

/** Block rendering: paragraphs split on blank lines, "- " lines become lists. */
export function renderInline(md, { sources = [] } = {}) {
  if (md === null || md === undefined) return '';
  const text = String(md).replace(/\r\n?/g, '\n').trim();
  if (!text) return '';
  const ctx = makeCtx(sources);
  return text
    .split(/\n[ \t]*\n/)
    .map((block) => block.split('\n').filter((l) => l.trim() !== ''))
    .filter((lines) => lines.length)
    .flatMap((lines) => renderParagraphBlock(lines, ctx))
    .join('\n');
}
