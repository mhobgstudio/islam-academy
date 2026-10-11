#!/usr/bin/env python3
"""Fetch Quran data: Uthmani text, English translation, surah metadata, word-by-word for short surahs."""
import json, os, sys, time, urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QDIR = os.path.join(BASE, "data", "quran")
os.makedirs(QDIR, exist_ok=True)

UA = {"User-Agent": "IslamAcademy/1.0 (offline study tool)"}

def get(url, retries=3):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            print(f"  retry {i+1} {url}: {e}", file=sys.stderr)
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"failed: {url}")

CDN = "https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1"

def fetch_edition_chapters(edition):
    out = {}
    for ch in range(1, 115):
        d = get(f"{CDN}/editions/{edition}/{ch}.min.json")
        verses = d["chapter"]
        out[ch] = [{"v": v["verse"], "t": v["text"]} for v in verses]
        if ch % 20 == 0:
            print(f"  {edition}: {ch}/114")
    return out

print("[1/4] Uthmani text (ara-quranuthmanihaf)...")
uthmani = fetch_edition_chapters("ara-quranuthmanihaf")

print("[2/4] Translation (eng-ummmuhammad / Saheeh International)...")
trans = fetch_edition_chapters("eng-ummmuhammad")

print("[3/4] Surah metadata...")
info = get(f"{CDN}/info.json")
surah_names = [
    "Al-Fatihah","Al-Baqarah","Ali 'Imran","An-Nisa","Al-Ma'idah","Al-An'am","Al-A'raf","Al-Anfal",
    "At-Tawbah","Yunus","Hud","Yusuf","Ar-Ra'd","Ibrahim","Al-Hijr","An-Nahl","Al-Isra","Al-Kahf",
    "Maryam","Taha","Al-Anbya","Al-Hajj","Al-Mu'minun","An-Nur","Al-Furqan","Ash-Shu'ara","An-Naml",
    "Al-Qasas","Al-'Ankabut","Ar-Rum","Luqman","As-Sajdah","Al-Ahzab","Saba","Fatir","Ya-Sin",
    "As-Saffat","Sad","Az-Zumar","Ghafir","Fussilat","Ash-Shuraa","Az-Zukhruf","Ad-Dukhan","Al-Jathiyah",
    "Al-Ahqaf","Muhammad","Al-Fath","Al-Hujurat","Qaf","Adh-Dhariyat","At-Tur","An-Najm","Al-Qamar",
    "Ar-Rahman","Al-Waqi'ah","Al-Hadid","Al-Mujadila","Al-Hashr","Al-Mumtahanah","As-Saf","Al-Jumu'ah",
    "Al-Munafiqun","At-Taghabun","At-Talaq","At-Tahrim","Al-Mulk","Al-Qalam","Al-Haqqah","Al-Ma'arij",
    "Nuh","Al-Jinn","Al-Muzzammil","Al-Muddaththir","Al-Qiyamah","Al-Insan","Al-Mursalat","An-Naba",
    "An-Nazi'at","'Abasa","At-Takwir","Al-Infitar","Al-Mutaffifin","Al-Inshiqaq","Al-Buruj","At-Tariq",
    "Al-A'la","Al-Ghashiyah","Al-Fajr","Al-Balad","Ash-Shams","Al-Layl","Ad-Duhaa","Ash-Sharh",
    "At-Tin","Al-'Alaq","Al-Qadr","Al-Bayyinah","Az-Zalzalah","Al-'Adiyat","Al-Qari'ah","At-Takathur",
    "Al-'Asr","Al-Humazah","Al-Fil","Quraysh","Al-Ma'un","Al-Kawthar","Al-Kafirun","An-Nasr",
    "Al-Masad","Al-Ikhlas","Al-Falaq","An-Nas"
]
surah_meta = []
for i, name in enumerate(surah_names, 1):
    surah_meta.append({
        "number": i,
        "name": name,
        "ayahs": len(uthmani[i]),
        "revelation": "meccan" if i not in (2,3,4,5,8,9,13,22,24,33,47,48,49,55,57,58,59,60,61,62,63,64,65,66,76,98,99,110) else "medinan",
    })

print("[4/4] Word-by-word for Juz 'Amma short surahs (78-114) + Al-Fatihah...")
wbw = {}
targets = [1] + list(range(78, 115))
for s in targets:
    try:
        d = get(f"https://api.quran.com/api/v4/verses/by_chapter/{s}?language=en&words=true&word_fields=text_uthmani,translation,transliteration,audio_url&per_page=50&page=1", retries=2)
        verses = d.get("verses", [])
        wbw[str(s)] = {
            str(v["verse_number"]): [
                {"u": w.get("text_uthmani") or w.get("text", ""),
                 "tr": (w.get("translation") or {}).get("text", ""),
                 "tl": (w.get("transliteration") or {}).get("text", ""),
                 "au": w.get("audio_url", "")}
                for w in v.get("words", []) if w.get("char_type_name") == "word"
            ] for v in verses
        }
        print(f"  wbw {s}: ok ({len(verses)} verses)")
        time.sleep(0.4)
    except Exception as e:
        print(f"  wbw {s}: SKIPPED ({e})", file=sys.stderr)

with open(os.path.join(QDIR, "uthmani.json"), "w", encoding="utf-8") as f:
    json.dump(uthmani, f, ensure_ascii=False)
with open(os.path.join(QDIR, "translation_en.json"), "w", encoding="utf-8") as f:
    json.dump(trans, f, ensure_ascii=False)
with open(os.path.join(QDIR, "surah_meta.json"), "w", encoding="utf-8") as f:
    json.dump(surah_meta, f, ensure_ascii=False, indent=1)
with open(os.path.join(QDIR, "words.json"), "w", encoding="utf-8") as f:
    json.dump(wbw, f, ensure_ascii=False)

total_ayahs = sum(len(v) for v in uthmani.values())
print(f"DONE. {total_ayahs} ayahs, {len(wbw)} surahs word-by-word.")
