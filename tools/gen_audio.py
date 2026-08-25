#!/usr/bin/env python3
"""Generate Arabic TTS audio via edge-tts for the academy (letters, examples, vocab, drills)."""
import asyncio, json, os, sys
import edge_tts

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(BASE, "assets", "audio")
VOICE = os.environ.get("ACADEMY_VOICE", "ar-SA-ZariyahNeural")
RATE = os.environ.get("ACADEMY_RATE", "-10%")

jobs = []  # (relpath, text)

def add(rel, text):
    jobs.append((rel, text))

# --- letters: name + example word
with open(os.path.join(BASE, "data", "curriculum", "alphabet.json"), encoding="utf-8") as f:
    alphabet = json.load(f)
for L in alphabet:
    add(f"letters/{L['name']}.mp3", L["char"])
    add(f"words/{L['name']}.mp3", L["example"]["word"])

# --- vowel demos on letter ب
VOWELS = [
    ("fatha","بَ"),("damma","بُ"),("kasra","بِ"),("sukoon","أَبْ"),
    ("tanween-fath","كِتَابًا"),("tanween-damm","كِتَابٌ"),("tanween-kasr","كِتَابٍ"),
    ("madd-aa","قَالَ"),("madd-uu","يَقُولُ"),("madd-ii","قِيلَ"),
    ("shadda","رَبَّ"),("sun-moon","الشَّمْسُ وَالْقَمَرُ"),
]
for name, text in VOWELS:
    add(f"drills/{name}.mp3", text)

# --- lesson example phrases (from levels.json explain blocks we curate)
LESSON_AUDIO = {
    "L2.1": ["الْبَيْتُ كَبِيرٌ","اللُّغَةُ جَمِيلَةٌ"],
    "L2.2": ["هَذَا كِتَابٌ","هَذِهِ مَدْرَسَةٌ"],
    "L2.3": ["كِتَابُ الطَّالِبِ","بَيْتُ اللهِ","رَبِّ الْعَالَمِينَ"],
    "L2.4": ["فِيهِ هُدًى","مِنَ الْكِتَابِ","لَهُ"],
    "L2.5": ["كَتَبْتُ","قَالُوا","خَلَقَ"],
    "L2.6": ["يَكْتُبُ","نَعْبُدُ وَنَسْتَعِينُ"],
    "L2.7": ["كِتَاب كُتُب","وَاحِد اثْنَانِ ثَلَاثَة"],
    "L3.1": ["كِتَاب كَاتِب مَكْتَبَة","إِسْلَام مُسْلِم سَلَام"],
    "L3.3": ["الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ","اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ"],
}
for lid, phrases in LESSON_AUDIO.items():
    for i, p in enumerate(phrases):
        add(f"lessons/{lid}-{i}.mp3", p)

# --- vocab decks
with open(os.path.join(BASE, "data", "curriculum", "decks.json"), encoding="utf-8") as f:
    decks = json.load(f)
for deck_id, deck in decks.items():
    seen = set()
    for w in deck["words"]:
        if w["ar"] in seen:
            continue
        seen.add(w["ar"])
        add(f"vocab/{deck_id}/{abs(hash(w['ar'])) % 10**10}.mp3", w["ar"])

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
