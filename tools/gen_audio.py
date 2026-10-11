#!/usr/bin/env python3
"""Generate Arabic TTS audio via edge-tts for the academy (letters, examples, vocab, drills, tajweed, lessons)."""
import asyncio, json, os, sys, hashlib
import edge_tts

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(BASE, "assets", "audio")
VOICE = os.environ.get("ACADEMY_VOICE", "ar-SA-ZariyahNeural")
RATE = os.environ.get("ACADEMY_RATE", "-10%")

jobs = []  # (relpath, text)

def add(rel, text):
    jobs.append((rel, text))

# --- 1. LETTERS: name pronunciation + example word ---
with open(os.path.join(BASE, "data", "curriculum", "alphabet.json"), encoding="utf-8") as f:
    alphabet = json.load(f)
for L in alphabet:
    add(f"letters/{L['name']}.mp3", L["char"])
    add(f"words/{L['name']}.mp3", L["example"]["word"])

# --- 2. VOWEL DEMOS (on letter ب) ---
VOWELS = [
    ("fatha","بَ"),("damma","بُ"),("kasra","بِ"),("sukoon","أَبْ"),
    ("tanween-fath","كِتَابًا"),("tanween-damm","كِتَابٌ"),("tanween-kasr","كِتَابٍ"),
    ("madd-aa","قَالَ"),("madd-uu","يَقُولُ"),("madd-ii","قِيلَ"),
    ("shadda","رَبَّ"),("sun-moon","الشَّمْسُ وَالْقَمَرُ"),
]
for name, text in VOWELS:
    add(f"drills/{name}.mp3", text)

# --- 3. LESSON PHRASES (ALL levels, not just L2-L3) ---
LESSON_AUDIO = {
    # Level 0 — Foundations
    "L0.1": ["أَلِف","بَاء","تَاء","ثَاء"],
    "L0.2": ["بِسْمِ","كِتَاب","مَكْتُوب"],
    "L0.3": ["بَيْت","تَمْر","ثَلْج"],
    # Level 1 — Reading
    "L1.1": ["بَ","بُ","بِ"],
    "L1.2": ["أَبْ","كَتَبْ"],
    "L1.3": ["كِتَابًا","كِتَابٌ","كِتَابٍ"],
    "L1.4": ["بَا","بُو","بِي"],
    "L1.5": ["رَبَّ","مُحَمَّد"],
    "L1.6": ["الشَّمْسُ","الْقَمَرُ"],
    # Level 2 — Grammar
    "L2.1": ["الْبَيْتُ كَبِيرٌ","اللُّغَةُ جَمِيلَةٌ"],
    "L2.2": ["هَذَا كِتَابٌ","هَذِهِ مَدْرَسَةٌ"],
    "L2.3": ["كِتَابُ الطَّالِبِ","بَيْتُ اللهِ","رَبِّ الْعَالَمِينَ"],
    "L2.4": ["فِيهِ هُدًى","مِنَ الْكِتَابِ","لَهُ"],
    "L2.5": ["كَتَبْتُ","قَالُوا","خَلَقَ"],
    "L2.6": ["يَكْتُبُ","نَعْبُدُ وَنَسْتَعِينُ"],
    "L2.7": ["كِتَاب كُتُب","وَاحِد اثْنَانِ ثَلَاثَة"],
    # Level 3 — Advanced
    "L3.1": ["كِتَاب كَاتِب مَكْتَبَة","إِسْلَام مُسْلِم سَلَام"],
    "L3.2": ["الْمُدَرِّسُ يُعَلِّمُ","الطَّالِبُ يَدْرُسُ"],
    "L3.3": ["الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ","اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ"],
    "L3.4": ["كَانَ يَكْتُبُ","سَيَذْهَبُ","لَمْ يَكْتُبْ"],
}
for lid, phrases in LESSON_AUDIO.items():
    for i, p in enumerate(phrases):
        add(f"lessons/{lid}-{i}.mp3", p)

# --- 4. TAJWEED EXAMPLES ---
TAJWEED_AUDIO = [
    ("tajweed/izhar", "مِنْ خَيْر"),
    ("tajweed/idgham", "مَنْ يَعْمَل"),
    ("tajweed/iqlab", "مِنْ بَعْد"),
    ("tajweed/ikhfa", "مِنْ قَبْل"),
    ("tajweed/ikhfa-shafawi", "تَمْبِيه"),
    ("tajweed/idgham-shafawi", "لَهُمْ مَا"),
    ("tajweed/izhar-shafawi", "أَمْ لَمْ"),
    ("tajweed/madd-tabeei", "قَالَ"),
    ("tajweed/madd-muttasil", "جَاءَ"),
    ("tajweed/madd-munfasil", "يَا أَيُّهَا"),
    ("tajweed/madd-laazim", "الضَّالِّينَ"),
    ("tajweed/qalqalah", "اقْرَأْ"),
    ("tajweed/tafkheem", "صِرَاط"),
    ("tajweed/waqf-mandatory", "م"),
    # Also add istiadha and basmalah
    ("tajweed/istiadha", "أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ"),
    ("tajweed/basmalah", "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ"),
]
for name, text in TAJWEED_AUDIO:
    add(f"drills/{name}.mp3", text)

# --- 5. READING PRACTICE WORDS ---
READING_WORDS = [
    ("reading/baab", "بَاب"),
    ("reading/kitaab", "كِتَاب"),
    ("reading/maa", "مَاء"),
    ("reading/shams", "شَمْس"),
    ("reading/qamar", "قَمَر"),
    ("reading/yawm", "يَوْم"),
    ("reading/layl", "لَيْل"),
    ("reading/rajul", "رَجُل"),
    ("reading/mar'a", "مَرْأَة"),
    ("reading/bayt", "بَيْت"),
    ("reading/salaam", "سَلَام"),
    ("reading/noor", "نُور"),
    ("reading/salaah", "صَلَاة"),
    ("reading/quran", "قُرْآن"),
    ("reading/masjid", "مَسْجِد"),
    ("reading/ilm", "عِلْم"),
    ("reading/kalimah", "كَلِمَة"),
    ("reading/haqq", "حَقّ"),
    # Reading challenge sentences
    ("reading/challenge-0", "الْمَسْجِدُ كَبِيرٌ"),
    ("reading/challenge-1", "الْكِتَابُ جَدِيدٌ"),
    ("reading/challenge-2", "الشَّمْسُ مُشْرِقَةٌ"),
    ("reading/challenge-3", "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ"),
]
for name, text in READING_WORDS:
    add(f"drills/{name}.mp3", text)

# --- 6. GRAMMAR ROOT EXPLORER WORDS ---
ROOT_WORDS = [
    ("grammar/kitaab", "كِتَاب"),
    ("grammar/katib", "كَاتِب"),
    ("grammar/kataba", "كَتَبَ"),
    ("grammar/maktaba", "مَكْتَبَة"),
    ("grammar/maktub", "مَكْتُوب"),
    ("grammar/ilm", "عِلْم"),
    ("grammar/aalim", "عَالِم"),
    ("grammar/ma'lum", "مَعْلُوم"),
    ("grammar/ta'leem", "تَعْلِيم"),
    ("grammar/rahma", "رَحْمَة"),
    ("grammar/raheem", "رَحِيم"),
    ("grammar/rahima", "رَحَمَ"),
    ("grammar/salaam", "سَلَام"),
    ("grammar/islam", "إِسْلَام"),
    ("grammar/muslim", "مُسْلِم"),
    ("grammar/saleem", "سَلِيم"),
    ("grammar/fath", "فَتْح"),
    ("grammar/fatiha", "فَاتِحَة"),
    ("grammar/fataha", "فَتَحَ"),
    ("grammar/qira'ah", "قِرَاءَة"),
    ("grammar/qaari", "قَارِئ"),
    ("grammar/qara'a", "قَرَأَ"),
    ("grammar/maqra", "مَقْرَأ"),
]
for name, text in ROOT_WORDS:
    add(f"drills/{name}.mp3", text)

# --- 7. SUFFIX/POSSESSIVE EXAMPLES ---
SUFFIX_AUDIO = [
    ("grammar/kitaabi", "كِتَابِي"),
    ("grammar/kitaabuka", "كِتَابُكَ"),
    ("grammar/kitaabuki", "كِتَابُكِ"),
    ("grammar/kitaabuhu", "كِتَابُهُ"),
    ("grammar/kitaabuha", "كِتَابُهَا"),
    ("grammar/kitaabuna", "كِتَابُنَا"),
    ("grammar/kitaabukum", "كِتَابُكُمْ"),
    ("grammar/kitaabuhum", "كِتَابُهُمْ"),
    ("grammar/katabtu", "كَتَبْتُ"),
    ("grammar/katabta", "كَتَبْتَ"),
    ("grammar/katabti", "كَتَبْتِ"),
    ("grammar/katabat", "كَتَبَتْ"),
    ("grammar/katabna", "كَتَبْنَا"),
    ("grammar/katabtum", "كَتَبْتُمْ"),
]
for name, text in SUFFIX_AUDIO:
    add(f"drills/{name}.mp3", text)

# --- 8. PREFIX EXAMPLES ---
PREFIX_AUDIO = [
    ("grammar/al-kitaab", "الْكِتَابُ"),
    ("grammar/bil-kitaab", "بِالْكِتَابِ"),
    ("grammar/lillah", "لِلَّهِ"),
    ("grammar/kash-shams", "كَالشَّمْسِ"),
    ("grammar/wal-kitaab", "وَالْكِتَابُ"),
    ("grammar-fa-dhahaba", "فَذَهَبَ"),
    ("grammar/sayadhhabu", "سَيَذْهَبُ"),
    ("grammar/aktubu", "أَكْتُبُ"),
    ("grammar/yaktubu", "يَكْتُبُ"),
    ("grammar/naktubu", "نَكْتُبُ"),
    ("grammar/ma-kataba", "مَا كَتَبَ"),
    ("grammar/lam-yaktub", "لَمْ يَكْتُبْ"),
    ("grammar/lan-yaktuba", "لَنْ يَكْتُبَ"),
]
for name, text in PREFIX_AUDIO:
    add(f"drills/{name}.mp3", text)

# --- 9. VOCAB DECKS ---
with open(os.path.join(BASE, "data", "curriculum", "decks.json"), encoding="utf-8") as f:
    decks = json.load(f)
for deck_id, deck in decks.items():
    seen = set()
    for w in deck["words"]:
        if w["ar"] in seen:
            continue
        seen.add(w["ar"])
        # Use a stable hash so vocab files are reproducible
        h = int(hashlib.md5(w["ar"].encode()).hexdigest()[:10], 16) % 10**10
        add(f"vocab/{deck_id}/{h}.mp3", w["ar"])

# --- 10. COMMON PHRASES (used on multiple pages) ---
PHRASES = [
    ("phrases/bismillah", "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ"),
    ("phrases/istiadha", "أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ"),
    ("phrases/alhamdulillah", "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ"),
    ("phrases/subhanallah", "سُبْحَانَ اللهِ"),
    ("phrases/allahuakbar", "اللهُ أَكْبَرُ"),
    ("phrases/astaghfirullah", "أَسْتَغْفِرُ اللهَ"),
    ("phrases/jazakallah", "جَزَاكَ اللهُ خَيْرًا"),
    ("phrases/inshallah", "إِنْ شَاءَ اللهُ"),
    ("phrases/mashallah", "مَا شَاءَ اللهُ"),
]
for name, text in PHRASES:
    add(f"drills/{name}.mp3", text)

async def gen(rel, text, sem):
    path = os.path.join(AUDIO, rel)
    if os.path.exists(path) and os.path.getsize(path) > 500:
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    async with sem:
        for attempt in range(3):
            try:
                tts = edge_tts.Communicate(text, VOICE, rate=RATE)
                await tts.save(path + ".tmp")
                os.replace(path + ".tmp", path)
                return
            except Exception as e:
                if attempt == 2:
                    print(f"FAIL {rel}: {e}", file=sys.stderr)
                else:
                    await asyncio.sleep(1.5 * (attempt + 1))

async def main():
    sem = asyncio.Semaphore(4)
    await asyncio.gather(*(gen(r, t, sem) for r, t in jobs))

if __name__ == "__main__":
    todo = [(r, t) for r, t in jobs]
    print(f"{len(todo)} audio jobs, voice={VOICE}")
    asyncio.run(main())
    done = sum(os.path.exists(os.path.join(AUDIO, r)) for r, _ in jobs)
    print(f"done: {done}/{len(jobs)}")
