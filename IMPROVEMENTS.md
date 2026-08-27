# ISLAM ACADEMY — Improvement Report

**Date:** August 27, 2026  
**Analysis Type:** Errors, Inconsistencies, Incompleteness, Missed Sections

---

## 🔴 Errors Found

### 1. Missing Audio Files (Broken Audio)
- `reading.html` references audio files like `drills/fatha.mp3`, `drills/damma.mp3`, etc. via `speakLocal()` — but `app.js` resolves these relative to `../assets/audio/`. These files **must exist** or audio will silently fail.
- The `audioMap` in `app.js` maps `رَبِّ زِدْنِي عِلْمًا` to `drills/phrases/bismillah.mp3` (reusing bismillah audio) — this is incorrect; a proper recording should be generated.

### 2. Hifz Planner — Random Surah Bug
- In `hifz.html`, the "Test me" random surah feature hardcodes `meta.filter(m => m.number >= 78)` — this only selects from the last 37 surahs (Juz Amma area). This excludes most of the mushaf and doesn't respect the user's hifz progress.

### 3. Vocabulary SRS — Missing `speakLocal` Import
- `vocabulary.html` calls `speakWord(w)` which tries to resolve audio via a hash-based path `../assets/audio/vocab/${deckId}/${hash}.mp3`. The hash generation logic uses a simple modulo that may collide. The function doesn't use `Academy.speakArabic()` which has the audioMap fallback — this means vocab audio will **always fail** for words not in the pre-generated cache.

### 4. Progress Page Not Created
- The nav includes `progress.html` in the navigation array but **no such file exists** in the pages directory. Users clicking "Progress" will get a 404.

### 5. Quran Reader Page Missing
- The home page links to `pages/quran-reader.html` multiple times, and `nav.js` includes it, but this file does not exist in the repository. This is a **critical missing feature**.

---

## 🟡 Inconsistencies

### 1. Theme Handling Split Across Files
- `app.js` uses `state.settings.theme` and saves to the `islam-academy-v1` key.
- `nav.js` reads from the same key but initializes independently.
- Both add event listeners to toggle the theme — potential race condition on page load.

### 2. CSS Files Referenced But Not Verified
- `index.html` loads `assets/css/academy.css` and `assets/css/components.css` — the `assets/css/` directory exists but its contents weren't verified for completeness against all classes used across pages.

### 3. SRS Grade Mismatch
- Vocabulary page offers 4 grades (Again/Hard/Good/Easy) mapped to grades 0-3.
- `app.js` `reviewCard()` expects grades 0-3 but the mapping in vocabulary is `gradeBtn("Again", "again", 0), gradeBtn("Hard", "hard", 1), gradeBtn("Good", "good", 2), gradeBtn("Easy", "easy", 3)` — this matches, but the SRS interval logic treats grade 1 (Hard) and grade 0 (Again) very similarly for first rep (0.5 vs 1 day), which may cause cards to appear too soon.

### 4. XP Inconsistency
- Vocabulary awards `2 XP` per card review.
- Hifz planner awards `50 XP` per juz marked done and `10 XP` per log entry.
- Reading practice awards `10 XP` per completed challenge.
- These rates are wildly disproportionate — reviewing 25 flashcards (50 XP) equals marking one juz memorized.

---

## 🟠 Incompleteness

### 1. Missing Pages
- **`progress.html`** — Referenced in nav but doesn't exist. Should show XP history, streak calendar, SRS stats, and export.
- **`quran-reader.html`** — Core feature referenced everywhere but missing. This is the Quran Track's primary tool.

### 2. No Service Worker for Offline
- README claims "works offline once loaded" but no service worker (`sw.js`) or manifest (`manifest.json`) exists. The app cannot function offline.

### 3. No Keyboard Shortcuts
- No keyboard navigation support for flashcards (e.g., Space to flip, 1-4 to grade). This is standard for SRS apps.

### 4. No Data Backup/Restore
- All progress is in localStorage with no export/import mechanism despite README claiming "JSON export."

### 5. Missing Error States
- Pages that fail to load JSON data show basic error messages but no retry mechanism.

---

## 🔵 Missed Sections & Improvements

### 1. Tajweed Interactive Examples
- Tajweed rules are displayed statically. Should include **interactive tajweed coloring** — highlight the rule-applied letters in the Quran reader when a rule is selected.

### 2. Grammar Lessons — No Quiz System
- Grammar lessons (`grammar.html`) load from JSON but the quiz system is not visible in the code — needs verification that lesson quizzes actually render and score.

### 3. Arabic Calligraphy/Font Fallback
- Amiri and Noto Naskh fonts are referenced as "bundled locally" in README but loaded from Google Fonts in the HTML. The local fonts in `assets/fonts/` should be verified.

### 4. Missing Accessibility
- No ARIA labels on interactive elements (buttons, cards, progress bars).
- No `aria-live` regions for dynamic content updates (e.g., "2 cards left").
- No `prefers-reduced-motion` media query.

### 5. Missing PWA Support
- No `manifest.json` for installability.
- No offline caching strategy.
- No splash screen or app icons.

### 6. Missing Analytics/Progress Charts
- No visual progress charts (spaced repetition heatmaps, XP over time, reading streak calendar).

### 7. Missing Search Functionality
- No global search across vocabulary, lessons, or Quran text.

---

## 📋 Priority Recommendations

| Priority | Issue | Impact |
|----------|-------|--------|
| 🔴 P0 | Create `quran-reader.html` | Core feature missing |
| 🔴 P0 | Create `progress.html` | Nav 404 error |
| 🔴 P0 | Add service worker for offline | Broken offline promise |
| 🟡 P1 | Fix vocab audio to use `speakArabic()` fallback | Audio broken for most words |
| 🟡 P1 | Add keyboard shortcuts to SRS | Major UX gap |
| 🟡 P1 | Create `manifest.json` for PWA | Installability |
| 🟠 P2 | Add ARIA accessibility labels | Accessibility compliance |
| 🟠 P2 | Add progress charts/heatmap | User engagement |
| 🔵 P3 | Balance XP rates across features | Gamification fairness |
| 🔵 P3 | Add global search | Discoverability |
