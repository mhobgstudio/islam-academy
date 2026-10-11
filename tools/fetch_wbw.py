#!/usr/bin/env python3
import json, os, sys, time, urllib.request
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QDIR = os.path.join(BASE, "data", "quran")
UA = {"User-Agent": "IslamAcademy/1.0"}
def get(url, retries=3):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            print(f"  retry {i+1}: {e}", file=sys.stderr); time.sleep(2*(i+1))
    raise RuntimeError(url)
wbw_path = os.path.join(QDIR, "words.json")
try:
    wbw = json.load(open(wbw_path))
except Exception:
    wbw = {}
targets = [1] + list(range(78, 115))
for s in targets:
    if str(s) in wbw and wbw[str(s)]:
        print(f"  {s}: cached"); continue
    d = get(f"https://api.quran.com/api/v4/verses/by_chapter/{s}?language=en&words=true&word_fields=text_uthmani,translation,transliteration,audio_url&per_page=50&page=1")
    verses = d.get("verses", [])
    wbw[str(s)] = {
        str(v["verse_number"]): [
            {"u": w.get("text_uthmani") or w.get("text",""),
             "tr": (w.get("translation") or {}).get("text",""),
             "tl": (w.get("transliteration") or {}).get("text",""),
             "au": w.get("audio_url","")}
            for w in v.get("words", []) if w.get("char_type_name") == "word"
        ] for v in verses
    }
    print(f"  {s}: ok ({len(verses)} verses)")
    time.sleep(0.35)
json.dump(wbw, open(wbw_path,"w"), ensure_ascii=False)
print("DONE:", len([k for k in wbw if wbw[k]]), "surahs")
