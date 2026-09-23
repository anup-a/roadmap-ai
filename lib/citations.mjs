// Checks that every source quote in a lesson really appears on the cited page.
// Whether the quote supports the claim is the LLM grader's job; this only
// proves the quote was not made up.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const FOUND_AT = 0.9;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);

export function htmlToText(html) {
  const text = html
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, '');
  return decode(text).replace(/\s+/g, ' ').trim();
}

const normalize = (s) =>
  s
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

// Length of the longest common substring, with one DP row.
function longestCommon(a, b) {
  let prev = new Uint16Array(b.length + 1);
  let best = 0;
  for (let i = 1; i <= a.length; i++) {
    const row = new Uint16Array(b.length + 1);
    for (let j = 1; j <= b.length; j++) {
      if (a.charCodeAt(i - 1) === b.charCodeAt(j - 1)) {
        row[j] = prev[j - 1] + 1;
        if (row[j] > best) best = row[j];
      }
    }
    prev = row;
  }
  return best;
}

export function quoteMatch(quote, pageText) {
  const q = normalize(quote);
  const t = normalize(pageText);
  if (!q) return { found: false, score: 0 };
  if (t.includes(q)) return { found: true, score: 1 };
  const score = Math.round((longestCommon(q, t) / q.length) * 100) / 100;
  return { found: score >= FOUND_AT, score };
}

export async function curlFetch(url) {
  const { stdout } = await run('curl', ['-sSfL', '--max-time', '25', '-A', 'Mozilla/5.0 (learnpath citation check)', url], {
    maxBuffer: 20 * 1024 * 1024,
  });
  return stdout;
}

// Raw page text around each case-insensitive match, so writers copy quotes
// verbatim instead of paraphrasing from memory.
export function snippets(text, phrase, { radius = 300, limit = 5 } = {}) {
  const hay = text.toLowerCase();
  const needle = phrase.toLowerCase();
  const found = [];
  for (let at = hay.indexOf(needle); at !== -1 && found.length < limit; at = hay.indexOf(needle, at + needle.length)) {
    found.push(text.slice(Math.max(0, at - radius), at + needle.length + radius));
  }
  return found;
}

export async function checkCitations(lesson, { fetcher = curlFetch } = {}) {
  const pages = new Map();
  const load = (url) => {
    if (!pages.has(url)) pages.set(url, fetcher(url).then(htmlToText));
    return pages.get(url);
  };
  const results = await Promise.all(
    (lesson.sources ?? []).map(async (s) => {
      try {
        const { found, score } = quoteMatch(s.quote, await load(s.url));
        return { id: s.id, url: s.url, status: found ? 'verified' : 'not_found', score };
      } catch (err) {
        return { id: s.id, url: s.url, status: 'fetch_failed', error: String(err.message ?? err).slice(0, 300) };
      }
    }),
  );
  return { ok: results.every((r) => r.status === 'verified'), results };
}
