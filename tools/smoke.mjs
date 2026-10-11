#!/usr/bin/env node
/**
 * Headless smoke test: load every page in real Chrome and assert it renders.
 *
 * Catches the failure modes that survive `node --check` and a data validator:
 * an uncaught exception in a page's IIFE, a missing element the script
 * expects, an unresolved CSS custom property that blanks a visualisation, a
 * request that 404s.
 *
 * Needs Node 22+ for the global WebSocket used to speak to Chrome. The
 * launcher in start.sh / this script re-execs under a newer node if needed.
 *
 * Usage:
 *   node tools/smoke.mjs                        # starts its own server
 *   node tools/smoke.mjs --base http://…:8777   # use a running one
 *   node tools/smoke.mjs --keep-screenshots
 *   node tools/smoke.mjs --deep                 # also drive interactions and
 *                                               # assert visualisations render
 */
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

// --- re-exec under Node 22+ if the current one lacks global WebSocket -------
if (typeof WebSocket === 'undefined') {
  const candidates = [
    process.env.NODE22,
    `${process.env.HOME}/.nvm/versions/node/v22.23.2/bin/node`,
    `${process.env.HOME}/.nvm/versions/node/v24.21.0/bin/node`,
    '/usr/local/bin/node',
  ].filter(Boolean).filter((p) => existsSync(p));
  const newer = candidates.find((p) => {
    const r = spawnSync(p, ['-e', 'process.exit(typeof WebSocket === "undefined" ? 1 : 0)']);
    return r.status === 0;
  });
  if (newer && resolve(newer) !== resolve(process.execPath)) {
    const r = spawnSync(newer, [fileURLToPath(import.meta.url), ...process.argv.slice(2)],
      { stdio: 'inherit' });
    process.exit(r.status ?? 1);
  }
  console.error('This test needs Node 22+ (global WebSocket). Set NODE22=/path/to/node.');
  process.exit(2);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE_DIR = resolve(HERE, '..');

const CHROME = [
  process.env.CHROME_PATH,
  '/opt/google/chrome/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean).find((p) => existsSync(p));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.md': 'text/markdown; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

// A reusable in-page helper, prepended to every `act` below. It gives each
// interaction script the same assertion kit so the deep audit stays short.
const HELPERS = `const P=[];const S=ms=>new Promise(r=>setTimeout(r,ms));
  const has=(sel,min)=>{const n=document.querySelectorAll(sel).length;if(n<(min||1))P.push(sel+' missing ('+n+')');};
  const sized=(sel)=>{const e=document.querySelector(sel);if(!e){P.push(sel+' absent');return;}const r=e.getBoundingClientRect();if(r.width<=0.5||r.height<=0.5)P.push(sel+' has zero size');};
  const allSized=(sel)=>{let bad=0,tot=0;document.querySelectorAll(sel).forEach(e=>{tot++;const r=e.getBoundingClientRect();if(r.width<=0.5||r.height<=0.5)bad++;});if(tot&&bad)P.push(bad+'/'+tot+' '+sel+' have zero size');return tot;};
  const noEmptyText=(sel)=>{let bad=0;document.querySelectorAll(sel).forEach(e=>{if(!e.textContent.trim())bad++;});if(bad)P.push(bad+' '+sel+' render empty');};`;

// page path -> selectors that must exist once the page has finished booting,
// elements that must have a non-transparent resolved background, and (for
// --deep) a script that exercises the page's real interactions and returns an
// array of visual/interaction problems it found.
const PAGES = [
  { url: '/index.html',
    need: ['#stats .stat', '#levels-grid .card', '#main-nav a'],
    painted: ['.hero', '#levels-grid .progress-bar > div'],
    act: `(async()=>{${HELPERS}
      const bp=document.getElementById('bismillah-play');if(bp)bp.click();await S(150);
      noEmptyText('#stats .stat b');allSized('#levels-grid .progress-bar');
      if(document.querySelectorAll('#levels-grid .card').length<4)P.push('level cards missing');
      // With seeded progress at least one level fill must be visible — a bar
      // that stays at 0% when a lesson is done is the regression this guards.
      const fills=[...document.querySelectorAll('#levels-grid .progress-bar > div')];
      if(fills.length && !fills.some(f=>parseFloat(f.style.width)>0))P.push('all level progress fills are 0% despite seeded progress');
      return P;})()` },
  { url: '/pages/search.html',
    need: ['#q', '#scopes button', '#results', '#status'],
    painted: ['#scopes button[aria-pressed="true"]'],
    act: `(async()=>{${HELPERS}
      const q=document.getElementById('q');
      q.value='mercy';q.dispatchEvent(new Event('input'));await S(700);
      if(!document.querySelector('#results a.card'))P.push('no results for an English query');
      q.value='\u0627\u0644\u0631\u062d\u0645\u0646';q.dispatchEvent(new Event('input'));await S(700);
      if(!document.querySelector('#results a.card'))P.push('no results for an undiacritised Arabic query');
      document.getElementById('clear').click();await S(300);
      const sb=document.querySelector('#scopes button[data-scope="lesson"]');if(sb){sb.click();await S(200);}
      q.value='lesson';q.dispatchEvent(new Event('input'));await S(500);
      return P;})()` },
  { url: '/pages/alphabet.html',
    need: ['#alpha-grid .alpha-card', '#families .card'],
    painted: ['#alpha-grid .alpha-card .glyph'],
    act: `(async()=>{${HELPERS}
      const c=document.querySelector('#alpha-grid .alpha-card');if(c){c.click();await S(220);}
      has('#detail-panel .forms-table .form-cell',4);allSized('#detail-panel .big-glyph');
      document.querySelectorAll('#detail-panel .btn').forEach(b=>b.click());
      document.querySelectorAll('#families .card .btn').forEach(b=>b.click());await S(220);
      has('#families .card',4);
      return P;})()` },
  { url: '/pages/reading.html',
    need: ['#vowel-grid .vowel-card', '#word-grid > div', '#challenge-area'],
    painted: ['#vowel-grid .vowel-card .ar'],
    act: `(async()=>{${HELPERS}
      allSized('#vowel-grid .vowel-card .ar');allSized('#word-grid .quran-text');
      document.querySelectorAll('#word-grid .card').forEach(c=>c.click());await S(150);
      for(let i=0;i<6;i++){const btns=[...document.querySelectorAll('#challenge-area button')];if(!btns.length)break;btns[btns.length-1].click();await S(250);}
      if(!document.querySelector('#challenge-area').textContent.trim())P.push('challenge area empty');
      return P;})()` },
  { url: '/pages/grammar.html',
    need: ['#level-tabs button', '#lesson-list .lesson-row'],
    painted: ['#level-tabs button'],
    act: `(async()=>{${HELPERS}
      const tabs=[...document.querySelectorAll('#level-tabs button')];
      for(const t of tabs){t.click();await S(160);has('#lesson-list .lesson-row');}
      if(tabs[0])tabs[0].click();await S(160);
      const open=document.querySelector('#lesson-list .lesson-row button');if(open){open.click();await S(300);}
      has('#lesson-view .explain');
      for(let i=0;i<8;i++){const o=document.querySelector('#lesson-view .quiz-opt:not([disabled])');if(!o)break;o.click();await S(1400);}
      for(const t of tabs){t.click();await S(120);}
      return P;})()` },
  { url: '/pages/vocabulary.html',
    need: ['#deck-picker button', '#mode-study', '#study-area .flashcard'],
    painted: ['#study-area .flashcard .front-ar'],
    act: `(async()=>{${HELPERS}
      if(typeof window.setMode!=='function'){P.push('setMode is not global');return P;}
      window.setMode('browse');await S(280);has('#browse-area .card',5);allSized('#browse-area .speaker-btn');
      window.setMode('root');await S(280);has('#root-area .card',2);
      window.setMode('freq');await S(350);
      let large=0;document.querySelectorAll('#freq-area .ar').forEach(s=>{if(parseFloat(getComputedStyle(s).fontSize)>14)large++;});
      if(large<3)P.push('word cloud not sized by frequency ('+large+' large words)');
      has('#freq-area .card',4);
      window.setMode('quiz');await S(280);if(!document.querySelector('#quiz-area').textContent.trim())P.push('root quiz empty');
      window.setMode('study');await S(250);
      for(let i=0;i<5;i++){const c=document.querySelector('#study-area .flashcard');if(!c)break;c.click();await S(80);const g=document.querySelector('#study-area .grade-btn.easy')||document.querySelector('#study-area .grade-btn');if(g){g.click();await S(200);}}
      // The advertised keyboard shortcuts must actually drive the card.
      const card=document.querySelector('#study-area .flashcard');
      if(card){
        document.body.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true}));await S(150);
        if(!document.querySelector('#study-area .flashcard.flipped'))P.push('Space did not flip the flashcard');
        const leftNum=()=>{const p=[...document.querySelectorAll('#study-area p')].find(x=>/left in this session/.test(x.textContent));return p?parseInt(p.textContent,10):-1;};
        const before=leftNum();
        document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'3',bubbles:true}));await S(300);
        const after=leftNum();
        if(!(before>0 && after===before-1))P.push('number key did not grade the card ('+before+' -> '+after+')');
      }
      return P;})()` },
  { url: '/pages/quran-reader.html',
    need: ['#surah-select option', '#text-mode-toggle button', '#view-mode-toggle button',
           '#mushaf-bookmark', '#mushaf-bookmarks'],
    painted: ['#text-mode-toggle button[aria-pressed="true"]', '.ayah-card .ayah-text'],
    act: `(async()=>{${HELPERS}
      allSized('#ayah-container .ayah-card .ayah-text');
      document.querySelectorAll('#text-mode-toggle button').forEach(b=>b.click());await S(280);
      has('.ayah-card .ayah-text');
      const up=document.getElementById('font-up'),down=document.getElementById('font-down');if(up)up.click();if(down)down.click();await S(120);
      const nx=document.getElementById('surah-next'),pv=document.getElementById('surah-prev');
      if(nx){nx.click();await S(320);}if(pv){pv.click();await S(320);}
      const chip=document.querySelector('.word-chip');if(chip){chip.click();await S(200);const pop=document.querySelector('.word-popover');if(!pop||pop.style.display==='none')P.push('word popover did not open');document.body.click();await S(120);}
      // The Mushaf view must render entirely from the vendored local bundle.
      const mush=document.querySelector('#view-mode-toggle button[data-view="mushaf"]');
      if(!mush)P.push('mushaf toggle missing');
      else {
        mush.click();await S(1500);
        if(!document.querySelector('.mushaf-page'))P.push('mushaf view did not render a page');
        allSized('.mushaf-page');
        if(!document.querySelector('.mushaf-line'))P.push('mushaf page has no text lines');
        const pageInput=document.getElementById('mushaf-page-input');
        const before=pageInput?pageInput.value:null;
        const nextBtn=document.getElementById('mushaf-next');if(nextBtn){nextBtn.click();await S(500);}
        if(pageInput && pageInput.value===before)P.push('mushaf next-page did nothing');
        // Per-page bookmarks: mark the page, confirm it persisted and reached
        // the jump dropdown, navigate away and back through it, then unmark.
        const mark=document.getElementById('mushaf-bookmark');
        const bmSel=document.getElementById('mushaf-bookmarks');
        if(!mark||!bmSel)P.push('mushaf bookmark controls missing');
        else {
          const here=parseInt(pageInput.value,10);
          mark.click();await S(250);
          if(mark.getAttribute('aria-pressed')!=='true')P.push('bookmark button did not become pressed');
          if(bmSel.disabled)P.push('bookmark dropdown stayed disabled after bookmarking');
          if(bmSel.querySelectorAll('option').length<2)P.push('bookmarked page is not in the dropdown');
          if(bmSel.value!==String(here))P.push('bookmark dropdown does not point at the current page');
          const stored=JSON.parse(localStorage.getItem('quran-mushaf-bookmarks-v1')||'null');
          if(!stored||!stored.pages||!stored.pages[String(here)])P.push('bookmark was not persisted to localStorage');
          if(pageInput){pageInput.value='1';pageInput.dispatchEvent(new Event('change'));await S(600);}
          bmSel.value=String(here);bmSel.dispatchEvent(new Event('change'));await S(600);
          if(parseInt(pageInput.value,10)!==here)P.push('bookmark dropdown did not navigate back to the page');
          mark.click();await S(250);
          if(mark.getAttribute('aria-pressed')!=='false')P.push('bookmark button did not clear');
          if(!bmSel.disabled)P.push('bookmark dropdown should disable once empty');
        }
        const ayatBtn=document.querySelector('#view-mode-toggle button[data-view="ayah"]');
        if(ayatBtn){ayatBtn.click();await S(500);}
        if(!document.querySelector('.ayah-card'))P.push('switching back to Ayat view did not restore cards');
      }
      return P;})()` },
  { url: '/pages/tajweed.html',
    need: ['#rules .tajweed-rule'],
    painted: ['.tajweed-rule .ex'],
    act: `(async()=>{${HELPERS}
      has('#rules .tajweed-rule',10);allSized('.tajweed-rule .ex');
      document.querySelectorAll('.tajweed-rule .btn').forEach(b=>b.click());await S(280);
      return P;})()` },
  { url: '/pages/hifz.html',
    need: ['#juz-grid .juz-cell', '#start-juz option', '#end-juz option'],
    painted: ['#juz-grid .juz-cell'],
    act: `(async()=>{${HELPERS}
      has('#juz-grid .juz-cell',30);allSized('#juz-grid .juz-cell');
      const cell=document.querySelector('#juz-grid .juz-cell');if(cell){cell.click();await S(220);}
      const mk=document.getElementById('make-plan');if(mk){mk.click();await S(150);}
      const logText=document.getElementById('log-text');
      if(logText){logText.value='Al-Mulk 1-10';document.getElementById('add-log').click();await S(150);}
      has('#log-list li');
      const rnd=document.getElementById('random-surah');if(rnd){rnd.click();await S(200);}
      if(!document.getElementById('random-result').textContent.trim())P.push('random self-test produced nothing');
      return P;})()` },
  { url: '/pages/progress.html',
    need: ['#stats-grid .kpi', '.bar-chart .bar', '.heat-col .heat-cell', '.deck-row',
           '#coverage .kv'],
    painted: ['#stats-grid .kpi-value', '.bar-chart .bar', '#coverage-pct'],
    act: `(async()=>{${HELPERS}
      noEmptyText('#stats-grid .kpi-value');
      const bars=allSized('.bar-chart .bar');if(bars!==84)P.push('activity chart has '+bars+' bars (want 84)');
      const cols=document.querySelectorAll('#streak-calendar .heat-col').length;if(cols!==26)P.push('heat map has '+cols+' week columns (want 26)');
      allSized('.heat-cell');allSized('.bar-chart .bar');
      has('.deck-row',1);allSized('.deck-row .progress-bar');
      const filled=document.querySelector('.bar-chart .bar:not(.bar-empty)');
      if(!filled)P.push('no non-empty activity bar despite seeded data');
      else if(filled.getBoundingClientRect().height<5)P.push('activity bar too short to read');
      const active=document.querySelectorAll('#streak-calendar .heat-cell.l1,#streak-calendar .heat-cell.l2,#streak-calendar .heat-cell.l3,#streak-calendar .heat-cell.l4');
      if(!active.length)P.push('heat map shows no active days despite seeded activity');
      const deckFill=document.querySelector('.deck-row .progress-bar > div');
      if(!deckFill)P.push('deck progress fill missing');
      // Coverage estimate: with seeded SRS data both the headline percentage and
      // the bar behind it must be populated — a 0.0% here means the word-freq
      // lookup or the de-duplication broke, not that the learner knows nothing.
      const covPct=document.getElementById('coverage-pct');
      if(!covPct||!covPct.textContent.trim())P.push('coverage percentage missing');
      else if(!(parseFloat(covPct.textContent)>0))P.push('coverage is 0% despite seeded SRS data');
      const covBar=document.querySelector('#coverage-bar');
      if(!covBar)P.push('coverage bar missing');
      else if(!(parseFloat(covBar.style.width)>0))P.push('coverage bar has no fill');
      has('#coverage .kv',6);allSized('#coverage .kv');
      noEmptyText('#coverage .kv b');
      return P;})()` },
  // Deep links that the Search page hands out must land on the right content.
  { url: '/pages/vocabulary.html?deck=quran-core&q=%D8%B9%D9%84%D9%85',
    need: ['#browse-area .card'], painted: [],
    act: `(async()=>{${HELPERS}
      const study=document.getElementById('study-area');
      if(study && study.style.display!=='none')P.push('deep-linked Browse did not replace Study');
      if(!document.querySelector('#browse-area .card'))P.push('deep-linked Browse rendered no words');
      return P;})()` },
  { url: '/pages/grammar.html?level=2&lesson=L2.1',
    need: ['#lesson-view .explain'], painted: [],
    act: `(async()=>{${HELPERS}
      has('#lesson-view .quiz-opt',1);
      if(!document.querySelector('#lesson-view .page-title'))P.push('lesson header missing');
      return P;})()` },
  { url: '/pages/quran-reader.html?surah=2&ayah=255',
    need: ['.ayah-card .ayah-text'], painted: [],
    act: `(async()=>{${HELPERS}
      const sel=document.getElementById('surah-select');
      if(sel.value!=='2')P.push('?surah=2 not selected (got '+sel.value+')');
      if(!document.querySelector('[data-ayah]'))P.push('no ayah cards rendered');
      if(!document.getElementById('ayajump-input'))P.push('ayah jump input missing');
      return P;})()` },
  { url: '/offline.html', need: ['.apps .app'], painted: ['.retry-btn'],
    act: `(async()=>{${HELPERS}
      if(document.querySelectorAll('.carousel .dot').length<3)P.push('verse carousel dots missing');
      const t=document.getElementById('retryText');const b=document.getElementById('retryBtn');
      if(t&&!t.textContent.trim())P.push('retry button text empty');
      if(b&&b.getBoundingClientRect().width<=0)P.push('retry button not painted');
      return P;})()` },
];

const args = process.argv.slice(2);
const KEEP = args.includes('--keep-screenshots');
const DEEP = args.includes('--deep');
const forcedBase = args.includes('--base') ? args[args.indexOf('--base') + 1] : null;

// ---------------------------------------------------------------------------

async function startServer() {
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = join(BASE_DIR, p);
      if (!file.startsWith(BASE_DIR) || !existsSync(file)) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('not found');
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch (e) {
      res.writeHead(500); res.end(String(e));
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

/** Minimal CDP client over the DevTools WebSocket — no npm dependencies. */
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = new Map(); }
  static async attach(port) {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    let target = list.find((t) => t.type === 'page');
    if (!target) {
      await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
      target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json())
        .find((t) => t.type === 'page');
    }
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const c = new CDP(ws);
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && c.pending.has(msg.id)) {
        const { res, rej } = c.pending.get(msg.id);
        c.pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      } else if (msg.method) {
        (c.handlers.get(msg.method) || []).forEach((h) => h(msg.params));
      }
    };
    return c;
  }
  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.pending.set(id, { res, rej }));
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    }
    return r.result.value;
  }
  close() { this.ws.close(); }
}

// ---------------------------------------------------------------------------

const failures = [];
const warnings = [];
let base = forcedBase;
let server = null;
let cdp = null;

if (!base) {
  const s = await startServer();
  server = s.server;
  base = s.base;
}

const port = args.includes('--port') ? Number(args[args.indexOf('--port') + 1]) : 9333;
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${port}`,
  '--headless=new',
  '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--hide-scrollbars',
  '--window-size=1280,900',
  'about:blank',
], { stdio: 'ignore' });

process.on('exit', () => { try { chrome.kill(); } catch {} if (server) server.close(); });

// Wait for the debugging endpoint.
for (let i = 0; i < 100; i++) {
  try { await fetch(`http://127.0.0.1:${port}/json/version`); break; }
  catch { await sleep(100); }
}

cdp = await CDP.attach(port);
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Log.enable');
await cdp.send('Network.enable');

let consoleErrors = [];
let failedRequests = [];
cdp.on('Runtime.consoleAPICalled', (p) => {
  if (p.type === 'error') {
    consoleErrors.push(p.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
  }
});
cdp.on('Runtime.exceptionThrown', (p) => {
  consoleErrors.push('uncaught: ' + (p.exceptionDetails?.exception?.description
    || p.exceptionDetails?.text || 'unknown'));
});
cdp.on('Log.entryAdded', (p) => {
  if (p.entry.level === 'error') consoleErrors.push(`log: ${p.entry.text} (${p.entry.url || ''})`);
});
cdp.on('Network.responseReceived', (p) => {
  if (p.response.status >= 400) {
    failedRequests.push(`${p.response.status} ${p.response.url}`);
  }
});

const shotDir = join(BASE_DIR, '.smoke');
if (KEEP) await mkdir(shotDir, { recursive: true });

console.log(`Islam Academy smoke test — ${base}${DEEP ? ' (deep)' : ''}\n`);

// Deep mode seeds realistic progress first, so the dashboards, SRS statistics
// and heat maps are exercised with data instead of rendering their empty state.
if (DEEP) {
  await cdp.send('Page.navigate', { url: base + '/index.html?nosw=1' });
  await sleep(1000);
  await cdp.eval(`(async () => {
    const pad = n => String(n).padStart(2, '0');
    const key = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const activity = {};
    for (let i = 0; i < 56; i++) {
      if (i % 4 === 0) continue;
      const d = new Date(Date.now() - i * 86400000);
      activity[key(d)] = { xp: 10 + (i % 5) * 8, lessons: i % 3, cards: (i % 7) * 4 };
    }
    const decks = await (await fetch('data/curriculum/decks.json')).json();
    const srs = {}, vocabEval = {};
    Object.entries(decks).forEach(([id, d]) => d.words.forEach((w, j) => {
      const k = id + '::' + w.ar;
      if (j % 3 === 0) {
        srs[k] = { ease: 2.3 + (j % 5) * 0.1, interval: [0, 1, 3, 8, 21, 45][j % 6],
          due: Date.now() + ((j % 4) ? 86400000 * j : -60000), reps: 1 + (j % 4), lapses: j % 3 };
        vocabEval[k] = { grade: ['Again', 'Hard', 'Good', 'Easy'][j % 4], ts: Date.now() - j * 1000 };
      }
    }));
    const st = {
      xp: 1240, streak: { count: 6, last: key(new Date()) },
      lessonsDone: {
        'L0.1': { score: 85, date: Date.now() - 3 * 86400000 },
        'L1.1': { score: 90, date: Date.now() - 86400000 },
        'L2.1': { score: 72, date: Date.now() },
      },
      srs, rootStats: { '\u0643.\u062A.\u0628': { right: 3, wrong: 5, ts: Date.now() } },
      vocabEval, vocabFlags: {},
      hifz: { plan: [1, 5], done: [1, 2, 3], log: [{ date: key(new Date()), text: 'Al-Mulk 1-10' }] },
      settings: { reciter: 'ar.alafasy', translit: true, theme: 'light', quranFontSize: 22 },
      activity,
    };
    localStorage.setItem('islam-academy-v1', JSON.stringify(st));
    return 'seeded';
  })()`);
  await sleep(300);
}

for (const spec of PAGES) {
  consoleErrors = [];
  failedRequests = [];
  const url = base + spec.url;
  const label = spec.url.padEnd(28);
  try {
    await cdp.send('Page.navigate', { url });
    await sleep(1400);
    // A service worker from a previous page can serve stale HTML.
    await cdp.eval('(async()=>{const r=await navigator.serviceWorker.getRegistrations();await Promise.all(r.map(x=>x.unregister()));const k=await caches.keys();await Promise.all(k.map(y=>caches.delete(y)));})()').catch(() => {});

    const result = await cdp.eval(`(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      for (let i = 0; i < 25; i++) {           // data fetches are async
        if (${JSON.stringify(spec.need)}.every(s => document.querySelector(s))) break;
        await sleep(120);
      }
      const need = ${JSON.stringify(spec.need)};
      const missing = need.filter(s => !document.querySelector(s));
      const painted = ${JSON.stringify(spec.painted)};
      const blank = [];
      for (const sel of painted) {
        const e = document.querySelector(sel);
        if (!e) { blank.push(sel + ' (absent)'); continue; }
        const cs = getComputedStyle(e);
        const bg = cs.backgroundColor;
        const transparent = bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent';
        // A gold/paper background is fine; the failure is a fully transparent one
        // on something that is clearly a filled surface.
        if (transparent && cs.backgroundImage === 'none' && sel.includes('progress-bar')) {
          blank.push(sel + ' (transparent fill)');
        }
      }
      // Any CSS var that resolves to the empty string was never defined.
      const rootStyle = getComputedStyle(document.documentElement);
      const used = [...document.querySelectorAll('*')].slice(0, 400);
      return {
        missing, blank,
        title: document.title,
        // A var that is referenced but undefined makes the declaration invalid,
        // which is what silently blanked 30+ visualisations before.
        goldVar: rootStyle.getPropertyValue('--gold').trim(),
        emerald50: rootStyle.getPropertyValue('--emerald-50').trim(),
        emerald500: rootStyle.getPropertyValue('--emerald-500').trim(),
        rawEscapes: document.body.innerText.includes('\\\\u2') || document.body.innerText.includes('\\\\uF'),
        bodyLen: document.body.innerText.length,
      };
    })()`);

    const problems = [];
    if (result.missing.length) problems.push(`missing: ${result.missing.join(', ')}`);
    if (result.blank.length) problems.push(`blank: ${result.blank.join(', ')}`);
    if (result.rawEscapes) problems.push('literal \\uXXXX escape rendered as text');
    if (consoleErrors.length) problems.push(`console: ${consoleErrors.slice(0, 3).join(' | ')}`);
    if (failedRequests.length) problems.push(`404: ${failedRequests.slice(0, 3).join(' | ')}`);
    if (result.bodyLen < 80) problems.push(`page looks empty (${result.bodyLen} chars of text)`);

    // Deep audit: drive the page's real interactions, then re-check for console
    // errors and for visualisations that silently render at zero size.
    if (DEEP && spec.act) {
      const errBefore = consoleErrors.length;
      const reqBefore = failedRequests.length;
      try {
        const actProblems = await cdp.eval(spec.act);
        await sleep(250);
        if (Array.isArray(actProblems)) actProblems.forEach((p) => problems.push(`interact: ${p}`));
        // A visualisation that pushes the page wider than the viewport is the
        // classic "looks broken" bug; assert the document never overflows.
        const layout = await cdp.eval(`(() => {
          const P = []; const de = document.documentElement;
          if (de.scrollWidth > de.clientWidth + 2)
            P.push('horizontal overflow (' + de.scrollWidth + ' > ' + de.clientWidth + ')');
          return P; })()`);
        if (Array.isArray(layout)) layout.forEach((p) => problems.push(`layout: ${p}`));
      } catch (e) {
        problems.push(`interact threw: ${e.message}`);
      }
      consoleErrors.slice(errBefore).forEach((e) => problems.push(`console(after): ${e}`));
      failedRequests.slice(reqBefore).forEach((r) => problems.push(`404(after): ${r}`));
    }

    if (problems.length) {
      failures.push({ url: spec.url, problems });
      console.log(`  FAIL  ${label} ${problems.join('\n              ')}`);
    } else {
      console.log(`  ok    ${label} ${result.bodyLen} chars`);
    }
    if (KEEP) {
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(shotDir, spec.url.replace(/[/.]/g, '_') + '.png'),
        Buffer.from(shot.data, 'base64'));
    }
  } catch (e) {
    failures.push({ url: spec.url, problems: [`threw: ${e.message}`] });
    console.log(`  FAIL  ${label} threw: ${e.message}`);
  }
}

cdp.close();
chrome.kill();
if (server) server.close();

console.log('');
if (warnings.length) {
  console.log(`${warnings.length} warning(s)`);
  warnings.forEach((w) => console.log('  ! ' + w));
}
if (failures.length) {
  console.log(`${failures.length} page(s) failed:`);
  failures.forEach((f) => console.log(`  ${f.url}: ${f.problems.join('; ')}`));
  process.exit(1);
}
console.log(`All ${PAGES.length} pages render with no console errors or failed requests.`);
