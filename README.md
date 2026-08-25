# ISLAM ACADEMY

A complete, offline-first academy that teaches **Arabic and the Quran from absolute zero** — letters → reading → grammar → understanding the Quran in its own language — plus tajweed and a memorization (hifz) planner.

## Quick start

```bash
cd "ISLAM ACADEMY"
python3 -m http.server 8777
# open http://localhost:8777
```

No build step, no dependencies, no account. Progress is saved in your browser (localStorage) and can be exported from the Progress page.

## What is inside

| Page | What it teaches |
|------|-----------------|
| **Home** | Dashboard: XP, streak, level progress |
| **Alphabet** | All 28 letters: names, sounds (audio), 4 positional forms, example words |
| **Reading** | Harakat, sukoon, tanween, madd, shadda, sun/moon letters — with audio drills |
| **Lessons** | 21 interactive lessons in 4 levels (Madinah-method progression) with quizzes and matching exercises |
| **Vocabulary** | 238 flashcards in 4 decks with an SM-2 spaced-repetition engine |
| **Quran Reader** | All 6,236 ayat: Uthmani script, Saheeh International translation, tap-any-word meaning + audio, 5 reciters, surah recitation |
| **Tajweed** | Noon/meem sakinah rules, madd lengths, qalqalah, tafkheem, waqf signs |
| **Hifz Planner** | Juz tracker, sabaq/sabqi/manzil method, revision log, random self-test |
| **Progress** | Scores, streaks, memory stats, JSON export |

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
| cdn.islamic.network | full recitations (Alafasy, Abdul Basit, Husary, Minshawi) | cdn.islamic.network/quran/audio |
| verses.quran.com | word-by-word MP3s | verses.quran.com/wbw/... |
| Microsoft Edge neural TTS (ar-SA-Zariyah) | 325 local pronunciation clips (letters, examples, vocab, drills) | edge-tts |
| Amiri Quran + Noto Naskh fonts | mushaf-grade Arabic typography | Google Fonts (bundled locally) |

## Rebuilding the data

```bash
python3 tools/fetch_quran.py      # Quran text + translation + metadata (6236 ayat)
python3 tools/fetch_wbw.py        # word-by-word data for Fatihah + Juz Amma
python3 tools/build_curriculum.py # regenerate curriculum JSON
python3 tools/gen_audio.py        # regenerate TTS audio (needs internet, edge-tts)
```

## Offline behavior

- Quran **text**, translation, word-by-word data, curriculum, fonts and all 325 pronunciation clips are stored locally — the academy works with no internet.
- Full-surah recitation and word-by-word MP3s stream from CDNs when online (graceful silence offline).

## Tech

Pure HTML/CSS/JS (no framework), Python build scripts. ~4 MB of local audio, ~1 MB of data JSON.
