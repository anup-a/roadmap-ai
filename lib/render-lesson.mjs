// Lesson DSL (docs/lesson-dsl.md) -> one self-contained HTML document.
// All lesson text goes through lib/inline-md.mjs or escapeHtml; nothing from the
// lesson JSON is ever written into the page unescaped.

import { renderInline, renderSpan, escapeHtml } from './inline-md.mjs';

// ---- Code token highlighting ------------------------------------------------
// Tokenise the raw code, then escape every token on output. Nothing is matched
// against already-escaped text, so no entity can be split or smuggled.

const KEYWORDS = {
  rust: 'as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while',
  js: 'as async await break case catch class const continue default delete do else export extends false finally for from function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield',
  python: 'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return self True try while with yield',
  go: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false',
};
KEYWORDS.ts = `${KEYWORDS.js} interface type enum implements readonly private public protected declare keyof`;
const LANG_ALIASES = { rs: 'rust', javascript: 'js', jsx: 'js', mjs: 'js', typescript: 'ts', tsx: 'ts', py: 'python', golang: 'go' };

const DQ = String.raw`"(?:\\[\s\S]|[^"\\\n])*"`;
const SQ = String.raw`'(?:\\[\s\S]|[^'\\\n])*'`;
const BT = String.raw`\`(?:\\[\s\S]|[^\`\\])*\``;
const C_COMMENT = String.raw`\/\/[^\n]*|\/\*[\s\S]*?\*\/`;
const TOKEN_PARTS = {
  rust: { com: C_COMMENT, str: `${DQ}|'(?:\\\\.|[^'\\\\\\n])'`, mac: String.raw`#!?\[[^\]\n]*\]` },
  js: { com: C_COMMENT, str: `${DQ}|${SQ}|${BT}` },
  ts: { com: C_COMMENT, str: `${DQ}|${SQ}|${BT}` },
  python: { com: '#[^\\n]*', str: `"""[\\s\\S]*?"""|'''[\\s\\S]*?'''|${DQ}|${SQ}`, mac: '@\\w+' },
  go: { com: C_COMMENT, str: `${DQ}|${BT}|${SQ}` },
};

function tokenize(code, lang) {
  const parts = TOKEN_PARTS[lang];
  const kw = new Set(KEYWORDS[lang].split(' '));
  const re = new RegExp(`(${parts.com})|(${parts.str})|(${parts.mac || '(?!)'})|(\\b\\d[\\d_]*(?:\\.\\d+)?\\b)|([A-Za-z_]\\w*!?)|([\\s\\S])`, 'g');
  const tokens = [];
  let m;
  while ((m = re.exec(code))) {
    let cls = null;
    if (m[1]) cls = 't-com';
    else if (m[2]) cls = 't-str';
    else if (m[3]) cls = 't-mac';
    else if (m[4]) cls = 't-num';
    else if (m[5]) {
      if (kw.has(m[5])) cls = 't-kw';
      else if (lang === 'rust' && m[5].endsWith('!')) cls = 't-mac';
      else if (/^[A-Z]/.test(m[5])) cls = 't-ty';
    }
    tokens.push({ cls, text: m[0] });
  }
  return tokens;
}

/** Returns one HTML string per source line (safe: every token is escaped). */
export function highlightLines(code, lang) {
  const key = LANG_ALIASES[String(lang || '').toLowerCase()] || String(lang || '').toLowerCase();
  const tokens = TOKEN_PARTS[key] ? tokenize(code, key) : [{ cls: null, text: code }];
  const lines = [''];
  for (const { cls, text } of tokens) {
    text.split('\n').forEach((piece, i) => {
      if (i > 0) lines.push('');
      if (piece) lines[lines.length - 1] += cls ? `<span class="${cls}">${escapeHtml(piece)}</span>` : escapeHtml(piece);
    });
  }
  return lines;
}

export const FONT_LINKS = [
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Literata:ital,opsz,wght@0,7..72,400..700;1,7..72,400..600&family=JetBrains+Mono:wght@400;500;700&display=swap">',
].join('\n');

// Slate paper, navy ink, cobalt for anything you can act on, highlighter
// yellow for emphasis, moss for "got it", crimson for "not quite".
export const BASE_CSS = `
:root{color-scheme:light dark;
--paper:#EDF1F5;--sheet:#FAFBFD;--ink:#162033;--muted:#566276;--rule:#CBD3DE;
--cobalt:#2F45C8;--cobalt-soft:#DFE4FB;--marker:#F2CF3A;--marker-soft:rgba(242,207,58,.5);
--moss:#1F6E4B;--moss-soft:#DAEEE2;--crimson:#AE2846;--crimson-soft:#F8E1E6;--code-bg:#E3E9F1;
--display:"Bricolage Grotesque",ui-sans-serif,system-ui,sans-serif;
--body:"Literata",Georgia,serif;--mono:"JetBrains Mono",ui-monospace,Menlo,monospace}
@media (prefers-color-scheme:dark){:root{
--paper:#0E131A;--sheet:#151C26;--ink:#E2E7EF;--muted:#909BAD;--rule:#2B3545;
--cobalt:#95A5FF;--cobalt-soft:#1F284F;--marker:#F2CF3A;--marker-soft:rgba(242,207,58,.26);
--moss:#62C995;--moss-soft:#13301F;--crimson:#FF8199;--crimson-soft:#3B1521;--code-bg:#0A0E14}}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:400 1.0625rem/1.7 var(--body);
font-optical-sizing:auto;text-rendering:optimizeLegibility}
a{color:var(--cobalt);text-underline-offset:.18em;text-decoration-thickness:1px}
a:hover{text-decoration-thickness:2px}
:focus-visible{outline:2px solid var(--cobalt);outline-offset:3px;border-radius:3px}
code,kbd,pre{font-family:var(--mono);font-size:.86em;font-variant-ligatures:none}
.eyebrow{font:500 .72rem/1.4 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.credit{font:400 .78rem/1.5 var(--mono);color:var(--muted);text-align:center;padding:2.5rem 1rem 3rem}
.credit a{color:inherit}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

export function safeHref(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) {
    try { new URL(u); return u; } catch { return null; }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith('//') || /[\s\\]/.test(u)) return null;
  return u;
}

export const CREDIT = '<p class="credit">Made with <a href="https://byagent.dev" rel="noopener" target="_blank">byagent</a></p>';

const LESSON_CSS = `
.wrap{width:min(100% - 2.5rem,44rem);margin-inline:auto}
header.lesson-head{padding:2.25rem 0 2rem;border-bottom:1px solid var(--rule);margin-bottom:2.5rem}
.head-row{display:flex;flex-wrap:wrap;gap:.5rem 1rem;align-items:center;margin-bottom:1.75rem}
.head-row .back{font:500 .8rem/1 var(--mono);text-decoration:none;padding:.45rem .7rem .45rem .55rem;
border:1px solid var(--rule);border-radius:999px;background:var(--sheet)}
.head-row .back::before{content:"\\2190\\00a0"}
.badge-remedial{font:700 .7rem/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;
background:var(--marker);color:#1d1a05;padding:.4rem .55rem;border-radius:4px}
h1{font:750 clamp(2.2rem,5.5vw,3.5rem)/1.02 var(--display);letter-spacing:-.025em;margin:0 0 1rem;
font-variation-settings:"opsz" 96;text-wrap:balance}
.meta{font:500 .82rem/1.4 var(--mono);color:var(--muted);margin:0 0 1.5rem}
.objectives{background:var(--sheet);border:1px solid var(--rule);border-radius:10px;padding:1rem 1.25rem 1.1rem}
.objectives h2{font:600 .95rem/1.3 var(--display);margin:0 0 .4rem}
.objectives ul{margin:0;padding:0;list-style:none}
.objectives li{padding-left:1.4rem;position:relative;margin:.3rem 0}
.objectives li::before{content:"";position:absolute;left:.1rem;top:.62em;width:.55rem;height:.55rem;
border:2px solid var(--cobalt);border-radius:2px}
main{counter-reset:blk}
.blk{position:relative;margin:0 0 2.75rem}
.blk-label{display:block;margin:0 0 .6rem}
@media (min-width:68rem){.blk-label{position:absolute;right:calc(100% + 1.75rem);top:.3rem;width:8.5rem;
text-align:right;margin:0}
.blk-label::after{content:"";display:block;margin:.5rem 0 0 auto;width:1.75rem;border-top:2px solid var(--marker)}}
.prose p,.md p{margin:0 0 1em}.prose p:last-child,.md p:last-child,.md ul:last-child{margin-bottom:0}
.prose ul,.md ul{margin:0 0 1em;padding-left:1.25rem}
.prose strong,.md strong{font-weight:650;background:linear-gradient(transparent 58%,var(--marker-soft) 58%);
padding:0 .08em;-webkit-box-decoration-break:clone;box-decoration-break:clone}
:not(pre)>code{background:var(--code-bg);padding:.08em .34em;border-radius:4px;font-size:.84em}
sup.cite{font:600 .68rem/0 var(--mono);margin-left:.1em}
sup.cite a{text-decoration:none;padding:0 .15em}sup.cite a::before{content:"["}sup.cite a::after{content:"]"}
h3.blk-title{font:650 1.3rem/1.25 var(--display);letter-spacing:-.01em;margin:0 0 .8rem}
.callout{border-left:4px solid var(--cobalt);background:var(--cobalt-soft);padding:1rem 1.25rem;border-radius:0 10px 10px 0}
.callout-warning{border-color:var(--marker);background:var(--marker-soft)}
.callout-misconception{border-color:var(--crimson);background:var(--crimson-soft)}
.callout .tone{font:700 .7rem/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;margin:0 0 .5rem;color:var(--cobalt)}
.callout-warning .tone{color:var(--ink)}.callout-misconception .tone{color:var(--crimson)}
.callout .ctitle{font:650 1.1rem/1.3 var(--display);margin:0 0 .4rem}
.callout-misconception .ctitle{text-decoration:line-through;text-decoration-color:var(--crimson);text-decoration-thickness:2px}
figure.code{margin:0;background:var(--code-bg);border-radius:10px;overflow:hidden;border:1px solid var(--rule)}
.code-head{display:flex;justify-content:space-between;gap:1rem;align-items:center;padding:.5rem .9rem;
border-bottom:1px solid var(--rule);font:500 .72rem/1.4 var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.code-head a{text-transform:none;letter-spacing:0;font-weight:600}
.code-head a::after{content:"\\00a0\\2197"}
figure.code pre{margin:0;padding:.85rem 0;overflow-x:auto;line-height:1.6}
figure.code code{counter-reset:ln;display:block;min-width:max-content}
.ln{display:inline-block;min-width:100%;padding:0 1.1rem 0 0}
.ln::before{counter-increment:ln;content:counter(ln);display:inline-block;width:3.2ch;margin-right:1.4ch;
text-align:right;color:var(--muted);opacity:.7;user-select:none}
.ln.hl{background:var(--marker-soft);box-shadow:inset 3px 0 0 var(--marker)}
.ln.hl::before{opacity:1;color:var(--ink);font-weight:700}
figure.code figcaption{font:italic 400 .9rem/1.5 var(--body);color:var(--muted);padding:.55rem .95rem .7rem;border-top:1px solid var(--rule)}
.t-kw{color:var(--cobalt);font-weight:600}.t-str{color:var(--moss)}.t-com{color:var(--muted);font-style:italic}
.t-num,.t-mac{color:var(--crimson)}.t-ty{font-weight:600}
.card{background:var(--sheet);border:1px solid var(--rule);border-radius:12px;padding:1.25rem 1.35rem}
.md figure.code,.step figure.code,.worked-steps figure.code{margin-top:.8rem}
.stepper .steps{list-style:none;margin:0;padding:0}
.step{margin:0 0 1.25rem}.step:last-child{margin:0}
.step-label{font:600 .78rem/1.3 var(--mono);color:var(--cobalt);margin:0 0 .35rem}
.js .step:not(.is-current){display:none}
.stepper-nav{display:flex;align-items:center;gap:.75rem;margin-top:1.25rem;padding-top:1rem;border-top:1px dashed var(--rule)}
.dots{display:flex;flex:1;min-width:0;flex-wrap:wrap;align-items:center;justify-content:center;gap:.45rem clamp(.4rem,2.5vw,1.4rem)}
.dot{width:1.9rem;height:1.9rem;border-radius:50%;border:2px solid var(--rule);background:var(--sheet);
font:600 .72rem/1 var(--mono);color:var(--muted);cursor:pointer;padding:0;flex:none}
@media (max-width:30rem){.dot{width:1.6rem;height:1.6rem}.stepper-nav{gap:.5rem}.stepper-nav .btn{padding:.6rem .7rem}}
.dot.is-done{border-color:var(--cobalt);color:var(--cobalt)}
.dot[aria-current="step"]{background:var(--cobalt);border-color:var(--cobalt);color:var(--sheet)}
.btn{font:600 .88rem/1 var(--display);padding:.65rem 1rem;border-radius:8px;border:1.5px solid var(--cobalt);
background:var(--sheet);color:var(--cobalt);cursor:pointer}
.btn:hover:not(:disabled){background:var(--cobalt-soft)}
.btn.primary{background:var(--cobalt);color:var(--sheet)}
.btn.primary:hover:not(:disabled){filter:brightness(1.1);background:var(--cobalt)}
.btn:disabled{opacity:.4;cursor:default}
.no-js .js-only{display:none!important}
.worked .setup{margin:0 0 1rem}
.worked-steps{list-style:none;margin:0 0 1.1rem;padding:0;counter-reset:ws}
.worked-steps li{counter-increment:ws;position:relative;padding:0 0 1.1rem 2.6rem}
.worked-steps li::before{content:counter(ws);position:absolute;left:0;top:.1rem;width:1.75rem;height:1.75rem;
border-radius:50%;background:var(--ink);color:var(--paper);font:700 .78rem/1.75rem var(--mono);text-align:center}
.worked-steps li:not(:last-child)::after{content:"";position:absolute;left:.84rem;top:2.1rem;bottom:.2rem;border-left:2px solid var(--rule)}
.takeaway{border-top:2px solid var(--marker);padding-top:.75rem}
.takeaway .eyebrow{display:block;margin-bottom:.25rem}
.predict label{display:block;font:600 .9rem/1.3 var(--display);margin:1rem 0 .4rem}
.predict textarea{width:100%;min-height:4.5rem;resize:vertical;font:400 .95rem/1.5 var(--mono);color:var(--ink);
background:var(--paper);border:1.5px solid var(--rule);border-radius:8px;padding:.6rem .75rem}
.predict textarea:focus-visible{border-color:var(--cobalt);outline:none;box-shadow:0 0 0 3px var(--cobalt-soft)}
.predict .actions{margin-top:.75rem}
.answer{margin-top:1rem;padding:1rem 1.1rem;border-radius:8px;background:var(--moss-soft);border-left:4px solid var(--moss)}
.js .answer:not(.is-shown),.js .solution:not(.is-shown),.js .hint:not(.is-shown),.js .why:not(.is-shown){display:none}
.answer .eyebrow,.solution .eyebrow{display:block;margin-bottom:.3rem;color:var(--moss)}
.qs{display:grid;gap:1.5rem}
.q-text{font:600 1.08rem/1.4 var(--display);margin:0 0 .75rem}
.opts{list-style:none;margin:0;padding:0;display:grid;gap:.5rem}
.opt{display:flex;gap:.75rem;align-items:baseline;width:100%;text-align:left;font:400 1rem/1.45 var(--body);color:var(--ink);
background:var(--sheet);border:1.5px solid var(--rule);border-radius:8px;padding:.7rem .9rem;cursor:pointer}
.opt:hover{border-color:var(--cobalt)}
.opt .key{font:700 .75rem/1 var(--mono);color:var(--muted);flex:none;width:1.4rem;height:1.4rem;border:1.5px solid currentColor;
border-radius:4px;display:inline-grid;place-items:center;transform:translateY(-.08em)}
.opt.is-right{border-color:var(--moss);background:var(--moss-soft)}
.opt.is-right .key{color:var(--moss);background:var(--moss);color:var(--sheet);border-color:var(--moss)}
.opt.is-wrong{border-color:var(--crimson);background:var(--crimson-soft)}
.opt.is-wrong .key{background:var(--crimson);color:var(--sheet);border-color:var(--crimson)}
.why{font-size:.95rem;margin:.35rem 0 .25rem 3.05rem;color:var(--ink)}
.why::before{font:700 .7rem/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;margin-right:.5rem}
.why.right::before{content:"Right";color:var(--moss)}.why.wrong::before{content:"Why not";color:var(--crimson)}
.no-js .opt[data-correct="true"]{border-color:var(--moss)}
.q-status{font:500 .8rem/1.4 var(--mono);color:var(--muted);margin:.6rem 0 0}
.quiz-score{font:600 .95rem/1.4 var(--display);margin:1.25rem 0 0;padding-top:1rem;border-top:1px dashed var(--rule)}
.q-status:empty,.quiz-score:empty{margin:0;padding:0;border:0}
.warmup-from{margin:-.25rem 0 1rem;font:400 .85rem/1.5 var(--mono);color:var(--muted)}
.hints{list-style:none;margin:1rem 0 0;padding:0}
.hint{border-left:3px solid var(--marker);padding:.4rem 0 .4rem .9rem;margin:0 0 .6rem}
.hint .eyebrow{margin-right:.5rem}
.exercise .actions{display:flex;gap:.6rem;flex-wrap:wrap;margin-top:1rem}
.solution{margin-top:1rem;padding:1rem 1.1rem;border-radius:8px;background:var(--moss-soft);border-left:4px solid var(--moss)}
.clarification{border:1.5px dashed var(--cobalt);border-radius:12px;padding:1.1rem 1.3rem;background:transparent}
.clarification .asked{font:italic 500 1.02rem/1.5 var(--body);margin:0 0 .8rem;padding-left:.9rem;border-left:3px solid var(--cobalt)}
.clarification .eyebrow{display:block;color:var(--cobalt);margin-bottom:.3rem}
footer.lesson-foot{border-top:1px solid var(--rule);margin-top:3.5rem;padding-top:2rem}
footer h2{font:700 1.35rem/1.2 var(--display);margin:0 0 1rem}
.sources{margin:0;padding:0;list-style:none}
.sources li{display:grid;grid-template-columns:2.2rem 1fr;gap:0 .6rem;margin:0 0 1.4rem;scroll-margin-top:1.5rem}
.sources li:target .src-num{background:var(--marker);color:#1d1a05}
.src-num{font:700 .8rem/1.9rem var(--mono);text-align:center;width:1.9rem;height:1.9rem;border-radius:6px;
background:var(--sheet);border:1px solid var(--rule)}
.src-title{font:600 1rem/1.4 var(--display)}
.src-host{display:block;font:400 .75rem/1.5 var(--mono);color:var(--muted)}
.sources blockquote{margin:.5rem 0 0;padding:.1rem 0 .1rem .9rem;border-left:2px solid var(--rule);font-style:italic;color:var(--muted)}
.lesson-nav{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:2.5rem}
.lesson-nav a{display:block;text-decoration:none;background:var(--sheet);border:1px solid var(--rule);border-radius:10px;padding:.9rem 1.1rem;
font:650 1rem/1.3 var(--display)}
.lesson-nav a:hover{border-color:var(--cobalt)}
.lesson-nav .next{grid-column:2;text-align:right}
.lesson-nav .eyebrow{display:block;margin-bottom:.2rem}
@media (prefers-reduced-motion:no-preference){.opt,.btn,.dot{transition:background-color .15s,border-color .15s,color .15s}}
`;

const LESSON_JS = `
(function(){
var d=document;
function qa(el,s){return Array.prototype.slice.call(el.querySelectorAll(s));}
function stepper(root){
  var steps=qa(root,'.step'),dots=qa(root,'.dot'),prev=root.querySelector('[data-act="prev"]'),
      next=root.querySelector('[data-act="next"]'),list=root.querySelector('.steps'),cur=0;
  list.setAttribute('aria-live','polite');
  function show(i){cur=Math.max(0,Math.min(steps.length-1,i));
    steps.forEach(function(s,k){s.classList.toggle('is-current',k===cur);});
    dots.forEach(function(b,k){b.classList.toggle('is-done',k<cur);
      if(k===cur)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
    prev.disabled=cur===0;next.disabled=cur===steps.length-1;}
  root.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;
    if(b===prev)show(cur-1);else if(b===next)show(cur+1);else if(b.classList.contains('dot'))show(+b.getAttribute('data-i'));});
  root.addEventListener('keydown',function(e){if(e.target.tagName==='TEXTAREA')return;
    if(e.key==='ArrowRight'){show(cur+1);}else if(e.key==='ArrowLeft'){show(cur-1);}});
  show(0);
}
function answer(opt){
  var q=opt.closest('.q'),right=opt.getAttribute('data-correct')==='true';
  opt.classList.add(right?'is-right':'is-wrong');opt.setAttribute('aria-pressed','true');
  var why=opt.parentNode.querySelector('.why');if(why)why.classList.add('is-shown');
  if(q.hasAttribute('data-result'))return;
  q.setAttribute('data-result',right?'right':'wrong');
  qa(q,'.opt[data-correct="true"]').forEach(function(c){c.classList.add('is-right');
    var w=c.parentNode.querySelector('.why');if(w)w.classList.add('is-shown');});
  q.querySelector('.q-status').textContent=right?'Correct on the first try.':'Not quite. The right answer is marked in green. Tap other options to read why they are wrong.';
  var box=q.closest('[data-questions]');if(!box)return;
  var qs=qa(box,'.q'),done=qs.filter(function(x){return x.hasAttribute('data-result');});
  if(done.length===qs.length){var s=box.querySelector('.quiz-score');
    s.textContent='First-try score: '+done.filter(function(x){return x.getAttribute('data-result')==='right';}).length+' of '+qs.length+'.';}
}
function hint(btn){
  var ex=btn.closest('.exercise'),hidden=qa(ex,'.hint:not(.is-shown)');
  if(hidden.length)hidden[0].classList.add('is-shown');
  var left=hidden.length-1,total=qa(ex,'.hint').length;
  if(left>0){btn.textContent='Show hint '+(total-left+1)+' of '+total;}
  else{btn.hidden=true;var s=ex.querySelector('[data-act="solution"]');s.hidden=false;s.focus();}
}
d.addEventListener('click',function(e){
  var b=e.target.closest('button');if(!b)return;
  if(b.classList.contains('opt'))return answer(b);
  var act=b.getAttribute('data-act'),blk=b.closest('.blk');
  if(act==='reveal'){var p=blk.querySelector('.answer');p.classList.add('is-shown');
    var t=blk.querySelector('textarea');if(t){t.readOnly=true;}b.disabled=true;b.textContent='Answer shown';p.focus();}
  else if(act==='hint')hint(b);
  else if(act==='solution'){blk.querySelector('.solution').classList.add('is-shown');b.disabled=true;b.textContent='Solution shown';}
});
qa(d,'.stepper').forEach(stepper);
})();
`;

const PLAYGROUNDS = {
  rust: (code) => `https://play.rust-lang.org/?version=stable&mode=debug&edition=2021&code=${encodeURIComponent(code)}`,
};
const TONES = { note: 'Note', warning: 'Watch out', misconception: 'Misconception' };
const LABELS = {
  warmup: 'Warm-up', prose: null, callout: null, code: 'Listing', stepper: 'Step through',
  worked_example: 'Worked example', predict: 'Predict', quiz: 'Check yourself', exercise: 'Try it',
  clarification: 'Your question',
};

function codeFigure({ code, lang, caption, highlight, playground }, ctx) {
  const hl = new Set(Array.isArray(highlight) ? highlight : []);
  const lines = highlightLines(String(code ?? ''), lang)
    .map((html, i) => `<span class="ln${hl.has(i + 1) ? ' hl' : ''}">${html}</span>`).join('\n');
  const pg = playground && PLAYGROUNDS[String(lang).toLowerCase()];
  const link = pg ? `<a href="${escapeHtml(pg(String(code)))}" rel="noopener" target="_blank">Open in Rust Playground</a>` : '';
  const cap = caption ? `<figcaption>${renderSpan(caption, ctx)}</figcaption>` : '';
  return `<figure class="code"><div class="code-head"><span>${escapeHtml(lang || 'text')}</span>${link}</div>`
    + `<pre><code>${lines}</code></pre>${cap}</figure>`;
}

function optionalCode(item, ctx, fallbackLang) {
  return item.code ? codeFigure({ code: item.code, lang: item.lang || fallbackLang }, ctx) : '';
}

function questionsHtml(questions, id, ctx) {
  const items = (questions || []).map((q, qi) => {
    const opts = (q.options || []).map((o, oi) => {
      const right = o.correct === true;
      return `<li><button type="button" class="opt" data-correct="${right}" aria-pressed="false">`
        + `<span class="key" aria-hidden="true">${String.fromCharCode(65 + oi)}</span><span>${renderSpan(o.text, ctx)}</span></button>`
        + `<p class="why ${right ? 'right' : 'wrong'}">${renderSpan(o.why, ctx)}</p></li>`;
    }).join('');
    return `<div class="q" id="${id}-q${qi + 1}"><p class="q-text">${renderSpan(q.q, ctx)}</p>`
      + `<ul class="opts">${opts}</ul><p class="q-status js-only" aria-live="polite"></p></div>`;
  }).join('');
  return `<div data-questions><div class="qs">${items}</div><p class="quiz-score js-only" aria-live="polite"></p></div>`;
}

const BLOCKS = {
  warmup: (b, id, ctx) => {
    const from = (b.from || []).map((n) => `<code>${escapeHtml(n)}</code>`).join(', ');
    return `<div class="card">${from ? `<p class="warmup-from">Review from ${from}</p>` : ''}${questionsHtml(b.questions, id, ctx)}</div>`;
  },
  prose: (b, id, ctx) => `<div class="prose">${renderInline(b.md, ctx)}</div>`,
  callout: (b, id, ctx) => {
    if (!TONES[b.tone]) throw new Error(`Unknown callout tone "${b.tone}"`);
    const title = b.title ? `<p class="ctitle">${renderSpan(b.title, ctx)}</p>` : '';
    return `<aside class="callout callout-${b.tone}"><p class="tone">${TONES[b.tone]}</p>${title}<div class="md">${renderInline(b.md, ctx)}</div></aside>`;
  },
  code: (b, id, ctx) => codeFigure(b, ctx),
  stepper: (b, id, ctx) => {
    const steps = b.steps || [];
    const items = steps.map((s, i) => `<li class="step" id="${id}-s${i + 1}"><p class="step-label">Step ${i + 1} of ${steps.length} · ${renderSpan(s.label, ctx)}</p>`
      + `<div class="md">${renderInline(s.md, ctx)}</div>${optionalCode(s, ctx)}</li>`).join('');
    const dots = steps.map((s, i) => `<button type="button" class="dot" data-i="${i}" aria-label="Step ${i + 1}: ${escapeHtml(s.label)}">${i + 1}</button>`).join('');
    return `<div class="stepper card"><h3 class="blk-title">${renderSpan(b.title, ctx)}</h3><ol class="steps">${items}</ol>`
      + `<div class="stepper-nav js-only"><button type="button" class="btn" data-act="prev">Back</button>`
      + `<div class="dots">${dots}</div><button type="button" class="btn primary" data-act="next">Next</button></div></div>`;
  },
  worked_example: (b, id, ctx) => {
    const steps = (b.steps || []).map((s) => `<li><div class="md">${renderInline(s.md, ctx)}</div>${optionalCode(s, ctx)}</li>`).join('');
    return `<div class="worked card"><h3 class="blk-title">${renderSpan(b.title, ctx)}</h3><div class="setup md">${renderInline(b.setup, ctx)}</div>`
      + `<ol class="worked-steps">${steps}</ol><div class="takeaway"><span class="eyebrow">Takeaway</span><div class="md">${renderInline(b.takeaway, ctx)}</div></div></div>`;
  },
  predict: (b, id, ctx) => `<div class="predict card"><div class="md">${renderInline(b.prompt, ctx)}</div>${optionalCode(b, ctx)}`
    + `<label for="${id}-guess">Your prediction</label><textarea id="${id}-guess" placeholder="Write what you expect before revealing."></textarea>`
    + `<div class="actions js-only"><button type="button" class="btn primary" data-act="reveal">Reveal answer</button></div>`
    + `<div class="answer" tabindex="-1"><span class="eyebrow">Answer</span><div class="md">${renderInline(b.answer, ctx)}</div></div></div>`,
  quiz: (b, id, ctx) => `<div class="quiz card">${questionsHtml(b.questions, id, ctx)}</div>`,
  exercise: (b, id, ctx) => {
    const hints = b.hints || [];
    const hintItems = hints.map((h, i) => `<li class="hint"><span class="eyebrow">Hint ${i + 1}</span>${renderSpan(h, ctx)}</li>`).join('');
    const solCode = b.solution_code ? codeFigure({ code: b.solution_code, lang: b.lang }, ctx) : '';
    return `<div class="exercise card"><div class="md">${renderInline(b.prompt, ctx)}</div>`
      + (hints.length ? `<ol class="hints">${hintItems}</ol>` : '')
      + `<div class="actions js-only">`
      + (hints.length ? `<button type="button" class="btn" data-act="hint">Show hint 1 of ${hints.length}</button>` : '')
      + `<button type="button" class="btn primary" data-act="solution"${hints.length ? ' hidden' : ''}>Show solution</button></div>`
      + `<div class="solution"><span class="eyebrow">Solution</span><div class="md">${renderInline(b.solution, ctx)}</div>${solCode}</div></div>`;
  },
  clarification: (b, id, ctx) => {
    const thread = b.thread ? ` data-thread="${escapeHtml(b.thread)}"` : '';
    return `<aside class="clarification"${thread}><span class="eyebrow">You asked</span><p class="asked">${renderSpan(b.question, ctx)}</p>`
      + `<span class="eyebrow">Answer</span><div class="md">${renderInline(b.md, ctx)}</div></aside>`;
  },
};

function blockHtml(block, i, ctx) {
  const render = BLOCKS[block && block.type];
  if (!render) throw new Error(`Unknown lesson block type "${block && block.type}"`);
  const id = `b${i + 1}`;
  const label = LABELS[block.type];
  return `<section class="blk blk-${block.type}" id="${id}">`
    + (label ? `<span class="blk-label eyebrow">${label}</span>` : '')
    + `${render(block, id, ctx)}</section>`;
}

function hostOf(url) {
  try { return new URL(url).host; } catch { return ''; }
}

function sourcesHtml(sources) {
  if (!sources.length) return '';
  const items = sources.map((s) => {
    const n = String(s.id || '').replace(/^s/, '');
    const url = typeof s.url === 'string' && /^https:\/\//i.test(s.url) ? safeHref(s.url) : null;
    const title = url ? `<a href="${escapeHtml(url)}" rel="noopener" target="_blank">${escapeHtml(s.title)}</a>` : escapeHtml(s.title);
    return `<li id="src-${escapeHtml(s.id)}"><span class="src-num">${escapeHtml(n)}</span><div><span class="src-title">${title}</span>`
      + `${url ? `<span class="src-host">${escapeHtml(hostOf(url))}</span>` : ''}<blockquote>${escapeHtml(s.quote)}</blockquote></div></li>`;
  }).join('');
  return `<h2>Sources</h2><ol class="sources">${items}</ol>`;
}

function navHtml(prevUrl, nextUrl) {
  const prev = safeHref(prevUrl);
  const next = safeHref(nextUrl);
  if (!prev && !next) return '';
  return '<nav class="lesson-nav" aria-label="Lessons">'
    + (prev ? `<a class="prev" href="${escapeHtml(prev)}"><span class="eyebrow">Previous</span>Previous lesson</a>` : '')
    + (next ? `<a class="next" href="${escapeHtml(next)}"><span class="eyebrow">Next</span>Next lesson</a>` : '')
    + '</nav>';
}

export function renderLesson(lesson, { mapUrl = null, prevUrl = null, nextUrl = null } = {}) {
  const sources = Array.isArray(lesson.sources) ? lesson.sources : [];
  const ctx = { sources };
  const body = (lesson.blocks || []).map((b, i) => blockHtml(b, i, ctx)).join('\n');
  const map = safeHref(mapUrl);
  const remedial = lesson.kind === 'remedial';
  const objectives = (lesson.objectives || []).map((o) => `<li>${renderSpan(o, ctx)}</li>`).join('');
  const head = `<header class="lesson-head"><div class="head-row">`
    + (map ? `<a class="back" href="${escapeHtml(map)}">Skill map</a>` : '')
    + `<span class="eyebrow">${escapeHtml(lesson.topic)} / ${escapeHtml(lesson.node)}</span>`
    + (remedial ? '<span class="badge-remedial" title="A short follow-up on what the last check missed">Remedial</span>' : '')
    + `</div><h1>${renderSpan(lesson.title, ctx)}</h1>`
    + `<p class="meta">${escapeHtml(lesson.minutes)} min read</p>`
    + (objectives ? `<div class="objectives"><h2>By the end you can</h2><ul>${objectives}</ul></div>` : '')
    + '</header>';
  return `<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(lesson.title)}</title>
<script>document.documentElement.className='js'</script>
${FONT_LINKS}
<style>${BASE_CSS}${LESSON_CSS}</style>
</head>
<body>
<div class="wrap">
${head}
<main>
${body}
</main>
<footer class="lesson-foot">
${sourcesHtml(sources)}
${navHtml(prevUrl, nextUrl)}
</footer>
</div>
${CREDIT}
<script>${LESSON_JS}</script>
</body>
</html>
`;
}
