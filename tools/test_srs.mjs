#!/usr/bin/env node
/**
 * Unit tests for the academy's scheduling core — the SM-2 review maths, XP,
 * streaks, activity buckets, weak roots and vocab flags in assets/js/app.js.
 *
 * app.js is a browser IIFE with no exports beyond `window.Academy`, so instead
 * of adding a bundler this evaluates it in a `node:vm` context with a handful of
 * web-API stubs (document, localStorage, Audio, a controllable Date). That keeps
 * the tests dependency-free, which is how the rest of this project is built.
 *
 * Run:  node tools/test_srs.mjs
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('../assets/js/app.js', import.meta.url));
const DAY = 86400000;
const MINUTE = 60000;

// A clock the tests move by hand. `new Date(undefined)` is an Invalid Date, so
// the shim also exercises the "no argument means now" path that the app relies on.
let clock = Date.parse('2026-09-29T09:00:00Z');

function makeDateClass() {
  return class FakeDate extends Date {
    constructor(...args) {
      if (args.length === 0) super(clock);
      else super(...args);
    }
    static now() { return clock; }
  };
}

function loadAcademy() {
  const store = new Map();
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.console = console;
  sandbox.structuredClone = structuredClone;
  sandbox.URL = URL;
  sandbox.URLSearchParams = URLSearchParams;
  sandbox.Date = makeDateClass();
  sandbox.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  };
  sandbox.location = {
    pathname: '/assets/js/app.js',
    origin: 'http://localhost',
    href: 'http://localhost/assets/js/app.js',
  };
  const node = () => ({
    style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {}, removeAttribute() {}, append() {}, appendChild() {}, addEventListener() {},
    getBoundingClientRect: () => ({ width: 0, height: 0 }),
    querySelector: () => null, querySelectorAll: () => [],
  });
  sandbox.document = {
    currentScript: { src: 'http://localhost/assets/js/app.js' },
    createElement: node,
    body: { append() {} },
    documentElement: { dataset: {}, style: { setProperty() {} } },
    addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
  };
  sandbox.navigator = { onLine: true };
  sandbox.Audio = class {
    constructor() { this.preload = ''; }
    pause() {} play() { return Promise.resolve(); } addEventListener() {}
  };

  vm.createContext(sandbox);
  vm.runInContext(readFileSync(APP, 'utf8'), sandbox, { filename: 'app.js' });
  return sandbox.Academy;
}

// ---------------------------------------------------------------------------

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  FAIL ${name}\n         ${e.message}`);
  }
}
function eq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg ? msg + ': ' : ''}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
function near(actual, expected, tol, msg) {
  if (!(Math.abs(actual - expected) <= tol)) {
    throw new Error(`${msg ? msg + ': ' : ''}expected ~${expected} (±${tol}), got ${actual}`);
  }
}
function ok(value, msg) {
  if (!value) throw new Error(msg || 'expected a truthy value');
}

const A = loadAcademy();
if (!A) {
  console.error('app.js did not expose window.Academy');
  process.exit(1);
}

const D0 = Date.parse('2026-09-29T09:00:00Z');
clock = D0;

console.log('\nSRS scheduling (SM-2 lite)');

test('again on a new card: reps reset, lapse recorded, due in ten minutes', () => {
  const c = A.reviewCard('t::again', 0);
  eq(c.reps, 0);
  eq(c.lapses, 1);
  eq(c.interval, 0);
  near(c.ease, 2.3, 1e-9, 'ease drops 0.2');
  eq(c.due - clock, 10 * MINUTE, 'due');
});

test('good on a new card: one-day interval', () => {
  const c = A.reviewCard('t::good1', 2);
  eq(c.reps, 1);
  eq(c.interval, 1);
  near(c.ease, 2.52, 1e-9);
  eq(c.due - clock, DAY, 'due');
});

test('hard on a new card: half-day interval scheduled in minutes', () => {
  const c = A.reviewCard('t::hard1', 1);
  eq(c.reps, 1);
  eq(c.interval, 0.5);
  near(c.ease, 2.44, 1e-9);
  eq(c.due - clock, 0.15 * DAY, 'due');
});

test('easy on a new card: one-day interval, higher ease', () => {
  const c = A.reviewCard('t::easy1', 3);
  eq(c.interval, 1);
  near(c.ease, 2.6, 1e-9);
  eq(c.due - clock, DAY);
});

test('three goods grow the interval 1 → 3 → 8', () => {
  A.reviewCard('t::chain', 2);
  const c2 = A.reviewCard('t::chain', 2);
  eq(c2.interval, 3, 'second rep');
  const c3 = A.reviewCard('t::chain', 2);
  eq(c3.interval, Math.round(3 * 2.54), 'third rep');
  near(A.state.srs['t::chain'].ease, 2.56, 1e-9);
});

test('easy on the third rep applies the 1.2 bonus', () => {
  A.reviewCard('t::easy3', 2);
  A.reviewCard('t::easy3', 2);
  const c = A.reviewCard('t::easy3', 3);
  near(c.ease, 2.64, 1e-9);
  eq(c.interval, Math.round(3 * 2.64 * 1.2));
});

test('hard on the third rep applies the 0.7 penalty', () => {
  A.reviewCard('t::hard3', 2);
  A.reviewCard('t::hard3', 2);
  const c = A.reviewCard('t::hard3', 1);
  near(c.ease, 2.48, 1e-9);
  eq(c.interval, Math.round(3 * 2.48 * 0.7));
});

test('ease never falls below 1.3', () => {
  for (let i = 0; i < 15; i++) A.reviewCard('t::floor', 0);
  eq(A.state.srs['t::floor'].ease, 1.3);
});

test('again resets a learned card back to a ten-minute wait', () => {
  A.reviewCard('t::reset', 2);
  const c = A.reviewCard('t::reset', 0);
  eq(c.reps, 0);
  eq(c.interval, 0);
  eq(c.lapses, 1);
  eq(c.due - clock, 10 * MINUTE);
});

test('dueCards includes unseen cards and hides future ones', () => {
  A.reviewCard('t::future', 2);
  const due = A.dueCards(['t::future', 't::never']);
  eq(due.length, 1);
  eq(due[0], 't::never');
});

test('srsStats classifies due, unseen and mature cards', () => {
  A.state.srs = {};
  const matureKey = 't::mature';
  let guard = 0;
  while ((A.state.srs[matureKey] || { interval: 0 }).interval < 21) {
    A.reviewCard(matureKey, 2);
    if (++guard > 20) throw new Error('card never matured');
  }
  const s = A.srsStats([matureKey, 't::unseen-one']);
  eq(s.total, 2);
  eq(s.due, 1, 'only the unseen card is due');
  eq(s.unseen, 1);
  ok(s.mature >= 1, 'one card should be mature');
  ok(s.avgEase > 0, 'ease should be averaged');
});

test('cardKey is stable and deck-scoped', () => {
  eq(A.cardKey('d', { ar: 'x' }), 'd::x');
  eq(A.cardKey('d', 'x'), 'd::x');
  ok(A.cardKey('a', 'x') !== A.cardKey('b', 'x'), 'decks must not collide');
});

test('reviewCard records the grade label and counts the card', () => {
  clock = D0;
  A.state.activity = {};
  A.state.vocabEval = {};
  A.reviewCard('v::1', 3);
  eq(A.state.vocabEval['v::1'].grade, 'Easy');
  eq(A.state.activity[A.todayStr(new Date(clock))].cards, 1);
});

console.log('\nXP, streaks and activity');

test('completeLesson pays full XP once and keeps the best score', () => {
  A.state.xp = 0;
  A.completeLesson('T-L1', 80);
  eq(A.state.xp, 60, '20 + 80 * 0.5');
  eq(A.lessonScore('T-L1'), 80);
  A.completeLesson('T-L1', 50);
  eq(A.state.xp, 62, 'a replay earns a flat 2 XP');
  eq(A.lessonScore('T-L1'), 80, 'score keeps the maximum');
});

test('completeLesson pays only 2 XP for a fail', () => {
  A.state.xp = 0;
  A.completeLesson('T-L2', 40);
  eq(A.state.xp, 2);
  eq(A.lessonScore('T-L2'), 40);
  ok(A.state.lessonsDone['T-L2'], 'the attempt is recorded');
});

test('a lesson failed then passed still pays full XP', () => {
  A.state.xp = 0;
  A.completeLesson('T-L3', 40);
  A.completeLesson('T-L3', 80);
  eq(A.state.xp, 62);
  eq(A.lessonScore('T-L3'), 80);
});

test('streak: consecutive day increments, gap resets, same day is a no-op', () => {
  clock = D0;
  A.state.streak = { count: 5, last: A.todayStr(new Date(D0 - DAY)) };
  A.addXP(1);
  eq(A.state.streak.count, 6, 'consecutive day');

  A.state.streak = { count: 5, last: A.todayStr(new Date(D0 - 2 * DAY)) };
  A.addXP(1);
  eq(A.state.streak.count, 1, 'a gap restarts the streak');

  A.state.streak = { count: 5, last: A.todayStr(new Date(D0)) };
  A.addXP(1);
  eq(A.state.streak.count, 5, 'same day does not double-count');
});

test('addXP logs into today\'s activity bucket', () => {
  clock = D0;
  A.state.activity = {};
  A.addXP(7);
  const key = A.todayStr(new Date(clock));
  eq(A.state.activity[key] && A.state.activity[key].xp, 7);
});

test('markActivity() with no argument files under today, not NaN-NaN-NaN', () => {
  clock = D0;
  A.state.activity = {};
  A.markActivity();
  const keys = Object.keys(A.state.activity);
  eq(keys.length, 1);
  eq(keys[0], A.todayStr(new Date(clock)));
  ok(!/NaN/.test(keys[0]), 'the key must be a real date');
});

test('todayStr pads month and day', () => {
  eq(A.todayStr(new Date(2026, 0, 5)), '2026-01-05');
});

test('the activity log stays bounded at 400 days', () => {
  clock = D0;
  A.state.activity = {};
  for (let i = 0; i < 450; i++) {
    A.state.activity[A.todayStr(new Date(D0 - i * DAY))] = { xp: 0, lessons: 0, cards: 0 };
  }
  A.addXP(1);
  ok(Object.keys(A.state.activity).length <= 400, 'activity map must be pruned');
});

console.log('\nRoots and flags');

test('weakRoots surfaces roots with at least as many misses as hits', () => {
  A.state.rootStats = {};
  A.recordRootAttempt('ك.ت.ب', false);
  A.recordRootAttempt('ك.ت.ب', false);
  A.recordRootAttempt('ع.ل.م', true);
  A.recordRootAttempt('ر.ح.م', false);
  A.recordRootAttempt('ر.ح.م', true);
  const weak = A.weakRoots();
  ok(weak.indexOf('ع.ل.م') < 0, 'a clean root is not weak');
  eq(weak[0], 'ك.ت.ب', 'the most-missed root sorts first');
  ok(weak.indexOf('ر.ح.م') >= 0, 'a tie counts as weak');
});

test('recordRootAttempt ignores an empty root', () => {
  eq(A.recordRootAttempt('', false), null);
});

test('vocab flags toggle on and off', () => {
  eq(A.toggleVocabFlag('f::1'), true);
  ok(A.vocabFlags()['f::1'], 'flag is set');
  eq(A.toggleVocabFlag('f::1'), false);
  ok(!A.vocabFlags()['f::1'], 'flag is cleared');
});

console.log('\nQuran word coverage');

// A tiny fixture: two spellings of the same word (both normalise to كتاب), a
// word that never occurs in the text, and a word with no count entry at all.
const FREQ = {
  totalWords: 1000,
  counts: {
    'كِتَاب': { n: 'كتاب', c: 150 },
    'كِتاب': { n: 'كتاب', c: 150 },
    'رَحْمَة': { n: 'رحمه', c: 50 },
    'قَلَم': { n: 'قلم', c: 5 },
    'غَائِب': { n: 'غاءب', c: 0 },
  },
};
const DECKS = {
  a: { words: [{ ar: 'كِتَاب' }, { ar: 'رَحْمَة' }, { ar: 'غَائِب' }] },
  b: { words: [{ ar: 'كِتاب' }, { ar: 'قَلَم' }, { ar: 'ليس-في-القرآن' }] },
};
const knows = (...keys) => (k) => keys.indexOf(k) >= 0;

test('counts distinct normalised forms, not deck entries', () => {
  const c = A.quranCoverage(DECKS, FREQ, () => false);
  eq(c.totalWords, 1000);
  eq(c.deckWords, 6);
  eq(c.mapped, 5, 'the uncounted headword is skipped');
  eq(c.forms, 4, 'كتاب appears twice but is one form');
  eq(c.potentialWords, 205);
  eq(c.potentialPct, 20.5);
  eq(c.knownPct, 0);
});

test('knowing either spelling of a form credits it once', () => {
  const viaA = A.quranCoverage(DECKS, FREQ, knows('a::كِتَاب'));
  const viaB = A.quranCoverage(DECKS, FREQ, knows('b::كِتاب'));
  eq(viaA.knownPct, 15);
  eq(viaB.knownPct, 15, 'the other spelling normalises to the same form');
  eq(viaA.knownWords, 1);
  eq(viaA.knownForms, 1);
  eq(viaA.knownTokens, 150);
});

test('studying two forms sums their occurrences', () => {
  const c = A.quranCoverage(DECKS, FREQ, knows('a::رَحْمَة', 'b::قَلَم'));
  eq(c.knownTokens, 55);
  eq(c.knownPct, 5.5);
  eq(c.knownForms, 2);
  eq(c.knownWords, 2);
});

test('a studied word that never occurs adds no coverage', () => {
  const c = A.quranCoverage(DECKS, FREQ, knows('a::غَائِب'));
  eq(c.knownForms, 1, 'the form is recognised…');
  eq(c.knownTokens, 0, '…but it contributes nothing');
  eq(c.knownPct, 0);
});

test('the real decks + word-freq data produce a sane estimate', () => {
  const read = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
  const decks = read('../data/curriculum/decks.json');
  const freq = read('../data/quran/word-freq.json');
  const all = A.quranCoverage(decks, freq, () => false);
  const some = A.quranCoverage(decks, freq, (k) => k.length % 3 === 0);

  ok(!/NaN/.test(JSON.stringify(all)), 'no NaN may reach the page');
  ok(all.totalWords > 70000, `only ${all.totalWords} Quran tokens counted`);
  ok(all.mapped >= 450, `only ${all.mapped} deck entries matched the Quran text`);
  ok(all.forms >= 400 && all.forms <= all.mapped,
     `${all.forms} distinct forms from ${all.mapped} entries`);
  // The share of the Quran the curriculum can reach at all. If a generator
  // change moved this materially the percentage shown to learners would shift
  // too, so pin it to a wide but meaningful band.
  ok(all.potentialPct > 25 && all.potentialPct < 40,
     `curriculum potential coverage is ${all.potentialPct}%`);
  ok(some.knownPct > 0 && some.knownPct < all.potentialPct,
     `studying a third of the deck gives ${some.knownPct}% of ${all.potentialPct}%`);
  ok(some.knownTokens > 0 && some.knownTokens < all.potentialWords);
});

test('missing or empty frequency data degrades to zero, not NaN', () => {
  const empty = A.quranCoverage(DECKS, null, () => true);
  eq(empty.totalWords, 0);
  eq(empty.potentialPct, 0);
  eq(empty.knownPct, 0);
  ok(!/NaN/.test(JSON.stringify(empty)), 'no NaN may reach the page');
});

// ---------------------------------------------------------------------------

console.log('');
if (failures.length) {
  console.log(`${failures.length} test(s) failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`All ${passed} scheduling tests passed.`);
