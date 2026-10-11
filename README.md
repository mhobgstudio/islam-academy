# ISLAM ACADEMY

A complete, offline-first academy that teaches **Arabic and the Quran from absolute zero** — letters → reading → grammar → understanding the Quran in its own language — plus tajweed and a memorization (hifz) planner.

## Quick start

```bash
cd "ISLAM ACADEMY"
./start.sh                 # serve on :8777 in the foreground
./start.sh --detach        # background, then open a browser
./stop.sh                  # stop it (also ./start.sh --stop)
```

Prefer the plain command? `python3 -m http.server 8777` works too. No build step,
no dependencies, no account. Progress is saved in your browser (localStorage) and
can be exported from the Progress page.

### Verifying a change

```bash
./start.sh --check            # data + JS/link + icon checks, scheduling unit tests,
                              # then the headless smoke test
node tools/test_srs.mjs       # SM-2 / XP / streak unit tests (dependency-free)
node tools/smoke.mjs --deep   # drives every page's real interactions and asserts
                              # the visualisations actually render (needs Node 22+/Chrome)
```

## What is inside

| Page | What it teaches |
|------|-----------------|
| **Home** | Dashboard: XP, streak, level progress |
| **Alphabet** | All 28 letters: names, sounds (audio), 4 positional forms, example words |
| **Reading** | Harakat, sukoon, tanween, madd, shadda, sun/moon letters — with audio drills |
| **Lessons** | 21 interactive lessons in 4 levels (Madinah-method progression) with quizzes and matching exercises |
| **Vocabulary** | 586 flashcards (493 unique words) in 8 decks with an SM-2 spaced-repetition engine |
| **Quran Reader** | All 6,236 ayat: Uthmani script, Saheeh International translation, tap-any-word meaning + audio, 5 reciters, surah recitation — plus a fully offline **Mushaf** view with per-page bookmarks and resume |
| **Tajweed** | Noon/meem sakinah rules, madd lengths, qalqalah, tafkheem, waqf signs |
| **Hifz Planner** | Juz tracker, sabaq/sabqi/manzil method, revision log, random self-test |
| **Search** | One box over vocabulary, lessons, surah names and all 6,236 ayat — Arabic (no diacritics needed) or English, with deep links to the exact word/lesson/ayah |
| **Progress** | Scores, streaks, memory stats, streak calendar, activity chart, "you now know X% of the Quran's running words" coverage, JSON export/import |

## Curriculum design

- **Level 0 — Foundations**: alphabet, letter forms, look-alike families
- **Level 1 — Reading**: vowels → sukoon → tanween → madd → shadda → sun/moon letters → special letters
- **Level 2 — Grammar I**: nominal sentences, pronouns, idafa, prepositions, past/present verbs, plurals
- **Level 3 — Grammar II & Quran**: triliteral roots, case endings (iʿrāb), Fatihah word-by-word, Quranic connectors

The sequence follows the **Madinah Books** method (Dr. V. Abdur Rahim, Islamic University of Madinah) with **frequency-first vocabulary** from the Quranic Arabic Corpus — the top 100 Quranic words cover roughly half of every page of the mushaf.

## Data sources (all free/open)

| Resource | Used for | URL |
|----------|----------|-----|
| fawazahmed0/quran-api (Tanzil Uthmani text) | Quran text, 114 surahs | cdn.jsdelivr.net/gh/fawazahmed0/quran-api |
| Saheeh International (eng-ummmuhammad) | English translation | same CDN |
| quran.com API v4 | word-by-word text, transliteration, per-word audio (Juz Amma + Fatihah) | api.quran.com/api/v4 |
| Quranic Arabic Corpus morphology (v0.4, GPL) | triliteral root of every Quran word — powers the reader's word popover | github.com/mustafa0x/quran-morphology |
| cdn.islamic.network | full recitations (Alafasy, Abdul Basit, Husary, Minshawi) | cdn.islamic.network/quran/audio |
| verses.quran.com | word-by-word MP3s | verses.quran.com/wbw/... |
| Microsoft Edge neural TTS (ar-SA-Zariyah) | 1,000+ local pronunciation clips (letters, examples, vocab, drills) | edge-tts |
| Amiri Quran + Noto Naskh fonts | mushaf-grade Arabic typography | Google Fonts (bundled locally) |

## Rebuilding the data

```bash
python3 tools/fetch_quran.py      # Quran text + translation + metadata (6236 ayat)
python3 tools/fetch_wbw.py        # word-by-word data for Fatihah + Juz Amma
python3 tools/fetch_roots.py      # verified word -> root map (Quranic Arabic Corpus)
python3 tools/fetch_mushaf.py     # re-vendor the 604 Madinah mushaf page layouts
python3 tools/build_word_freq.py  # headword occurrence counts for the coverage estimate
python3 tools/build_curriculum.py # regenerate curriculum JSON
python3 tools/gen_audio.py        # regenerate TTS audio (needs internet, edge-tts)
```

## Offline behavior

- Quran **text**, translation, word-by-word data, all 604 Madinah **mushaf page layouts**, the headword occurrence counts behind the Progress coverage estimate, curriculum, fonts and all 1,000+ pronunciation clips (~20 MB) are stored locally — the academy works with no internet, including the Mushaf view.
- Full-surah recitation and word-by-word MP3s stream from CDNs when online (graceful silence offline).

## Keyboard shortcuts

Vocabulary study: **Space/Enter** reveal the answer, **0–3** grade it
(Again/Hard/Good/Easy), **S** replay the pronunciation. Quran reader: **←/→**
turn mushaf pages, **B** bookmark the page you are on, **Space** play/stop the
surah, **Esc** close the word popover.

## Deep links

The Search page (and any bookmark) can jump straight to content:

```
pages/vocabulary.html?deck=quran-core&q=كتاب   # Browse filtered to a word
pages/grammar.html?level=2&lesson=L2.1         # open a lesson
pages/quran-reader.html?surah=2&ayah=255       # scroll to an ayah
```

## Tech

Pure HTML/CSS/JS (no framework), Python build scripts. ~20 MB of local audio, ~5 MB of data JSON.
