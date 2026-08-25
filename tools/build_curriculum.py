#!/usr/bin/env python3
"""Build curriculum JSON for ISLAM ACADEMY. Content informed by Madinah Books progression,
Quranic Arabic Corpus frequency data, and standard tajweed pedagogy."""
import json, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "data", "curriculum")
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- ALPHABET
# (name, iso, init, med, fin, translit, non_connector)
LETTERS = [
    ("alif","ا","ا","ـا","ـا","a",True),
    ("ba","ب","بـ","ـبـ","ـب","b",False),
    ("ta","ت","تـ","ـتـ","ـت","t",False),
    ("tha","ث","ثـ","ـثـ","ـث","th",False),
    ("jim","ج","جـ","ـجـ","ـج","j",False),
    ("ha","ح","حـ","ـحـ","ـح","h (deep)",False),
    ("kha","خ","خـ","ـخـ","ـخ","kh",False),
    ("dal","د","د","ـد","ـد","d",True),
    ("dhal","ذ","ذ","ـذ","ـذ","dh",True),
    ("ra","ر","ر","ـر","ـر","r",True),
    ("zay","ز","ز","ـز","ـز","z",True),
    ("sin","س","سـ","ـسـ","ـس","s",False),
    ("shin","ش","شـ","ـشـ","ـش","sh",False),
    ("sad","ص","صـ","ـصـ","ـص","s (heavy)",False),
    ("dad","ض","ضـ","ـضـ","ـض","d (heavy)",False),
    ("ta-heavy","ط","طـ","ـطـ","ـط","t (heavy)",False),
    ("zha-heavy","ظ","ظـ","ـظـ","ـظ","dh (heavy)",False),
    ("ayn","ع","عـ","ـعـ","ـع","ʿ",False),
    ("ghayn","غ","غـ","ـغـ","ـغ","gh",False),
    ("fa","ف","فـ","ـفـ","ـف","f",False),
    ("qaf","ق","قـ","ـقـ","ـق","q",False),
    ("kaf","ك","كـ","ـكـ","ـك","k",False),
    ("lam","ل","لـ","ـلـ","ـل","l",False),
    ("mim","م","مـ","ـمـ","ـم","m",False),
    ("nun","ن","نـ","ـنـ","ـن","n",False),
    ("ha-round","ه","هـ","ـهـ","ـه","h (light)",False),
    ("waw","و","و","ـو","ـو","w / u",True),
    ("ya","ي","يـ","ـيـ","ـي","y / i",False),
]

SOUND_WORDS = [  # example word per letter
    ("أسَد","asad","lion"),("باب","bab","door"),("تمر","tamr","dates"),("ثلج","thalj","snow"),
    ("جمل","jamal","camel"),("حوت","hut","whale"),("خرzuf","khuruf","sheep"),("دار","dar","house"),
    ("ذهب","dhahab","gold"),("ريح","rih","wind"),("زيتون","zaytun","olive"),("سمك","samak","fish"),
    ("شمس","shams","sun"),("صقر","saqr","falcon"),("ضيف","dayf","guest"),("طير","tayr","bird"),
    ("ظل","zill","shade"),("عين","ayn","eye"),("غيم","ghaym","cloud"),("فيل","fil","elephant"),
    ("قمر","qamar","moon"),("كتاب","kitab","book"),("ليل","layl","night"),("ماء","maa","water"),
    ("نور","nur","light"),("هدية","hadiyya","gift"),("ورد","ward","rose"),("يد","yad","hand"),
]

alphabet = []
for i,(name,iso,init,med,fin,tr,nc) in enumerate(LETTERS):
    w_ar,w_tl,w_en = SOUND_WORDS[i]
    alphabet.append({
        "id": i+1, "name": name, "char": iso, "translit": tr,
        "forms": {"isolated": iso, "initial": init, "medial": med, "final": fin},
        "non_connector": nc,
        "example": {"word": w_ar, "translit": w_tl, "meaning": w_en},
        "audio": f"letters/{name}.mp3",
        "example_audio": f"words/{name}.mp3",
    })

# ---------------------------------------------------------------- VOCAB DECKS
DECK_QURAN_100 = [
    ("الله","Allah","Allah"),("ربّ","rabb","Lord"),("الناس","an-nas","the people/mankind"),
    ("الذين","alladhina","those who"),("قال","qala","he said"),("يوم","yawm","day"),
    ("الأرض","al-ard","the earth"),("السماء","as-samaa","the sky/heaven"),("الكتاب","al-kitab","the book"),
    ("آية","aaya","sign/verse"),("الرحمن","ar-Rahman","the Most Merciful"),("الرحيم","ar-Rahim","the Most Compassionate"),
    ("خير","khayr","good/goodness"),("عمل","amal","deed/work"),("حقّ","haqq","truth/right"),
    ("نور","nur","light"),("قلب","qalb","heart"),("علم","ilm","knowledge"),
    ("سبيل","sabil","path/way"),("صبر","sabr","patience"),("شيء","shay'","thing"),
    ("كلام","kalam","speech/words"),("أمر","amr","command/matter"),("ملك","mulk","dominion/kingdom"),
    ("عذاب","adhab","punishment"),("جنة","janna","garden/paradise"),("نار","nar","fire"),
    ("دنيا","dunya","world (this life)"),("آخرة","aakhira","hereafter"),("حياة","hayaat","life"),
    ("موت","mawt","death"),("خلق","khalq","creation"),("سمع","sami'a","heard"),
    ("رأى","ra'a","saw"),("علم","alima","knew"),("أتى","ataa","came"),
    ("كان","kaana","was/were"),("أكل","akala","ate"),("شرب","shariba","drank"),
    ("مشى","mashaa","walked"),("جلس","jalasa","sat"),("وقف","waqafa","stood"),
    ("بيت","bayt","house"),("باب","baab","door"),("طريق","tareeq","road"),
    ("ماء","maa'","water"),("نبات","nabaat","plant"),("شجر","shajar","tree"),
    ("فرعون","fir'awn","Pharaoh"),("موسى","Moosa","Musa/Moses"),("عيسى","Eesa","Isa/Jesus"),
    ("إبراهيم","Ibraaheem","Abraham"),("نوح","Nooh","Noah"),("محمد","Muhammad","Muhammad ﷺ"),
    ("رسول","rasool","messenger"),("نبيّ","nabiyy","prophet"),("أمّة","umma","nation/community"),
    ("كافر","kaafir","disbeliever"),("مؤمن","mu'min","believer"),("مسلم","muslim","muslim (one who submits)"),
    ("صلاة","salaah","prayer"),("زكاة","zakaah","purifying charity"),("صوم","sawm","fasting"),
    ("حجّ","hajj","pilgrimage"),("جهاد","jihaad","striving"),("شفاعة","shafaa'a","intercession"),
    ("رحمة","rahma","mercy"),("غفران","maghfira","forgiveness"),("توبة","tawba","repentance"),
    ("إيمان","eemaan","faith"),("كفر","kufr","disbelief"),("نفاق","nifaaq","hypocrisy"),
    ("صدق","sidq","truthfulness"),("كذب","kadhib","lying"),("ظلم","zulm","injustice/oppression"),
    ("عدل","adl","justice"),("فضل","fadl","bounty/grace"),("عقاب","uqooba","recompense/punishment"),
    ("ثواب","thawaab","reward"),("جازاء","jazaa'","recompense"),("حساب","hisaab","account"),
    ("قيامة","qiyaama","resurrection"),("ساعة","saa'a","hour"),("وقت","waqt","time"),
    ("ليل","layl","night"),("نهار","nahaar","day(time)"),("شمس","shams","sun"),
    ("قمر","qamar","moon"),("نجوم","nujoom","stars"),("بحر","bahr","sea"),
    ("جبال","jibaal","mountains"),("أشجار","ashjaar","trees"),("طير","tayr","birds"),
    ("أنعام","an'aam","cattle"),("ملائكة","malaa'ika","angels"),("شيطان","shaytaan","devil"),
    ("جنّ","jinn","jinn"),("إنسان","insaan","human being"),("بني","banee","sons/children of"),
]

DECK_EVERYDAY = [
    ("ولد","walad","boy"),("بنت","bint","girl"),("رجل","rajul","man"),("امرأة","imra'a","woman"),
    ("أب","ab","father"),("أم","umm","mother"),("أخ","akh","brother"),("أخت","ukht","sister"),
    ("طالب","talib","student"),("معلم","mu'allim","teacher"),("طبيب","tabeeb","doctor"),("تاجر","tajir","merchant"),
    ("مدرسة","madrasa","school"),("جامعة","jaami'a","university"),("مسجد","masjid","mosque"),("سوق","sooq","market"),
    ("سيارة","sayyaara","car"),("قطار","qitaar","train"),("طائرة","taa'ira","airplane"),("سفينة","safeena","ship"),
    ("كبير","kabeer","big"),("صغير","sagheer","small"),("جميل","jameel","beautiful"),("طويل","taweel","tall/long"),
    ("قصير","qaseer","short"),("جديد","jadeed","new"),("قديم","qadeem","old"),("سهل","sahl","easy"),
    ("صعب","sa'b","difficult"),("حلو","hulw","sweet/nice"),("مرّ","murr","bitter"),("ساخن","saakhin","hot"),
    ("بارد","baarid","cold"),("نظيف","nadheef","clean"),("وسخ","wasikh","dirty"),("غني","ghanee","rich"),
    ("فقير","faqeer","poor"),("قوي","qawiyy","strong"),("ضعيف","da'eef","weak"),("سعيد","sa'eed","happy"),
    ("حزين","hazeen","sad"),("ذكي","dhakee","intelligent"),("غبي","ghabee","foolish"),("شجاع","shujaa'","brave"),
    ("خائف","khaa'if","afraid"),("جوعان","joo'aan","hungry"),("عطشان","'atshaan","thirsty"),("متعب","mut'ab","tired"),
]

DECK_VERBS = [
    ("قال","qaala","said"),("قالوا","qaaloo","they said"),("كان","kaana","was"),("كانوا","kaanoo","they were"),
    ("فعل","fa'ala","did"),("عمل","amila","worked/did"),("جاء","jaa'a","came"),("أتى","ataa","came/brought"),
    ("ذهب","dhahaba","went"),("خرج","kharaja","exited/left"),("دخل","dakhala","entered"),("رأى","ra'aa","saw"),
    ("نظر","nazara","looked"),("سمع","sami'a","heard"),("عرف","arafa","knew"),("علم","alima","knew"),
    ("فهم","fahima","understood"),("ذكر","dhakara","remembered/mentioned"),("نسى","nasiya","forgot"),
    ("أخذ","akhadha","took"),("أعطى","a'taa","gave"),("وضع","wada'a","placed"),("حمل","hamala","carried"),
    ("أكل","akala","ate"),("شرب","shariba","drank"),("لبس","labisa","wore"),("نام","naama","slept"),
    ("قام","qaama","stood"),("جلس","jalasa","sat"),("مشى","mashaa","walked"),("ركب","rakiba","rode"),
    ("كتب","kataba","wrote"),("قرأ","qara'a","read"),("درس","darasa","studied"),("تعلم","ta'allama","learned"),
    ("علّم","allama","taught"),("سأل","sa'ala","asked"),("أجاب","ajaaba","answered"),("فتح","fataha","opened"),
    ("أغلق","aghlaqa","closed"),("بنى","banaa","built"),("صنع","sana'a","made"),("وجد","wajada","found"),
    ("بحث","bahatha","searched"),("انتظر","intaZara","waited"),("سافر","saafara","traveled"),
    ("عاد","aada","returned"),("دعا","da'aa","called/supplicated"),("استمع","istami'a","listened"),
    ("أمن","amina","felt safe"),("خاف","khaafa","feared"),("حبّ","ahabba","loved"),("كره","kariha","hated"),
]

DECK_SURAH_WORDS = [
    # Al-Fatihah + common short-surah words
    ("بِسْمِ","bismi","in the name of"),("الْحَمْدُ","al-hamd","all praise"),("لِلَّهِ","lillahi","is for Allah"),
    ("رَبِّ","rabbi","Lord of"),("الْعَالَمِينَ","al-'aalameen","the worlds"),("الرَّحْمَٰنِ","ar-Rahmaan","the Most Merciful"),
    ("الرَّحِيمِ","ar-Raheem","the Most Compassionate"),("مَالِكِ","maaliki","Master/Owner of"),
    ("يَوْمِ","yawmi","Day of"),("الدِّينِ","ad-deen","Judgment/Religion"),("نَعْبُدُ","na'budu","we worship"),
    ("نَسْتَعِينُ","nasta'eenu","we seek help"),("اهْدِنَا","ihdinaa","guide us"),("الصِّرَاطَ","as-siraat","the path"),
    ("الْمُسْتَقِيمَ","al-mustaqeem","the straight"),("قُلْ","qul","say"),("هُوَ","huwa","He"),
    ("أَحَدٌ","ahad","One"),("الصَّمَدُ","as-samad","Eternal/Absolute"),("كُنْتُمْ","kuntum","you were"),
    ("أَعُوذُ","a'oodhu","I seek refuge"),("الْفَلَقِ","al-falaq","the daybreak"),("النَّاسِ","an-naas","mankind"),
    ("الْوَسْوَاسِ","al-waswaas","the whisperer"),("الْخَنَّاسِ","al-khannaas","who withdraws"),
    ("الْعَالَمِينَ","al-'aalameen","of the worlds"),("شَرِّ","sharri","evil of"),("مَا","maa","what/not"),
    ("خَلَقَ","khalaqa","created"),("أَنَا","anaa","I"),("أَنتُمْ","antum","you (pl.)"),
    ("نَحْنُ","nahnu","we"),("هُمْ","hum","they"),("هِيَ","hiya","she/it"),("هَذَا","haadhaa","this"),
    ("تِلْكَ","tilka","that (f.)"),("الَّذِي","alladhee","who/which (m.)"),("الَّتِي","allatee","who/which (f.)"),
]

DECKS = {
    "quran-core": {"title": "Quran Core 100", "desc": "The most frequent words in the Quran — master these and you recognize ~50% of every page.", "words": [{"ar": a, "tl": t, "en": e} for a,t,e in DECK_QURAN_100]},
    "everyday": {"title": "Everyday Arabic", "desc": "People, places, adjectives — Madinah Book 1 vocabulary.", "words": [{"ar": a, "tl": t, "en": e} for a,t,e in DECK_EVERYDAY]},
    "verbs-50": {"title": "Top 50 Verbs", "desc": "Past-tense verbs that carry most Quranic narrative.", "words": [{"ar": a, "tl": t, "en": e} for a,t,e in DECK_VERBS]},
    "surah-vocab": {"title": "Surah Vocabulary", "desc": "Word-by-word keys for Al-Fatihah and the short surahs.", "words": [{"ar": a, "tl": t, "en": e} for a,t,e in DECK_SURAH_WORDS]},
}

# ---------------------------------------------------------------- LESSONS
def mc(q, options, answer_idx, hint=""):
    return {"type":"mc","q":q,"options":options,"answer":answer_idx,"hint":hint}

def match(pairs):
    return {"type":"match","pairs":pairs}

lessons_l0 = [
 {"id":"L0.1","title":"The Arabic Alphabet","level":0,"minutes":15,
  "explain":[
   "Arabic has 28 letters, written right-to-left. Each letter has a NAME (used when reciting the alphabet) and a SOUND.",
   "Letters connect to each other like links in a chain — this is why Arabic words look woven together.",
   "Click any card below to hear its name and an example word."
  ],
  "interactive":{"kind":"alphabet"},
  "drills":[
   mc("Which letter is ب ?",["Alif ا","Ba ب","Ta ت","Ya ي"],1),
   mc("What is the FIRST letter of the alphabet?",["ب","ا","م","ن"],1),
   mc("How many letters does Arabic have?",["26","27","28","29"],2),
   mc("Arabic is written…",["left-to-right","top-to-bottom","right-to-left","bottom-to-top"],2),
   match([["ا","alif"],["م","meem"],["ن","noon"],["ي","ya"]]),
  ]},
 {"id":"L0.2","title":"Letter Forms: One Letter, Four Shapes","level":0,"minutes":20,
  "explain":[
   "Every letter changes shape depending on WHERE it sits in a word: isolated (alone), initial (start), medial (middle), final (end).",
   "Most letters have TWO tails: a connecting tail (like ـبـ) used inside words, and their own shape at word ends.",
   "Six letters are 'proud' — they refuse to connect to what comes AFTER them: ا د ذ ر ز و. They only connect on their RIGHT side."
  ],
  "interactive":{"kind":"forms"},
  "drills":[
   mc("Which letter NEVER connects to the following letter?",["ب","م","د","س"],2),
   mc("The initial form of م is:",["مـ","ـمـ","ـم","م"],0),
   mc("In the word كتاب (kitab), the ب appears in which form?",["isolated","initial","medial","final"],3),
   mc("How many non-connecting letters are there?",["4","5","6","7"],2),
   match([["بـ","initial ba"],["ـبـ","medial ba"],["ـب","final ba"],["ب","isolated ba"]]),
  ]},
 {"id":"L0.3","title":"Look-Alike Families","level":0,"minutes":15,
  "explain":[
   "Many letters share the same skeleton and differ ONLY by dots:",
   "• ب ت ث — one dot below, two above, three above\n• ج ح خ — dot inside, no dot, dot above\n• د ذ — no dot, dot above\n• ر ز — no dot, dot above\n• س ش — no dots, three dots\n• ص ض • ط ظ • ع غ • ف ق",
   "Train your eye: dots are meaning-critical. بيت (house) vs تيت (not a word!)."
  ],
  "interactive":{"kind":"quiz"},
  "drills":[
   mc("ب has its dot…",["above","below","inside","no dot"],1),
   mc("ح differs from ج by:",["dots above","having NO dot","dot below","shape"],1),
   mc("Which pair differs by ONE dot?",["س ش","ب ت","ع غ","all of them"],3),
   mc("ط vs ظ differ by:",["nothing","one dot above","two dots","shape"],1),
   match([["ث","three dots above"],["ت","two dots above"],["ب","one dot below"],["ج","one dot inside"]]),
  ]},
]

lessons_l1 = [
 {"id":"L1.1","title":"Short Vowels: Fatha, Damma, Kasra","level":1,"minutes":20,
  "explain":[
   "Arabic short vowels are small MARKS above or below letters (harakaat):",
   "• Fatha َ (above): 'a' sound — بَ = ba\n• Damma ُ (above, tiny waw): 'u' sound — بُ = bu\n• Kasra ِ (below): 'i' sound — بِ = bi",
   "Unvoweled text (like newspapers) omits these — but the Quran ALWAYS shows them. That's why we learn with mushaf-style text."
  ],
  "interactive":{"kind":"vowels"},
  "drills":[
   mc("بَ reads as:",["bi","bu","ba","ab"],2),
   mc("The kasra ِ gives which sound?",["a","u","i","e"],2),
   mc("Where is the damma written?",["below the letter","above the letter","after the letter","before the letter"],1),
   mc("مُ reads as:",["mu","mi","ma","um"],0),
   match([["بِ","bi"],["بُ","bu"],["بَ","ba"]]),
  ]},
 {"id":"L1.2","title":"Sukoon: The Silent Mark","level":1,"minutes":15,
  "explain":[
   "Sukoon ْ sits ABOVE a letter and means 'no vowel here' — the letter closes the syllable.",
   "بَبْ = bab (two beats: ba-b). Every syllable is either open (CV: بَ) or closed (CVC: بَبْ).",
   "This is the rhythm engine of Arabic reading."
  ],
  "drills":[
   mc("أَبْ reads as:",["aab","ab","abi","ba"],1),
   mc("Sukoon means the letter has…",["a long vowel","no vowel","double sound","an echo"],1),
   mc("كَتَبْ has how many syllables?",["1","2","3","4"],2),
   match([["بْ","no vowel"],["بَ","short a"],["بُ","short u"]]),
  ]},
 {"id":"L1.3","title":"Tanween: The Indefinite '-n'","level":1,"minutes":15,
  "explain":[
   "Tanween doubles the vowel mark and adds an 'n':",
   "• Fathatan ً : بً = ban\n• Dammatan ٌ : بٌ = bun\n• Kasratan ٍ : بٍ = bin",
   "Tanween marks INDEFINITE nouns (a house vs THE house). It's the grammar of 'a/an'."
  ],
  "drills":[
   mc("كِتَابٌ reads as:",["kitaban","kitabun","kitabin","kitab"],1),
   mc("Fathatan ً adds which ending?",["-un","-in","-an","-een"],2),
   mc("بَيْتٍ ends with:",["-an","-un","-in","silent"],2),
   match([["بً","ban"],["بٌ","bun"],["بٍ","bin"]]),
  ]},
 {"id":"L1.4","title":"Long Vowels: Madd","level":1,"minutes":15,
  "explain":[
   "Stretch each short vowel with its long partner:\n• ا after fatha: بَا = baa (2 beats)\n• و after damma: بُو = buu\n• ي after kasra: بِي = bii",
   "Rule of thumb: long vowel = hold 2 counts. In the Quran some stretches run 4–6 counts (tajweed madd) — we'll mark those later."
  ],
  "drills":[
   mc("قَالَ reads as:",["qala","qaala","qila","qul"],1),
   mc("بِي stretches the sound:",["a","u","i","none"],2),
   mc("A natural madd lasts about:",["half beat","1 beat","2 beats","6 beats"],2),
   match([["بَا","baa"],["بُو","buu"],["بِي","bii"]]),
  ]},
 {"id":"L1.5","title":"Shadda: The Doubler","level":1,"minutes":15,
  "explain":[
   "Shadda ّ fuses two identical letters into one written shape: read it twice.",
   "مُحَمَّد = mu-ham-mad (the م is doubled). First half carries the previous vowel, second half gets its own.",
   "Pattern: Cَ + Cْ merged = Cَّ ."
  ],
  "drills":[
   mc("رَبَّ reads as:",["raba","rabba","raaba","barra"],1),
   mc("Shadda means the letter is…",["silent","long","doubled","heavy"],2),
   mc("In مُدَرِّس the doubled letter is:",["م","د","ر","س"],2),
   match([["بَّ","bba"],["بْ","silent b"],["بَا","baa"]]),
  ]},
 {"id":"L1.6","title":"Sun & Moon Letters: the ال Rule","level":1,"minutes":20,
  "explain":[
   "ال (al-) = 'the'. But its ل behaves differently depending on the next letter:",
   "• MOON letters (14): pronounced normally — القَمَر = al-qamar (hear the l)\n• SUN letters (14): the ل vanishes into the next letter, which takes shadda — الشَّمْس = ash-shams (NOT al-shams)",
   "Moon: ا ب ج ح خ ع غ ف ق ك م ه و ي\nSun: ت ث د ذ ر ز س ش ص ض ط ظ ل ن"
  ],
  "drills":[
   mc("الشَّمْس is pronounced:",["al-shams","ash-shams","al-sams","shams-al"],1),
   mc("القَمَر is pronounced:",["aq-qamar","al-qamar","al-gamar","qamar-al"],1),
   mc("ر is a … letter.",["sun","moon","neutral","non-existent"],0),
   mc("After ال, a sun letter gets…",["sukoon","shadda","tanween","madd"],1),
   match([["الشمس","ash-shams"],["القمر","al-qamar"],["النور","an-nur"],["الكتاب","al-kitab"]]),
  ]},
 {"id":"L1.7","title":"Special Letters: ء ة ى ٰ","level":1,"minutes":20,
  "explain":[
   "• Hamza ء: the glottal stop. Rides on carriers: أ إ ؤ ئ.\n• Taa marbuta ة: 'circle-taa', sounds like 'a/h' at word end — مدرسة madrasa(t).\n• Alif maqsura ى: looks like ya without dots, sounds like long aa — موسى Moosa.\n• Dagger alif ٰ : hidden long aa written as small alif — رَحْمَٰن rahmaan.",
   "These four cause 90% of beginner spelling confusion. Meet them now, master them with practice."
  ],
  "drills":[
   mc("مدرسة ends with the sound:",["-ta","-a/-h","-at always","-ya"],1),
   mc("موسى ends with:",["ya sound","aa sound","a sound","silent"],1),
   mc("The dagger alif ٰ represents:",["short a","long aa","hamza","waw"],1),
   mc("أ carries:",["kasra under","hamza above","shadda","sukoon"],1),
   match([["ة","taa marbuta"],["ى","alif maqsura"],["ء","hamza"],["ٰ","dagger alif"]]),
  ]},
]

lessons_l2 = [
 {"id":"L2.1","title":"First Sentences: Mubtada & Khabar","level":2,"minutes":25,
  "explain":[
   "Arabic's simplest sentence needs NO verb: TOPIC (mubtada) + COMMENT (khabar).",
   "• الْبَيْتُ كَبِيرٌ — al-baytu kabeerun — 'The house (is) big.'\n• اللُّغَةُ جَمِيلَةٌ — 'The language (is) beautiful.'",
   "Notice: definite topic (الـ…) pairs with indefinite comment (-un tanween). No verb 'is' needed — it's implied."
  ],
  "drills":[
   mc("الْبَيْتُ كَبِيرٌ means:",["The big house","The house is big","A big house","Houses are big"],1),
   mc("In Arabic, 'is/am/are' is…",["a required verb","usually omitted","always هو","never allowed"],1),
   mc("Which is 'The door is new'?",["الباب الجديد","البابُ جديدٌ","باب جديد","جديد الباب"],1),
   match([["الْبَيْتُ كَبِيرٌ","The house is big"],["اللُّغَةُ جَمِيلَةٌ","The language is beautiful"]]),
  ]},
 {"id":"L2.2","title":"Pronouns & Demonstratives","level":2,"minutes":25,
  "explain":[
   "Detached pronouns: أنا I · أنتَ you(m) · أنتِ you(f) · هو he · هي she · نحن we · أنتم you(pl) · هم they.",
   "Demonstratives: هذا (this-m) · هذه (this-f) · ذلك (that-m) · تلك (that-f).",
   "هذا كِتَابٌ — 'This is a book.' Note: demonstrative + indefinite noun = sentence."
  ],
  "drills":[
   mc("هِيَ means:",["he","she","they","we"],1),
   mc("'This is a mosque' =",["هذا مسجد","هذه مسجد","ذلك مساجد","مسجد هذا"],0),
   mc("تِلْكَ refers to something…",["near, masculine","far, feminine","plural only","abstract"],1),
   match([["أنا","I"],["هو","he"],["نحن","we"],["هم","they"]]),
  ]},
 {"id":"L2.3","title":"Idafa: The Possessive Chain","level":2,"minutes":25,
  "explain":[
   "Possession = two nouns glued together, SECOND noun takes no ال and often drops its final vowel:",
   "• كِتَابُ الطَّالِبِ — kitabu-t-talibi — 'the student's book'\n• بَيْتُ اللهِ — baytu-llahi — 'the House of Allah'",
   "Rule: first noun NEVER takes ال or tanween. The idafa chain is everywhere in the Quran: رَبِّ الْعَالَمِينَ 'Lord OF the worlds'."
  ],
  "drills":[
   mc("رَبِّ الْعَالَمِينَ means:",["The worlds' Lord is","Lord of the worlds","Worlds of the Lord","The Lord and worlds"],1),
   mc("In idafa, the FIRST noun never takes:",["any vowels","ال or tanween","shadda","a plural"],1),
   mc("'The teacher's book' =",["كتاب المعلم","كتابُ المعلّمِ","المعلم كتاب","كتاب في معلم"],1),
   match([["بَيْتُ اللهِ","House of Allah"],["كِتَابُ الطَّالِبِ","student's book"]]),
  ]},
 {"id":"L2.4","title":"Prepositions & Attached Pronouns","level":2,"minutes":30,
  "explain":[
   "Core prepositions: في in · مِن from · إلى to · على on · مَع with · لِ for.",
   "Prepositions glue pronouns directly: فيه in-it · منه from-it · إليه to-it · عليه on-it · له for-him.",
   "Quranic rhythm: فِيهِ هُدًى — 'IN it (is) guidance.'"
  ],
  "drills":[
   mc("فِيهِ means:",["in him/it","from it","to him","on it"],0),
   mc("مِنَ الْكِتَابِ means:",["in the book","from the book","on the book","for the book"],1),
   mc("له means:",["with him","for him","against him","without him"],1),
   match([["في","in"],["من","from"],["إلى","to"],["مع","with"]]),
  ]},
 {"id":"L2.5","title":"Past-Tense Verbs","level":2,"minutes":30,
  "explain":[
   "The past tense is built on a 3-letter root: كَتَبَ (he wrote). Swap endings for person:",
   "• كَتَبْتُ I wrote · كَتَبْتَ you(m) wrote · كَتَبَتْ she wrote\n• كَتَبْنَا we wrote · كَتَبُوا they wrote",
   "Quranic core: قَالَ he said · قَالُوا they said · كَانَ was · خَلَقَ created."
  ],
  "drills":[
   mc("كَتَبْتُ means:",["he wrote","I wrote","we wrote","she wrote"],1),
   mc("قَالُوا means:",["he said","she said","they said","you said"],2),
   mc("The root of كَتَبَ is:",["ك ت ب","ت ب ك","ب ك ت","ك ب ت"],0),
   match([["كَتَبْنَا","we wrote"],["كَتَبَتْ","she wrote"],["كَتَبْتَ","you (m) wrote"]]),
  ]},
 {"id":"L2.6","title":"Present-Tense Verbs","level":2,"minutes":30,
  "explain":[
   "Present tense starts with a prefix: يَكْتُبُ he writes · تَكْتُبُ she writes · أَكْتُبُ I write · نَكْتُبُ we write.",
   "Prefix map: يـ he/they(m) · تـ she/you · أـ I · نـ we.",
   "Compare: كَتَبَ (past) vs يَكْتُبُ (present) — same root, different frame."
  ],
  "drills":[
   mc("يَكْتُبُ means:",["he wrote","he writes","I write","write!"],1),
   mc("Which prefix marks 'I' in present tense?",["يـ","تـ","أـ","نـ"],2),
   mc("نَعْبُدُ means:",["we worship","he worships","they worshipped","worship!"],0),
   match([["يَقْرَأُ","he reads"],["نَقْرَأُ","we read"],["أَقْرَأُ","I read"]]),
  ]},
 {"id":"L2.7","title":"Plurals & Numbers","level":2,"minutes":30,
  "explain":[
   "Sound plurals add endings: مُسْلِمون (masc pl) · مُسْلِمَات (fem pl).",
   "Broken plurals reshape the word: كِتَاب → كُتُب (books) · رَجُل → رِجَال (men). Memorize as pairs.",
   "Numbers 1-10: واحِد اثْنان ثلاثة أربعة خمسة ستة سبعة ثمانية تسعة عشرة. (Number-noun agreement is famously reversed — later lesson!)"
  ],
  "drills":[
   mc("كُتُب is the plural of:",["كاتب","كتاب","مكتب","كتب"],1),
   mc("ثلاثة means:",["3","8","9","10"],0),
   mc("مُسْلِمَات is:",["singular","dual","sound fem plural","broken plural"],2),
   match([["اثنان","2"],["خمسة","5"],["عشرة","10"]]),
  ]},
]

lessons_l3 = [
 {"id":"L3.1","title":"Roots: The DNA of Arabic","level":3,"minutes":30,
  "explain":[
   "Nearly every Arabic word grows from a 3-letter ROOT carrying a core meaning.",
   "From ك-ت-ب (writing): كِتَاب book · كَاتِب writer · مَكْتَب desk · مَكْتَبَة library · كِتَابَة writing.",
   "Learn roots, not words — one root unlocks a whole family. The Quranic Arabic Corpus tags every Quran word by root."
  ],
  "drills":[
   mc("Words from root ع-ل-م relate to:",["water","knowledge","writing","peace"],1),
   mc("مَكْتَبَة most likely means:",["writer","library","letter","pen"],1),
   mc("The root of إِسْلَام is:",["س ل م","ل م س","س م ل","إ س ل"],0),
   match([["ك-ت-ب","writing"],["ع-ل-م","knowing"],["س-ل-م","peace/submission"]]),
  ]},
 {"id":"L3.2","title":"Case Endings: I'rab in Miniature","level":3,"minutes":35,
  "explain":[
   "Final vowels do GRAMMAR work: -u (subject/default) · -a (object/after prepositions) · -i (possessed/after preposition).",
   "• الطَّالِبُ جَاءَ — the student (SUBJECT) came.\n• رَأَيْتُ الطَّالِبَ — I saw the student (OBJECT).\n• كِتَابُ الطَّالِبِ — the student's book (POSSESSOR).",
   "Full-vowel text (like the mushaf) encodes all of this. That's why reading the Quran trains real grammar instinct."
  ],
  "drills":[
   mc("The ending -i typically marks:",["subject","object","possessor/prepositional","verb"],2),
   mc("In رَأَيْتُ الطَّالِبَ, الطَّالِبَ is the:",["subject","object","possessor","verb"],1),
   mc("Case endings are visible in:",["newspapers only","the mushaf text","never","English"],1),
   match([["-u","subject"],["-a","object"],["-i","possessor"]]),
  ]},
 {"id":"L3.3","title":"Reading Fatihah Word-by-Word","level":3,"minutes":40,
  "explain":[
   "Now assemble everything on Surah Al-Fatihah — the most-recited chapter:",
   "• الْحَمْدُ لِلَّهِ — 'ALL praise (belongs) to Allah' (nominal sentence + idafa-like لِ)\n• رَبِّ الْعَالَمِينَ — idafa: 'Lord of the worlds'\n• نَعْبُدُ وَنَسْتَعِينُ — 'We worship and we seek help' (present verbs, نـ prefix)",
   "Open the Quran Reader → Surah 1, tap each word, hear it, see its meaning. Then return and take the quiz."
  ],
  "link":"/pages/quran-reader.html?surah=1",
  "drills":[
   mc("الْحَمْدُ لِلَّهِ literally structures as:",["verb + subject","praise + to Allah","question + answer","past + present"],1),
   mc("نَسْتَعِينُ breaks down as:",["we-seek-help","he-helped","help!","helper"],0),
   mc("اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ means:",["Guide us to the straight path","The path is straight","We found the path","Straighten our road"],0),
   match([["نَعْبُدُ","we worship"],["الْعَالَمِينَ","the worlds"],["الصِّرَاطَ الْمُسْتَقِيمَ","the straight path"]]),
  ]},
 {"id":"L3.4","title":"Quranic Connectors & Phrases","level":3,"minutes":30,
  "explain":[
   "High-frequency glue words that stitch verses together:",
   "• وَ and · ثُمَّ then · فَ so/then · بَل rather · إِنَّ indeed · أَلَّا / أَنْ that\n• كَمَا just as · لَكِنْ but · حَتَّى until · إِذْ when",
   "Spotting these while reading lets your eyes ride the verse's logic instead of drowning in vocabulary."
  ],
  "drills":[
   mc("إِنَّ adds emphasis meaning roughly:",["maybe","indeed","but","or"],1),
   mc("فَ usually means:",["so/then","never","because not","without"],0),
   mc("حَتَّى means:",["until","except","if","why"],0),
   match([["وَ","and"],["ثُمَّ","then"],["لَكِنْ","but"],["إِذْ","when"]]),
  ]},
]

# ---------------------------------------------------------------- TAJWEED MODULE
TAJWEED_RULES = [
 {"id":"noon-sakin","title":"Noon Sakinah & Tanween Rules","color":"#22c55e",
  "body":"When noon ساكنة (or tanween) meets the next letter, one of FOUR things happens:",
  "rules":[
   ["Izhar (clear)","with ء ه ع ح غ خ — pronounce noon plainly, no nasalization.","مِنْ خَيْر"],
   ["Idgham (merge)","with ي ر م ل و ن — noon melts into the letter. With ي ن م و add ghunnah (nasal).","مَنْ يَعْمَل"],
   ["Iqlab (flip)","with ب — noon becomes a hidden meem + ghunnah.","مِنْ بَعْد"],
   ["Ikhfa (hide)","with the remaining 15 letters — noon hides, ghunnah ~2 counts.","مِنْ قَبْل"],
  ]},
 {"id":"meem-sakin","title":"Meem Sakinah Rules","color":"#3b82f6",
  "body":"Static meem has THREE treatments:",
  "rules":[
   ["Ikhfa Shafawi","followed by ب — hide meem w/ light ghunnah.","تَمْبِيه"],
   ["Idgham Shafawi","followed by م — merge into meem w/ ghunnah.","لَهُمْ مَا"],
   ["Izhar Shafawi","any other letter — pronounce plainly.","أَمْ لَمْ"],
  ]},
 {"id":"madd","title":"Madd (Elongation) Rules","color":"#eab308",
  "body":"Any madd letter (ا و ي) stretches its vowel:",
  "rules":[
   ["Madd Tabee'i (natural)","2 counts — no hamza/sukoon involved.","قَالَ · يَقُولُ · قِيل"],
   ["Madd Muttasil (connected)","4-5 counts — madd + hamza in SAME word.","جَاءَ · السَّمَاء"],
   ["Madd Munfasil (separated)","4-5 counts — madd ends word, hamza starts next.","يَا أَيُّهَا"],
   ["Madd Laazim (obligatory)","6 counts — madd + permanent sukoon.","الضَّالِّينَ · الضَّاد"],
  ]},
 {"id":"misc","title":"Qalqalah, Tafkheem & Waqf","color":"#ef4444",
  "body":"Finishing touches of beautiful recitation:",
  "rules":[
   ["Qalqalah","echo letters ق ط ب ج د — bounce them when sakinah.","اقْرَأْ · يَجْعَل"],
   ["Tafkheem (heaviness)","خ ص ض ط ظ غ ق + heavy ر — full mouth.","صِرَاط vs سراط-light"],
   ["Waqf signs","م stop required · لا don't stop · جلى permissible · صلى preferred.","—"],
  ]},
]

# ---------------------------------------------------------------- WRITE FILES
files = {
    "alphabet.json": alphabet,
    "decks.json": DECKS,
    "levels.json": {
        "0": {"title": "Foundations", "subtitle": "Script & sounds", "lessons": lessons_l0},
        "1": {"title": "Reading", "subtitle": "Harakat to fluency", "lessons": lessons_l1},
        "2": {"title": "Grammar I", "subtitle": "Sentences & verbs", "lessons": lessons_l2},
        "3": {"title": "Grammar II & Quran", "subtitle": "Roots, cases, Fatihah", "lessons": lessons_l3},
    },
    "tajweed.json": TAJWEED_RULES,
}
for fname, data in files.items():
    with open(os.path.join(OUT, fname), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"wrote {fname}")

total_drills = sum(len(l.get("drills",[])) for ls in files["levels.json"].values() for l in ls["lessons"])
print(f"curriculum: {sum(len(ls['lessons']) for ls in files['levels.json'].values())} lessons, {total_drills} drills, {sum(len(d['words']) for d in DECKS.values())} vocab words")
