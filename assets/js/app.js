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
    "رَبِّ زِدْنِي عِلْمًا": "drills/phrases/rabbi-zidni-ilma.mp3",
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
    // --- Vocab deck entries (hash-named MP3s from gen_audio.py) ---
    // quran-core
    "نجوم": "vocab/quran-core/66650503.mp3",
    "الذين": "vocab/quran-core/104538870.mp3",
    "سمع": "vocab/quran-core/147112078.mp3",
    "باب": "vocab/quran-core/297104530.mp3",
    "قلب": "vocab/quran-core/326700248.mp3",
    "نهار": "vocab/quran-core/343488011.mp3",
    "موت": "vocab/quran-core/422820166.mp3",
    "فرعون": "vocab/quran-core/453827110.mp3",
    "نبات": "vocab/quran-core/695442844.mp3",
    "وقت": "vocab/quran-core/1011635715.mp3",
    "مسلم": "vocab/quran-core/1072411472.mp3",
    "يوم": "vocab/quran-core/1223877712.mp3",
    "أشجار": "vocab/quran-core/1327713618.mp3",
    "غفران": "vocab/quran-core/1333146591.mp3",
    "الرحيم": "vocab/quran-core/1385858761.mp3",
    "موسى": "vocab/quran-core/1522837922.mp3",
    "صدق": "vocab/quran-core/1889849054.mp3",
    "بني": "vocab/quran-core/1917996507.mp3",
    "قمر": "vocab/quran-core/1960852111.mp3",
    "حساب": "vocab/quran-core/2210524037.mp3",
    "شرب": "vocab/quran-core/2278326628.mp3",
    "إنسان": "vocab/quran-core/2406630268.mp3",
    "جلس": "vocab/quran-core/2512775981.mp3",
    "زكاة": "vocab/quran-core/2543831762.mp3",
    "الله": "vocab/quran-core/2716692615.mp3",
    "نار": "vocab/quran-core/2758337792.mp3",
    "كذب": "vocab/quran-core/2842291677.mp3",
    "صوم": "vocab/quran-core/2939314585.mp3",
    "الرحمن": "vocab/quran-core/2966334896.mp3",
    "عيسى": "vocab/quran-core/2994792888.mp3",
    "ليل": "vocab/quran-core/3006865161.mp3",
    "الكتاب": "vocab/quran-core/3068568069.mp3",
    "مشى": "vocab/quran-core/3121957148.mp3",
    "شجر": "vocab/quran-core/3167043367.mp3",
    "كافر": "vocab/quran-core/3177443810.mp3",
    "رسول": "vocab/quran-core/3203048177.mp3",
    "صلاة": "vocab/quran-core/3204169417.mp3",
    "كلام": "vocab/quran-core/3213801999.mp3",
    "آية": "vocab/quran-core/3292219959.mp3",
    "جنّ": "vocab/quran-core/3381137942.mp3",
    "سبيل": "vocab/quran-core/3480033218.mp3",
    "مؤمن": "vocab/quran-core/3646192878.mp3",
    "شمس": "vocab/quran-core/3655509141.mp3",
    "كان": "vocab/quran-core/3700984662.mp3",
    "جنة": "vocab/quran-core/3710209923.mp3",
    "عذاب": "vocab/quran-core/3738654353.mp3",
    "ماء": "vocab/quran-core/3781640081.mp3",
    "بيت": "vocab/quran-core/4013280226.mp3",
    "دنيا": "vocab/quran-core/4045416074.mp3",
    "أمّة": "vocab/quran-core/4205036517.mp3",
    "محمد": "vocab/quran-core/4297986343.mp3",
    "شيء": "vocab/quran-core/4339705924.mp3",
    "حياة": "vocab/quran-core/4423711893.mp3",
    "السماء": "vocab/quran-core/4447668459.mp3",
    "رأى": "vocab/quran-core/4638615166.mp3",
    "ملك": "vocab/quran-core/4647022154.mp3",
    "عقاب": "vocab/quran-core/4772821235.mp3",
    "ربّ": "vocab/quran-core/4796489162.mp3",
    "شيطان": "vocab/quran-core/5091859710.mp3",
    "جبال": "vocab/quran-core/5120232191.mp3",
    "نوح": "vocab/quran-core/5194623408.mp3",
    "فضل": "vocab/quran-core/5200773217.mp3",
    "حجّ": "vocab/quran-core/5223435122.mp3",
    "أكل": "vocab/quran-core/5606407363.mp3",
    "بحر": "vocab/quran-core/5718703959.mp3",
    "آخرة": "vocab/quran-core/5748378356.mp3",
    "ملائكة": "vocab/quran-core/5878907879.mp3",
    "ظلم": "vocab/quran-core/5982896032.mp3",
    "ساعة": "vocab/quran-core/6104083618.mp3",
    "أنعام": "vocab/quran-core/6263441183.mp3",
    "صبر": "vocab/quran-core/6278811746.mp3",
    "أتى": "vocab/quran-core/6463270049.mp3",
    "جازاء": "vocab/quran-core/6904986166.mp3",
    "رحمة": "vocab/quran-core/7195520083.mp3",
    "كفر": "vocab/quran-core/7362696795.mp3",
    "طير": "vocab/quran-core/7451317900.mp3",
    "خير": "vocab/quran-core/7552113070.mp3",
    "الأرض": "vocab/quran-core/7599832975.mp3",
    "شفاعة": "vocab/quran-core/7652148228.mp3",
    "خلق": "vocab/quran-core/7736866929.mp3",
    "قيامة": "vocab/quran-core/7819276369.mp3",
    "توبة": "vocab/quran-core/7836123017.mp3",
    "قال": "vocab/quran-core/7937377214.mp3",
    "حقّ": "vocab/quran-core/7939124624.mp3",
    "الناس": "vocab/quran-core/7958946236.mp3",
    "ثواب": "vocab/quran-core/8040110822.mp3",
    "علم": "vocab/quran-core/8109934200.mp3",
    "أمر": "vocab/quran-core/8414548236.mp3",
    "نبيّ": "vocab/quran-core/8490748911.mp3",
    "جهاد": "vocab/quran-core/8588890648.mp3",
    "إبراهيم": "vocab/quran-core/9115138730.mp3",
    "وقف": "vocab/quran-core/9187300067.mp3",
    "إيمان": "vocab/quran-core/9259514436.mp3",
    "نور": "vocab/quran-core/9386883573.mp3",
    "عمل": "vocab/quran-core/9418231010.mp3",
    "نفاق": "vocab/quran-core/9435153393.mp3",
    "طريق": "vocab/quran-core/9495321778.mp3",
    "عدل": "vocab/quran-core/9730306682.mp3",
    // everyday
    "نظيف": "vocab/everyday/40477554.mp3",
    "امرأة": "vocab/everyday/240798557.mp3",
    "عطشان": "vocab/everyday/397293622.mp3",
    "تاجر": "vocab/everyday/524189567.mp3",
    "سعيد": "vocab/everyday/898612750.mp3",
    "أم": "vocab/everyday/1006715517.mp3",
    "أب": "vocab/everyday/1220131647.mp3",
    "غني": "vocab/everyday/1237262535.mp3",
    "طبيب": "vocab/everyday/1247075675.mp3",
    "ذكي": "vocab/everyday/1370978987.mp3",
    "ضعيف": "vocab/everyday/1561333946.mp3",
    "وسخ": "vocab/everyday/1984999963.mp3",
    "قديم": "vocab/everyday/2943568373.mp3",
    "طالب": "vocab/everyday/3071907333.mp3",
    "بارد": "vocab/everyday/3552658764.mp3",
    "صعب": "vocab/everyday/3634265791.mp3",
    "جوعان": "vocab/everyday/3972676967.mp3",
    "حزين": "vocab/everyday/4143224742.mp3",
    "قطار": "vocab/everyday/4334528414.mp3",
    "شجاع": "vocab/everyday/4360786779.mp3",
    "قوي": "vocab/everyday/4585672628.mp3",
    "ولد": "vocab/everyday/4691864287.mp3",
    "جميل": "vocab/everyday/4701965890.mp3",
    "كبير": "vocab/everyday/5321152568.mp3",
    "غبي": "vocab/everyday/5533782493.mp3",
    "سهل": "vocab/everyday/5560900960.mp3",
    "خائف": "vocab/everyday/5738582181.mp3",
    "طويل": "vocab/everyday/5894119042.mp3",
    "مسجد": "vocab/everyday/6143800619.mp3",
    "سيارة": "vocab/everyday/6554331008.mp3",
    "معلم": "vocab/everyday/6584940257.mp3",
    "طائرة": "vocab/everyday/7007758494.mp3",
    "سوق": "vocab/everyday/7321130715.mp3",
    "جامعة": "vocab/everyday/7398597285.mp3",
    "أخت": "vocab/everyday/7451078331.mp3",
    "بنت": "vocab/everyday/7561897309.mp3",
    "سفينة": "vocab/everyday/7960820243.mp3",
    "صغير": "vocab/everyday/8097989436.mp3",
    "مدرسة": "vocab/everyday/8365174277.mp3",
    "رجل": "vocab/everyday/8468840907.mp3",
    "جديد": "vocab/everyday/8535182381.mp3",
    "متعب": "vocab/everyday/8614715372.mp3",
    "فقير": "vocab/everyday/8731332742.mp3",
    "ساخن": "vocab/everyday/9077120728.mp3",
    "مرّ": "vocab/everyday/9111582111.mp3",
    "حلو": "vocab/everyday/9279024905.mp3",
    "قصير": "vocab/everyday/9281420180.mp3",
    "أخ": "vocab/everyday/9298230191.mp3",
    // verbs-50
    "نسى": "vocab/verbs-50/11154706.mp3",
    "قرأ": "vocab/verbs-50/416051477.mp3",
    "سأل": "vocab/verbs-50/618313157.mp3",
    "أخذ": "vocab/verbs-50/845863936.mp3",
    "دخل": "vocab/verbs-50/855489645.mp3",
    "أمن": "vocab/verbs-50/903921423.mp3",
    "قالوا": "vocab/verbs-50/1029391652.mp3",
    "حمل": "vocab/verbs-50/1208645407.mp3",
    "كتب": "vocab/verbs-50/1403436756.mp3",
    "دعا": "vocab/verbs-50/1545666200.mp3",
    "نام": "vocab/verbs-50/1607753957.mp3",
    "لبس": "vocab/verbs-50/1970708114.mp3",
    "كره": "vocab/verbs-50/2183605629.mp3",
    "نظر": "vocab/verbs-50/2438586456.mp3",
    "علّم": "vocab/verbs-50/2614126511.mp3",
    "كانوا": "vocab/verbs-50/2716754201.mp3",
    "خاف": "vocab/verbs-50/2822908086.mp3",
    "ركب": "vocab/verbs-50/3073335141.mp3",
    "فتح": "vocab/verbs-50/3825938152.mp3",
    "عاد": "vocab/verbs-50/4594781747.mp3",
    "ذكر": "vocab/verbs-50/4870988213.mp3",
    "ذهب": "vocab/verbs-50/5302452181.mp3",
    "سافر": "vocab/verbs-50/5455396242.mp3",
    "تعلم": "vocab/verbs-50/5836851394.mp3",
    "أجاب": "vocab/verbs-50/6163308150.mp3",
    "وجد": "vocab/verbs-50/6394952935.mp3",
    "أعطى": "vocab/verbs-50/6402412745.mp3",
    "بحث": "vocab/verbs-50/6485971077.mp3",
    "وضع": "vocab/verbs-50/6549797688.mp3",
    "فهم": "vocab/verbs-50/6663407497.mp3",
    "أغلق": "vocab/verbs-50/7668428038.mp3",
    "قام": "vocab/verbs-50/7946148082.mp3",
    "انتظر": "vocab/verbs-50/7968547055.mp3",
    "فعل": "vocab/verbs-50/8289295637.mp3",
    "حبّ": "vocab/verbs-50/8374400512.mp3",
    "جاء": "vocab/verbs-50/8389673837.mp3",
    "صنع": "vocab/verbs-50/8544589806.mp3",
    "استمع": "vocab/verbs-50/8624711159.mp3",
    "عرف": "vocab/verbs-50/8950298506.mp3",
    "بنى": "vocab/verbs-50/9017866527.mp3",
    "خرج": "vocab/verbs-50/9097240848.mp3",
    "درس": "vocab/verbs-50/9667308193.mp3",
    // surah-vocab
    "اهْدِنَا": "vocab/surah-vocab/465916142.mp3",
    "بِسْمِ": "vocab/surah-vocab/565253524.mp3",
    "نَعْبُدُ": "vocab/surah-vocab/920098095.mp3",
    "نَسْتَعِينُ": "vocab/surah-vocab/2627584359.mp3",
    "هُوَ": "vocab/surah-vocab/3324526492.mp3",
    "كُنْتُمْ": "vocab/surah-vocab/3398041200.mp3",
    "أَحَدٌ": "vocab/surah-vocab/3703123134.mp3",
    "هِيَ": "vocab/surah-vocab/4174057638.mp3",
    "شَرِّ": "vocab/surah-vocab/4433950957.mp3",
    "نَحْنُ": "vocab/surah-vocab/4554446842.mp3",
    "الصِّرَاطَ": "vocab/surah-vocab/5263390922.mp3",
    "الْفَلَقِ": "vocab/surah-vocab/5371556794.mp3",
    "يَوْمِ": "vocab/surah-vocab/5390421536.mp3",
    "مَا": "vocab/surah-vocab/6021749699.mp3",
    "النَّاسِ": "vocab/surah-vocab/6094736654.mp3",
    "رَبِّ": "vocab/surah-vocab/6101016282.mp3",
    "هُمْ": "vocab/surah-vocab/6192661457.mp3",
    "خَلَقَ": "vocab/surah-vocab/6300912109.mp3",
    "الْوَسْوَاسِ": "vocab/surah-vocab/6488045636.mp3",
    "لِلَّهِ": "vocab/surah-vocab/6567127880.mp3",
    "هَذَا": "vocab/surah-vocab/6824491542.mp3",
    "الْحَمْدُ": "vocab/surah-vocab/6958022949.mp3",
    "تِلْكَ": "vocab/surah-vocab/7107050090.mp3",
    "الصَّمَدُ": "vocab/surah-vocab/7260768687.mp3",
    "الْعَالَمِينَ": "vocab/surah-vocab/7312604039.mp3",
    "قُلْ": "vocab/surah-vocab/7444971649.mp3",
    "الْمُسْتَقِيمَ": "vocab/surah-vocab/7775780492.mp3",
    "مَالِكِ": "vocab/surah-vocab/7858478887.mp3",
    "أَنَا": "vocab/surah-vocab/7866581083.mp3",
    "الَّتِي": "vocab/surah-vocab/7989087916.mp3",
    "الدِّينِ": "vocab/surah-vocab/8292722777.mp3",
    "الَّذِي": "vocab/surah-vocab/8570851013.mp3",
    "الرَّحْمَٰنِ": "vocab/surah-vocab/9063174392.mp3",
    "أَعُوذُ": "vocab/surah-vocab/9230059818.mp3",
    "الْخَنَّاسِ": "vocab/surah-vocab/9597588530.mp3",
    "الرَّحِيمِ": "vocab/surah-vocab/9624077637.mp3",
    "أَنتُمْ": "vocab/surah-vocab/9965094176.mp3",
    // quran-freq-200
    "كُرْسِيِّهِ": "vocab/quran-freq-200/66626828.mp3",
    "كَانُوا": "vocab/quran-freq-200/111666283.mp3",
    "لم": "vocab/quran-freq-200/121541498.mp3",
    "يقول": "vocab/quran-freq-200/171322351.mp3",
    "كَرِيمٌ": "vocab/quran-freq-200/256746848.mp3",
    "في": "vocab/quran-freq-200/322800264.mp3",
    "رسل": "vocab/quran-freq-200/531533780.mp3",
    "قَالُوا": "vocab/quran-freq-200/550468766.mp3",
    "كَمَا": "vocab/quran-freq-200/749157443.mp3",
    "سَعِيرٌ": "vocab/quran-freq-200/847415142.mp3",
    "نَفْسِهِ": "vocab/quran-freq-200/896943304.mp3",
    "إلى": "vocab/quran-freq-200/899869907.mp3",
    "حِجْرٌ": "vocab/quran-freq-200/912220019.mp3",
    "إِذْ": "vocab/quran-freq-200/918469259.mp3",
    "قَدْ": "vocab/quran-freq-200/940791366.mp3",
    "لَحْمٌ": "vocab/quran-freq-200/1006381374.mp3",
    "خَلْقٌ": "vocab/quran-freq-200/1054977833.mp3",
    "عَلِيمٌ": "vocab/quran-freq-200/1176002925.mp3",
    "جَعَلْنَا": "vocab/quran-freq-200/1269757152.mp3",
    "حُورٌ": "vocab/quran-freq-200/1288701808.mp3",
    "من": "vocab/quran-freq-200/1350706605.mp3",
    "قُرْآنًا": "vocab/quran-freq-200/1383375033.mp3",
    "وَاجِبٌ": "vocab/quran-freq-200/1450499665.mp3",
    "لِكُلِّ": "vocab/quran-freq-200/1475379199.mp3",
    "أُولَئِكَ": "vocab/quran-freq-200/1566786391.mp3",
    "فَمَا": "vocab/quran-freq-200/1642345730.mp3",
    "شَهَادَةٌ": "vocab/quran-freq-200/1651845488.mp3",
    "بَيَانٌ": "vocab/quran-freq-200/1653748074.mp3",
    "بِمَا": "vocab/quran-freq-200/1700429829.mp3",
    "لَهَا": "vocab/quran-freq-200/1731207295.mp3",
    "هُنَالِكَ": "vocab/quran-freq-200/1905757847.mp3",
    "قلوب": "vocab/quran-freq-200/1919612059.mp3",
    "كَرَمًا": "vocab/quran-freq-200/1924726421.mp3",
    "سَنَفْرِغُ": "vocab/quran-freq-200/1990045321.mp3",
    "وَكَانَ": "vocab/quran-freq-200/2159614439.mp3",
    "تَعْلَمُ": "vocab/quran-freq-200/2171201994.mp3",
    "يَعْلَمُ": "vocab/quran-freq-200/2235733315.mp3",
    "هذا": "vocab/quran-freq-200/2415715737.mp3",
    "وَأَمَّا": "vocab/quran-freq-200/2419460444.mp3",
    "بِاللَّهِ": "vocab/quran-freq-200/2498468723.mp3",
    "حَسْبُنَا": "vocab/quran-freq-200/2540692581.mp3",
    "وَلِيٌّ": "vocab/quran-freq-200/2671536019.mp3",
    "رَبَّنَا": "vocab/quran-freq-200/2856679936.mp3",
    "ذَلِكَ": "vocab/quran-freq-200/2858816830.mp3",
    "كفّار": "vocab/quran-freq-200/2905007678.mp3",
    "ذَلِكُمْ": "vocab/quran-freq-200/3073551965.mp3",
    "وَقَدْ": "vocab/quran-freq-200/3421799717.mp3",
    "عِنْدِهِ": "vocab/quran-freq-200/3436875072.mp3",
    "سُؤَالًا": "vocab/quran-freq-200/3489385956.mp3",
    "قُرْبَةً": "vocab/quran-freq-200/3903416401.mp3",
    "بَلْ": "vocab/quran-freq-200/3920030732.mp3",
    "جَمِيعاً": "vocab/quran-freq-200/3950129497.mp3",
    "صَلَوَات": "vocab/quran-freq-200/4010102335.mp3",
    "إِلَيْكُمْ": "vocab/quran-freq-200/4123526839.mp3",
    "أَنْعَمْتَ": "vocab/quran-freq-200/4144926036.mp3",
    "كَافِرِينَ": "vocab/quran-freq-200/4173872274.mp3",
    "طَيِّبَات": "vocab/quran-freq-200/4180011447.mp3",
    "حمَل": "vocab/quran-freq-200/4227915214.mp3",
    "لَهُمْ": "vocab/quran-freq-200/4332271426.mp3",
    "يَدٌ": "vocab/quran-freq-200/4710409087.mp3",
    "أَنْ": "vocab/quran-freq-200/4777907690.mp3",
    "خَلَقَكُم": "vocab/quran-freq-200/4780845350.mp3",
    "أَنْفُسَكُمْ": "vocab/quran-freq-200/4795673946.mp3",
    "صَاحِبَهُ": "vocab/quran-freq-200/4858178297.mp3",
    "على": "vocab/quran-freq-200/4869105785.mp3",
    "حَكِيمًا": "vocab/quran-freq-200/4933600734.mp3",
    "آبائكم": "vocab/quran-freq-200/4974095422.mp3",
    "أَلَمْ": "vocab/quran-freq-200/4987727326.mp3",
    "عَبْدِهِ": "vocab/quran-freq-200/5006009361.mp3",
    "صَدْقًا": "vocab/quran-freq-200/5102050749.mp3",
    "وَاللَّهُ": "vocab/quran-freq-200/5131964206.mp3",
    "تَعْلَمُونَ": "vocab/quran-freq-200/5216276513.mp3",
    "حول": "vocab/quran-freq-200/5281227208.mp3",
    "فَضْلِهِ": "vocab/quran-freq-200/5288149860.mp3",
    "بِسْ": "vocab/quran-freq-200/5301410116.mp3",
    "كلمة": "vocab/quran-freq-200/5375711478.mp3",
    "أيّام": "vocab/quran-freq-200/5434482745.mp3",
    "قَدِيرٌ": "vocab/quran-freq-200/5466266519.mp3",
    "وَمَا": "vocab/quran-freq-200/5525845229.mp3",
    "أنزل": "vocab/quran-freq-200/5797115711.mp3",
    "بَيْنَ": "vocab/quran-freq-200/6103961201.mp3",
    "عِنْدَ": "vocab/quran-freq-200/6190240544.mp3",
    "رَسُولِهِ": "vocab/quran-freq-200/6379014040.mp3",
    "ثمّ": "vocab/quran-freq-200/6410748264.mp3",
    "مع": "vocab/quran-freq-200/6426033397.mp3",
    "أي": "vocab/quran-freq-200/6522641023.mp3",
    "قُرْآنٌ": "vocab/quran-freq-200/6584933668.mp3",
    "لا": "vocab/quran-freq-200/6629197039.mp3",
    "مَثَلٌ": "vocab/quran-freq-200/6794473033.mp3",
    "يَوْمَئِذٍ": "vocab/quran-freq-200/7065010618.mp3",
    "إنّ": "vocab/quran-freq-200/7125309730.mp3",
    "ايک": "vocab/quran-freq-200/7267475968.mp3",
    "تَبَارَكَ": "vocab/quran-freq-200/7272302094.mp3",
    "فَاعِلِينَ": "vocab/quran-freq-200/7272884865.mp3",
    "دَرَجَات": "vocab/quran-freq-200/7329917896.mp3",
    "إنّما": "vocab/quran-freq-200/7350764387.mp3",
    "رَؤُوفًا": "vocab/quran-freq-200/7518264118.mp3",
    "جَعَلَ": "vocab/quran-freq-200/7533598096.mp3",
    "إِ": "vocab/quran-freq-200/7549211519.mp3",
    "ما": "vocab/quran-freq-200/7634721159.mp3",
    "بِ": "vocab/quran-freq-200/7656021744.mp3",
    "سَيِّئَات": "vocab/quran-freq-200/7811544396.mp3",
    "كلّ": "vocab/quran-freq-200/7916702475.mp3",
    "ظَالِمِينَ": "vocab/quran-freq-200/8036314194.mp3",
    "بَعْضُ": "vocab/quran-freq-200/8043484143.mp3",
    "مِنْكُمْ": "vocab/quran-freq-200/8097249593.mp3",
    "يَسْعَوْنَ": "vocab/quran-freq-200/8129662681.mp3",
    "أجمعين": "vocab/quran-freq-200/8174798246.mp3",
    "مُحَمَّدٌ": "vocab/quran-freq-200/8257171289.mp3",
    "سَمِيعًا": "vocab/quran-freq-200/8275791651.mp3",
    "عَالَمِينَ": "vocab/quran-freq-200/8284533206.mp3",
    "يَوْمَهُمْ": "vocab/quran-freq-200/8375260379.mp3",
    "إذا": "vocab/quran-freq-200/8405382426.mp3",
    "مُصْلِحِينَ": "vocab/quran-freq-200/8457066484.mp3",
    "أبصار": "vocab/quran-freq-200/8494260434.mp3",
    "سَوْفَ": "vocab/quran-freq-200/8528427891.mp3",
    "صِرَاطَ": "vocab/quran-freq-200/8858477308.mp3",
    "حَديث": "vocab/quran-freq-200/8931709245.mp3",
    "دُعَاء": "vocab/quran-freq-200/8974576305.mp3",
    "وَلا": "vocab/quran-freq-200/9005214378.mp3",
    "ضُرَّاءَ": "vocab/quran-freq-200/9162736174.mp3",
    "مَعَهُمْ": "vocab/quran-freq-200/9390524354.mp3",
    "رَبِّي": "vocab/quran-freq-200/9413118289.mp3",
    "طَاهِرِينَ": "vocab/quran-freq-200/9506291184.mp3",
    "نَذِيرٌ": "vocab/quran-freq-200/9664436302.mp3",
    "غَيْرَ": "vocab/quran-freq-200/9707337248.mp3",
    "حِكْمَةٌ": "vocab/quran-freq-200/9748245876.mp3",
    "الّذين": "vocab/quran-freq-200/9941376999.mp3",
    "سُبْحَانَهُ": "vocab/quran-freq-200/9952297927.mp3",
    "نَصِيبٌ": "vocab/quran-freq-200/9981470558.mp3",
    "حَتَّى": "vocab/quran-freq-200/9997095192.mp3",
    // quran-prepositions
    "تحت": "vocab/quran-prepositions/913090612.mp3",
    "بجانب": "vocab/quran-prepositions/1606301193.mp3",
    "عن": "vocab/quran-prepositions/1738386905.mp3",
    "خلف": "vocab/quran-prepositions/3210655446.mp3",
    "بدون": "vocab/quran-prepositions/3366749116.mp3",
    "أمام": "vocab/quran-prepositions/4008063778.mp3",
    "بين": "vocab/quran-prepositions/4455106360.mp3",
    "وراء": "vocab/quran-prepositions/4456709530.mp3",
    "فوق": "vocab/quran-prepositions/6395432740.mp3",
    "خلال": "vocab/quran-prepositions/6657118573.mp3",
    "منذ": "vocab/quran-prepositions/7267899619.mp3",
    "حتّى": "vocab/quran-prepositions/8242096970.mp3",
    // divine-names
    "الآخر": "vocab/divine-names/56694536.mp3",
    "الحميد": "vocab/divine-names/98120761.mp3",
    "القهّار": "vocab/divine-names/155789190.mp3",
    "الواجد": "vocab/divine-names/236660141.mp3",
    "الدائم": "vocab/divine-names/313908247.mp3",
    "المجيد": "vocab/divine-names/329952872.mp3",
    "الباعث": "vocab/divine-names/341280293.mp3",
    "الوليّ": "vocab/divine-names/470084775.mp3",
    "المتكبّر": "vocab/divine-names/566503702.mp3",
    "السميع": "vocab/divine-names/632299075.mp3",
    "مالك": "vocab/divine-names/753822985.mp3",
    "المعيد": "vocab/divine-names/754202263.mp3",
    "الصّابر": "vocab/divine-names/767656044.mp3",
    "البصير": "vocab/divine-names/841860919.mp3",
    "العظيم": "vocab/divine-names/919305975.mp3",
    "العليّ": "vocab/divine-names/928832415.mp3",
    "النافع": "vocab/divine-names/970392759.mp3",
    "الجليل": "vocab/divine-names/1105010376.mp3",
    "الضارّ": "vocab/divine-names/1124294687.mp3",
    "الحفيظ": "vocab/divine-names/1177156515.mp3",
    "الملك": "vocab/divine-names/1367923555.mp3",
    "النور": "vocab/divine-names/1713209647.mp3",
    "القادر": "vocab/divine-names/1832925220.mp3",
    "الحكيم": "vocab/divine-names/1833020447.mp3",
    "ذو الجلال": "vocab/divine-names/2016689384.mp3",
    "المنتقم": "vocab/divine-names/2054816118.mp3",
    "الودود": "vocab/divine-names/2109335093.mp3",
    "الحقّ": "vocab/divine-names/2294965899.mp3",
    "العفوّ": "vocab/divine-names/2311862372.mp3",
    "الوهّاب": "vocab/divine-names/2468693467.mp3",
    "البارئ": "vocab/divine-names/2816438300.mp3",
    "المقتدر": "vocab/divine-names/2985850042.mp3",
    "المعزّ": "vocab/divine-names/3209206288.mp3",
    "المانع": "vocab/divine-names/3329623463.mp3",
    "الجبار": "vocab/divine-names/3358855723.mp3",
    "الرشيد": "vocab/divine-names/3394155138.mp3",
    "الفتّاح": "vocab/divine-names/3424552515.mp3",
    "الغنيّ": "vocab/divine-names/3580615397.mp3",
    "الحسيب": "vocab/divine-names/3682408904.mp3",
    "الإكرام": "vocab/divine-names/3774497785.mp3",
    "الخالق": "vocab/divine-names/3889045275.mp3",
    "اللطيف": "vocab/divine-names/3928892925.mp3",
    "البرّ": "vocab/divine-names/3974882629.mp3",
    "الشكور": "vocab/divine-names/4051565695.mp3",
    "القابض": "vocab/divine-names/4111789283.mp3",
    "الهادي": "vocab/divine-names/4217793342.mp3",
    "الخافض": "vocab/divine-names/4262473674.mp3",
    "الغفّار": "vocab/divine-names/4319386781.mp3",
    "الشهيد": "vocab/divine-names/4500761497.mp3",
    "المغني": "vocab/divine-names/4519748446.mp3",
    "الوارث": "vocab/divine-names/4670239838.mp3",
    "المميت": "vocab/divine-names/4706826911.mp3",
    "المتين": "vocab/divine-names/4791838789.mp3",
    "العزيز": "vocab/divine-names/5010577849.mp3",
    "المحصي": "vocab/divine-names/5176173456.mp3",
    "العليم": "vocab/divine-names/5221384467.mp3",
    "التوّاب": "vocab/divine-names/5423940040.mp3",
    "الباسط": "vocab/divine-names/5436918267.mp3",
    "الواحد": "vocab/divine-names/5572687590.mp3",
    "الوالي": "vocab/divine-names/5587669988.mp3",
    "الحكم": "vocab/divine-names/5743158743.mp3",
    "الحليم": "vocab/divine-names/5838441079.mp3",
    "الصمد": "vocab/divine-names/5855236040.mp3",
    "العدل": "vocab/divine-names/5964807023.mp3",
    "الحساب": "vocab/divine-names/6137575309.mp3",
    "الصبور": "vocab/divine-names/6293608021.mp3",
    "المذلّ": "vocab/divine-names/6404604697.mp3",
    "المهيمن": "vocab/divine-names/6428974880.mp3",
    "الكبير": "vocab/divine-names/6607467889.mp3",
    "القدّوس": "vocab/divine-names/6722038073.mp3",
    "الكريم": "vocab/divine-names/7033401717.mp3",
    "المقيت": "vocab/divine-names/7078743813.mp3",
    "المبدئ": "vocab/divine-names/7126815800.mp3",
    "الماجد": "vocab/divine-names/7291845046.mp3",
    "الرزّاق": "vocab/divine-names/7378759357.mp3",
    "الظاهر": "vocab/divine-names/7496639643.mp3",
    "السلام": "vocab/divine-names/7629382482.mp3",
    "الأوّل": "vocab/divine-names/7715263955.mp3",
    "الجاميّ": "vocab/divine-names/8107048041.mp3",
    "الرقيب": "vocab/divine-names/8237463940.mp3",
    "الخبير": "vocab/divine-names/8275226334.mp3",
    "الواسع": "vocab/divine-names/8290519151.mp3",
    "المتعالي": "vocab/divine-names/8308355583.mp3",
    "المؤمن": "vocab/divine-names/8386614919.mp3",
    "الغفور": "vocab/divine-names/8521086672.mp3",
    "الرافع": "vocab/divine-names/8613309731.mp3",
    "القويّ": "vocab/divine-names/8627000889.mp3",
    "الرءوف": "vocab/divine-names/8710132955.mp3",
    "الوكيل": "vocab/divine-names/8918315078.mp3",
    "المجيب": "vocab/divine-names/9074320029.mp3",
    "المؤخّر": "vocab/divine-names/9143004221.mp3",
    "المصوّر": "vocab/divine-names/9146523611.mp3",
    "المقدّم": "vocab/divine-names/9163507176.mp3",
    "الباطن": "vocab/divine-names/9427022510.mp3",
    "الحيّ": "vocab/divine-names/9518605976.mp3",
    "القيّوم": "vocab/divine-names/9526024933.mp3",
    "المحيي": "vocab/divine-names/9675094597.mp3",
    // quran-pronouns
    "أنا": "vocab/quran-pronouns/274231645.mp3",
    "ه": "vocab/quran-pronouns/325786517.mp3",
    "أنتم": "vocab/quran-pronouns/987345658.mp3",
    "تلك": "vocab/quran-pronouns/1132512412.mp3",
    "هذه": "vocab/quran-pronouns/1263855385.mp3",
    "هي": "vocab/quran-pronouns/1348576340.mp3",
    "ها": "vocab/quran-pronouns/1815001880.mp3",
    "هُما": "vocab/quran-pronouns/2098439648.mp3",
    "أولئك": "vocab/quran-pronouns/2181911515.mp3",
    "نحن": "vocab/quran-pronouns/3127312928.mp3",
    "أنتِ": "vocab/quran-pronouns/3967703859.mp3",
    "ك": "vocab/quran-pronouns/4027955227.mp3",
    "اللّذين": "vocab/quran-pronouns/4268129384.mp3",
    "هن": "vocab/quran-pronouns/4884219174.mp3",
    "نا": "vocab/quran-pronouns/5603508908.mp3",
    "اللّتان": "vocab/quran-pronouns/6559292322.mp3",
    "كما": "vocab/quran-pronouns/6692966032.mp3",
    "كِ": "vocab/quran-pronouns/6912748182.mp3",
    "أنتَ": "vocab/quran-pronouns/6935749244.mp3",
    "هم": "vocab/quran-pronouns/7578255073.mp3",
    "هو": "vocab/quran-pronouns/7877255009.mp3",
    "كم": "vocab/quran-pronouns/7929878697.mp3",
    "كن": "vocab/quran-pronouns/8114307604.mp3",
    "أنتنّ": "vocab/quran-pronouns/8321856761.mp3",
    "هؤلاء": "vocab/quran-pronouns/8403622885.mp3",
    "ذلك": "vocab/quran-pronouns/8453755061.mp3",
    "اللّاتي": "vocab/quran-pronouns/9815879106.mp3",
    "هنّ": "vocab/quran-pronouns/9837700924.mp3",
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
      if (typeof c === "string" || typeof c === "number") e.appendChild(document.createTextNode(c));
      else e.appendChild(c);
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
