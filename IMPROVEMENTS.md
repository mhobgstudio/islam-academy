# ISLAM ACADEMY — Review & Improvement Report

**Date:** September 29, 2026
**Scope:** full repository review — correctness, robustness, accessibility, UX, and visualisation quality.

Everything the automated suite can check passes:

```
$ ./start.sh --check
decks        : 8 decks, 586 words (491 with a root, 95 typed as function words)
lexicon      : 589 roots
word-roots   : 14142 surface forms
levels       : 21 lessons
mushaf       : 604 vendored page layouts
word-freq    : 493 headword counts, 24463/79848 (30.6%) of running words reachable from the curriculum
audio        : 591 mapped clips + 56 letter clips

All data checks passed.
checked 34 script block(s) across 14 file(s)
All scripts parse, tags balance, links resolve, tashkeel regexes and SRS keys are consistent.
U+0642 renders in the font; all icons have sane coverage.
All 30 scheduling tests passed.
All 14 pages render with no console errors or failed requests.

$ node tools/smoke.mjs --deep
All 14 page checks render with no console errors or failed requests (deep: seeded
progress, driven interactions, visualisation + layout assertions, offline Mushaf,
coverage card, mushaf bookmarks).
```

---

## 🔴 Bugs found and fixed

| # | Where | Problem | Fix |
|---|-------|---------|-----|
| 1 | `data/curriculum/levels.json` | The Level 3 lesson link was `/pages/quran-reader.html?surah=1` — an **absolute** path. It only worked at a domain root and 404'd when the academy is served from a repository sub-path (the case `app.js`/`sw.js` explicitly support). | Changed to the relative `quran-reader.html?surah=1`. |
| 2 | `stop.sh` | `./stop.sh --bogus` (any single unknown flag) fell through to the bare-stop branch and exited **0** instead of rejecting the option. | Explicit `""` (bare stop) vs `*` (die) cases; unknown flags now exit 1. |
| 3 | `tools/sync_pages.py` | `src = src[:n] + re.pattern and (block) + src[n:]` relied on `and` operator precedence. It happened to produce the right string, but any edit to that expression silently truncated the page. | Factored the service-worker block into an explicit `sw_block` variable. |
| 4 | `tools/check_js.py` | A duplicate/unreachable block (`print`, `if problems…`) sat after `return out` inside `blocks()`, referencing undefined locals. Dead, confusing, and one indentation slip from running. | Removed. |
| 5 | `pages/progress.html` | Dead, self-contradicting line `const pct = Math.round((…) ? 0 : 0);` computed and then immediately shadowed by the real `pct` property. | Removed. |
| 6 | `assets/js/app.js` | `pruneActivity()` was only called from `completeLesson()`, so a long vocabulary session could grow the activity map past its 400-day bound. | `addXP()` — the single write path — now prunes. |
| 7 | `pages/vocabulary.html` | The flashcard help tooltip advertised keyboard shortcuts (`Again 0`, `Hard 1`, …) that **did not exist**. | Implemented them (see below) and routed the mouse and keyboard through one flip/grade path. |
| 8 | `sw.js` | The offline shell precached fonts/CSS/JS but not `assets/images/hero-mosque.jpg`, so the home hero lost its background offline. | Added to the precache shell. |
| 9 | `tools/check_data.py` | Nothing verified that the 591 `audioMap` clips (and the 56 letter clips) actually exist — a missing file is silent in the browser. | Added an audio-reference check; it now runs on every `--check`. |
| 10 | `assets/js/app.js` | `day()` was called with no argument, so `new Date(undefined)` produced an **Invalid Date** and every session was filed under the activity key `NaN-NaN-NaN`. Real XP, cards and lessons never appeared in the Progress activity chart or streak calendar. | A missing argument now means "now"; a unit test locks it down. |

### Verification gaps closed

The smoke test previously only asserted that pages *mount*. `tools/smoke.mjs --deep` now:

- seeds realistic progress (XP history, SRS state, hifz plan) so dashboards render with data;
- drives each page's real interactions (mode switches, card flips + grading, quiz answers, juz toggles, font/text-mode/surah controls, word popover, search in English *and* undiacritised Arabic);
- asserts visualisations are genuinely painted: 84 activity bars (not just present), 26 heat-map week columns, active heat cells where there is activity, non-uniform word-cloud sizes, pre-sized progress fills;
- asserts no page overflows the viewport horizontally;
- checks the Search page's deep links land on the right word, lesson and ayah;
- asserts the coverage card reports a non-zero percentage and a filled bar, and that a Mushaf bookmark round-trips through localStorage, the jump dropdown and a page change.

---

## 🟢 Improvements implemented

- **Global Search** (`pages/search.html`) — one box over vocabulary (8 decks / 586 words), all 21 lessons, 114 surah names and all 6,236 ayat, in Arabic (diacritics optional — `رحمه` finds `رَحْمَة`) or English. Scope filter (All / Vocabulary / Lessons / Quran), debounced live results, keyboard-first (`Enter` jumps to the first hit, `Esc` clears), `role="status"` progress. The Quran corpus (~2.4 MB) loads lazily on the first real query, so normal visits stay light.
- **Deep links** — search results open the exact target: `vocabulary.html?deck=…&q=…` (Browse filtered to the word), `grammar.html?level=…&lesson=…` (opens the lesson), `quran-reader.html?surah=…&ayah=…` (scrolls to and flashes the ayah).
- **Vocabulary keyboard shortcuts** — `Space`/`Enter` reveal, `0–3` grade, `S` replays audio; works alongside the mouse and is announced in the on-page help.
- **XP rebalance** — a memorised juz was worth 50 XP, the same as 25 flashcards. A juz is now 200 XP and a reading challenge 5 XP, so effort is priced coherently (lesson pass ≈ 55 XP, flashcard 2 XP).
- **Offline Mushaf** — all 604 Madinah page layouts are vendored into `data/quran/mushaf-pages.json` (1.6 MB, compacted to the `page`/`type`/`text`/`surah` fields the renderer uses) by `tools/fetch_mushaf.py`. The reader no longer touches a third-party CDN, the bundle is precached, and the page header now names the surah instead of showing `001`.
- **Unit tests for the scheduling core** — `tools/test_srs.mjs`, 30 dependency-free tests (loaded through `node:vm`, no test framework) covering SM-2 intervals/ease/floor, `dueCards`/`srsStats`, `cardKey`, lesson XP, streaks, the 400-day activity bound, weak roots, vocab flags and the Quran coverage maths. Wired into `./start.sh --check`.
- **Quran word coverage** (`pages/progress.html`) — a "you now know X% of the Quran's running words" card. `tools/build_word_freq.py` counts how often every curriculum headword occurs in the bundled Uthmani text (output `data/quran/word-freq.json`, 18 KB), because tokenising 1.4 MB in the browser on every visit would be wasteful. `Academy.quranCoverage()` de-duplicates headwords by normalised form — so two spellings of one word are not counted twice — and the card reports studied coverage, mature-only coverage, forms covered and the ceiling the full curriculum could reach (30.6%). The counts are recomputed from the text by `tools/check_data.py` on every `--check`, and a unit test loads the real decks + counts so a generator change cannot silently shift the learner-facing number.
- **Mushaf page bookmarks and resume** — the offline Mushaf view now stores page-accurate bookmarks (`quran-mushaf-bookmarks-v1`), toggled by a toolbar button or **B**, listed in a jump dropdown labelled with the page's surah and juz, and it remembers the page you were last on so returning to the Mushaf resumes there. A surah-level "last read" pointer cannot express a mid-juz page, which is exactly where a reader stops, so the resume banner now offers "📖 Mushaf p.N" alongside the surah.
- **Dead assets removed** — the seven unreferenced images (~1.4 MB) are gone; only `assets/images/hero-mosque.jpg` remains and it is precached.
- **Offline completeness** — hero image precached; new Search page registered in the service worker and nav.
- **Reliability** — the audio-reference check, the deep audit mode, the scheduling unit tests, and the `stop.sh` option handling above.
- **Nav cleanup** — removed an unused third element from the nav table and added Search.

---

## 🟡 Remaining suggestions (not implemented)

1. **`$HOME/` directory.** A copy of a home directory (OmniRoute session state incl. a session key) still sits on disk next to the project. It is gitignored and untracked, but it should be removed and the key rotated; removing it does not scrub it from earlier history.
2. **A real Mushaf layout instead of the vendored line dump.** The page layout is exact, but it still renders as justified text lines rather than typeset mushaf pages with verse markers and a real page-facing layout. A dedicated renderer (per-line width fitting, surah ornaments per page) would be the last mile for the offline Mushaf.
3. **Spaced repetition for the grammar drills.** The Roots drill reports every attempt (which feeds `weakRoots()`), but only vocabulary is scheduled. Scheduling the lessons' drills with the same SM-2 engine would make "review what you keep getting wrong" cover the whole curriculum.
