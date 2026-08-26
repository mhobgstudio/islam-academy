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

  // Universal Arabic TTS — local MP3 first, then Web Speech API, then visual feedback
  const speechSynth = typeof speechSynthesis !== "undefined" ? speechSynthesis : null;
  let arabicVoice = null;
  let voicesChecked = false;
  function getArabicVoice() {
    if (voicesChecked && arabicVoice === false) return null;
    if (arabicVoice && arabicVoice !== false) return arabicVoice;
    if (!speechSynth) return null;
    const voices = speechSynth.getVoices();
    if (voices.length === 0) return null;
    voicesChecked = true;
    arabicVoice = voices.find(v => v.lang === "ar-SA")
      || voices.find(v => v.lang && v.lang.startsWith("ar"))
      || false;
    return arabicVoice || null;
  }
  if (speechSynth) {
    speechSynth.onvoiceschanged = () => { arabicVoice = null; voicesChecked = false; getArabicVoice(); };
    getArabicVoice();
  }

  // Known text → local audio file mapping (curated from gen_audio.py)
  const audioMap = {
    // Phrases
    "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ": "drills/phrases/bismillah.mp3",
    "بِسْمِ اللَّهِ": "drills/phrases/bismillah.mp3",
    "أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ": "drills/phrases/istiadha.mp3",
    "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ": "drills/phrases/alhamdulillah.mp3",
    "سُبْحَانَ اللهِ": "drills/phrases/subhanallah.mp3",
    "اللهُ أَكْبَرُ": "drills/phrases/allahuakbar.mp3",
    "أَسْتَغْفِرُ اللهَ": "drills/phrases/astaghfirullah.mp3",
    "جَزَاكَ اللهُ خَيْرًا": "drills/phrases/jazakallah.mp3",
    "إِنْ شَاءَ اللهُ": "drills/phrases/inshallah.mp3",
    "مَا شَاءَ اللهُ": "drills/phrases/mashallah.mp3",
    "رَبِّ زِدْنِي عِلْمًا": "drills/phrases/bismillah.mp3", // reuse
    // Tajweed
    "مِنْ خَيْر": "drills/tajweed/izhar.mp3",
    "مَنْ يَعْمَل": "drills/tajweed/idgham.mp3",
    "مِنْ بَعْد": "drills/tajweed/iqlab.mp3",
    "مِنْ قَبْل": "drills/tajweed/ikhfa.mp3",
    "قَالَ": "drills/madd-aa.mp3",
    "جَاءَ": "drills/tajweed/madd-muttasil.mp3",
    "يَا أَيُّهَا": "drills/tajweed/madd-munfasil.mp3",
    "الضَّالِّينَ": "drills/tajweed/madd-laazim.mp3",
    "اقْرَأْ": "drills/tajweed/qalqalah.mp3",
    "صِرَاط": "drills/tajweed/tafkheem.mp3",
    // Vowels
    "بَ": "drills/fatha.mp3",
    "بُ": "drills/damma.mp3",
    "بِ": "drills/kasra.mp3",
    "أَبْ": "drills/sukoon.mp3",
    "رَبَّ": "drills/shadda.mp3",
    "الشَّمْسُ وَالْقَمَرُ": "drills/sun-moon.mp3",
    // Reading words
    "بَاب": "drills/reading/baab.mp3",
    "كِتَاب": "drills/reading/kitaab.mp3",
    "مَاء": "drills/reading/maa.mp3",
    "شَمْس": "drills/reading/shams.mp3",
    "قَمَر": "drills/reading/qamar.mp3",
    "يَوْم": "drills/reading/yawm.mp3",
    "لَيْل": "drills/reading/layl.mp3",
    "رَجُل": "drills/reading/rajul.mp3",
    "مَرْأَة": "drills/reading/mar'a.mp3",
    "بَيْت": "drills/reading/bayt.mp3",
    "سَلَام": "drills/reading/salaam.mp3",
    "نُور": "drills/reading/noor.mp3",
    "صَلَاة": "drills/reading/salaah.mp3",
    "قُرْآن": "drills/reading/quran.mp3",
    "مَسْجِد": "drills/reading/masjid.mp3",
    "عِلْم": "drills/reading/ilm.mp3",
    "كَلِمَة": "drills/reading/kalimah.mp3",
    "حَقّ": "drills/reading/haqq.mp3",
    // Challenge sentences
    "الْمَسْجِدُ كَبِيرٌ": "drills/reading/challenge-0.mp3",
    "الْكِتَابُ جَدِيدٌ": "drills/reading/challenge-1.mp3",
    "الشَّمْسُ مُشْرِقَةٌ": "drills/reading/challenge-2.mp3",
    // Grammar roots
    "كِتَاب": "drills/grammar/kitaab.mp3",
    "كَاتِب": "drills/grammar/katib.mp3",
    "كَتَبَ": "drills/grammar/kataba.mp3",
    "مَكْتَبَة": "drills/grammar/maktaba.mp3",
    "مَكْتُوب": "drills/grammar/maktub.mp3",
    "عِلْم": "drills/grammar/ilm.mp3",
    "عَالِم": "drills/grammar/aalim.mp3",
    "مَعْلُوم": "drills/grammar/ma'lum.mp3",
    "تَعْلِيم": "drills/grammar/ta'leem.mp3",
    "رَحْمَة": "drills/grammar/rahma.mp3",
    "رَحِيم": "drills/grammar/raheem.mp3",
    "رَحَمَ": "drills/grammar/rahima.mp3",
    "إِسْلَام": "drills/grammar/islam.mp3",
    "مُسْلِم": "drills/grammar/muslim.mp3",
    "سَلِيم": "drills/grammar/saleem.mp3",
    "فَتْح": "drills/grammar/fath.mp3",
    "فَاتِحَة": "drills/grammar/fatiha.mp3",
    "فَتَحَ": "drills/grammar/fataha.mp3",
    "قِرَاءَة": "drills/grammar/qira'ah.mp3",
    "قَارِئ": "drills/grammar/qaari.mp3",
    "قَرَأَ": "drills/grammar/qara'a.mp3",
    "مَقْرَأ": "drills/grammar/maqra.mp3",
    // Grammar prefixes
    "الْكِتَابُ": "drills/grammar/al-kitaab.mp3",
    "بِالْكِتَابِ": "drills/grammar/bil-kitaab.mp3",
    "لِلَّهِ": "drills/grammar/lillah.mp3",
    "كَالشَّمْسِ": "drills/grammar/kash-shams.mp3",
    "وَالْكِتَابُ": "drills/grammar/wal-kitaab.mp3",
    "يَكْتُبُ": "drills/grammar/yaktubu.mp3",
    "نَكْتُبُ": "drills/grammar/naktubu.mp3",
    "أَكْتُبُ": "drills/grammar/aktubu.mp3",
    "لَمْ يَكْتُبْ": "drills/grammar/lam-yaktub.mp3",
    "لَنْ يَكْتُبَ": "drills/grammar/lan-yaktuba.mp3",
    "مَا كَتَبَ": "drills/grammar/ma-kataba.mp3",
    // Grammar suffixes
    "كِتَابِي": "drills/grammar/kitaabi.mp3",
    "كِتَابُكَ": "drills/grammar/kitaabuka.mp3",
    "كِتَابُكِ": "drills/grammar/kitaabuki.mp3",
    "كِتَابُهُ": "drills/grammar/kitaabuhu.mp3",
    "كِتَابُهَا": "drills/grammar/kitaabuha.mp3",
    "كِتَابُنَا": "drills/grammar/kitaabuna.mp3",
    "كِتَابُكُمْ": "drills/grammar/kitaabukum.mp3",
    "كِتَابُهُمْ": "drills/grammar/kitaabuhum.mp3",
    "كَتَبْتُ": "drills/grammar/katabtu.mp3",
    "كَتَبْتَ": "drills/grammar/katabta.mp3",
    "كَتَبْتِ": "drills/grammar/katabti.mp3",
    "كَتَبَتْ": "drills/grammar/katabat.mp3",
    "كَتَبْنَا": "drills/grammar/katabna.mp3",
    "كَتَبْتُمْ": "drills/grammar/katabtum.mp3",
  };

  // Strip diacritics for fuzzy matching
  function stripDiac(s) { return s.replace(/[\u064B-\u065F\u0670]/g, "").replace(/\s+/g, " ").trim(); }

  function findLocalAudio(text) {
    // Exact match
    if (audioMap[text]) return "../assets/audio/" + audioMap[text];
    // Strip diacritics and try again
    const stripped = stripDiac(text);
    for (const [key, val] of Object.entries(audioMap)) {
      if (stripDiac(key) === stripped) return "../assets/audio/" + val;
    }
    return null;
  }

  function speakArabic(text, btn) {
    if (!text) return;
    if (btn) { btn.classList.add("speaking"); }

    // 1) Try local MP3 file first (fastest, most reliable)
    const localPath = findLocalAudio(text);
    if (localPath) {
      speak(localPath, btn);
      return;
    }

    // 2) Try Web Speech API
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
    } else if (speechSynth && !voicesChecked) {
      // Voices not loaded yet — retry
      setTimeout(() => speakArabic(text, btn), 300);
    } else {
      // 3) No audio available — flash red
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
