/* ISLAM ACADEMY — core engine: state, SRS, audio, XP */
(function () {
  "use strict";
  const KEY = "islam-academy-v1";

  const DEFAULTS = {
    xp: 0,
    streak: { count: 0, last: null },
    lessonsDone: {},          // lessonId -> {score, date}
    srs: {},                  // cardKey -> {ease, interval, due, reps, lapses}
    hifz: { plan: null, log: [] },
    settings: { reciter: "ar.alafasy", translit: true, theme: "light" },
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULTS);
      return Object.assign(structuredClone(DEFAULTS), JSON.parse(raw));
    } catch (e) {
      return structuredClone(DEFAULTS);
    }
  }
  let state = load();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  // ---------- streak / xp ----------
  function todayStr(d) {
    d = d || new Date();
    return d.toISOString().slice(0, 10);
  }
  function touchStreak() {
    const t = todayStr();
    if (state.streak.last === t) return;
    const y = todayStr(new Date(Date.now() - 86400000));
    state.streak.count = state.streak.last === y ? state.streak.count + 1 : 1;
    state.streak.last = t;
    save();
  }
  function addXP(n) {
    state.xp += n;
    touchStreak();
    save();
  }

  // ---------- SRS (SM-2 lite) ----------
  // grade: 0 again, 1 hard, 2 good, 3 easy
  function reviewCard(cardKey, grade) {
    const now = Date.now();
    let c = state.srs[cardKey] || { ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0 };
    if (grade === 0) {
      c.reps = 0;
      c.lapses++;
      c.interval = 0;
      c.ease = Math.max(1.3, c.ease - 0.2);
      c.due = now + 10 * 60 * 1000; // 10 min
    } else {
      const q = grade === 1 ? 3 : grade === 2 ? 4 : 5;
      c.ease = Math.max(1.3, c.ease + (0.1 - (5 - q) * 0.08));
      c.reps++;
      if (c.reps === 1) c.interval = grade === 1 ? 0.5 : 1;
      else if (c.reps === 2) c.interval = grade === 1 ? 2 : 3;
      else c.interval = Math.round(c.interval * c.ease * (grade === 1 ? 0.7 : grade === 3 ? 1.2 : 1));
      c.due = now + c.interval * 86400000;
    }
    state.srs[cardKey] = c;
    save();
    return c;
  }
  function dueCards(keys) {
    const now = Date.now();
    return keys.filter((k) => !state.srs[k] || state.srs[k].due <= now);
  }
  function srsStats(keys) {
    const now = Date.now();
    let due = 0, learning = 0, young = 0, mature = 0;
    keys.forEach((k) => {
      const c = state.srs[k];
      if (!c) { due++; return; }
      if (c.due <= now) due++;
      if (c.interval < 21) young++; else mature++;
    });
    return { total: keys.length, due, young, mature };
  }

  // ---------- lessons ----------
  function completeLesson(id, scorePct) {
    const prev = state.lessonsDone[id];
    state.lessonsDone[id] = { score: Math.max(scorePct, prev ? prev.score : 0), date: Date.now() };
    addXP(Math.round(20 + scorePct * 0.5));
  }
  function lessonScore(id) {
    return state.lessonsDone[id] ? state.lessonsDone[id].score : null;
  }

  // ---------- audio ----------
  const player = new Audio();
  let currentBtn = null;
  function speak(src, btn) {
    player.pause();
    player.src = src;
    player.play().catch(() => {});
    if (currentBtn) currentBtn.classList.remove("speaking");
    currentBtn = btn || null;
    if (btn) btn.classList.add("speaking");
    player.onended = () => { if (currentBtn) currentBtn.classList.remove("speaking"); currentBtn = null; };
  }
  function speakLocal(relPath, btn) {
    // resolve relative to this page -> assets/audio/
    speak("../assets/audio/" + relPath, btn);
  }
  function ayahAudio(reciter, globalAyahNumber) {
    return `https://cdn.islamic.network/quran/audio/128/${reciter}/${globalAyahNumber}.mp3`;
  }
  function wbwAudio(urlSuffix) {
    return "https://verses.quran.com/" + urlSuffix;
  }

  // Universal Arabic TTS — Web Speech API (Chrome/Edge/Safari have ar-SA voices)
  const speechSynth = typeof speechSynthesis !== "undefined" ? speechSynthesis : null;
  let arabicVoice = null;
  let voicesLoaded = false;
  function getArabicVoice() {
    if (arabicVoice !== null) return arabicVoice;
    if (!speechSynth) return null;
    const voices = speechSynth.getVoices();
    if (voices.length === 0) return null; // not loaded yet
    voicesLoaded = true;
    // prefer ar-SA voices (Zariyah, Tarik, Hamed, etc.)
    arabicVoice = voices.find(v => v.lang === "ar-SA")
      || voices.find(v => v.lang && v.lang.startsWith("ar"))
      || null;
    return arabicVoice;
  }
  // Pre-load voices (they load async in Chrome/Edge)
  if (speechSynth) {
    speechSynth.onvoiceschanged = () => { arabicVoice = null; getArabicVoice(); };
    // Also try immediately in case they're already loaded
    getArabicVoice();
  }

  function speakArabic(text, btn) {
    if (!text) return;
    if (btn) { btn.classList.add("speaking"); }
    const voice = getArabicVoice();
    if (speechSynth && voice) {
      speechSynth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = "ar-SA";
      u.rate = 0.8;
      u.onend = () => { if (btn) btn.classList.remove("speaking"); };
      u.onerror = () => { if (btn) btn.classList.remove("speaking"); };
      speechSynth.speak(u);
    } else if (speechSynth && !voicesLoaded) {
      // Voices haven't loaded yet — retry after a short delay
      setTimeout(() => speakArabic(text, btn), 200);
    } else {
      // No Arabic voice available — flash the button as visual feedback
      if (btn) {
        btn.classList.remove("speaking");
        btn.style.background = "var(--danger)";
        btn.style.color = "#fff";
        setTimeout(() => { btn.style.background = ""; btn.style.color = ""; }, 800);
      }
    }
  }

  // Create a speaker button element
  function speakerBtn(text, label) {
    return el("button", {
      class: "btn small ghost speaker-inline",
      title: "Listen",
      onclick: (e) => { e.stopPropagation(); speakArabic(text, e.currentTarget); }
    }, "🔊" + (label ? " " + label : ""));
  }

  // ---------- utils ----------
  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") e.className = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    });
    children.flat().forEach((c) => {
      if (c == null) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  async function fetchJSON(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error(path + ": " + r.status);
    return r.json();
  }

  window.Academy = {
    get state() { return state; },
    save, addXP, touchStreak,
    reviewCard, dueCards, srsStats,
    completeLesson, lessonScore,
    speak, speakLocal, ayahAudio, wbwAudio,
    speakArabic, speakerBtn,
    el, shuffle, fetchJSON, todayStr,
  };
})();
