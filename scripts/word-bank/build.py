"""Build the Word Bank expansion from 한국어기초사전 (NIKL Basic Korean Dictionary,
CC BY-SA 2.0 KR) via the hac541309/basic_korean_dict dataset.

One row per headword: level from the official vocabulary grade (초급→Beginner,
중급→Intermediate, 고급→Advanced), English from the dictionary's own English
equivalents (first two senses), part of speech, and the first human-written
example sentence. Writes build/words.json and prints stats + samples.
Romanization is added afterwards by romanize.ts (same rules as the site)."""
import json, os, random, re
from collections import Counter, OrderedDict
import pandas as pd
from huggingface_hub import hf_hub_download

REPO = "hac541309/basic_korean_dict"
p = hf_hub_download(REPO, "data/train-00000-of-00001-5af3bc601874131d.parquet", repo_type="dataset")
df = pd.read_parquet(p)

# Fields look like "라벨: 값, 라벨: 값, …"; a value runs until the next
# ", <label>: " (labels are short and contain no comma or colon).
def field(text, key):
    m = re.search(r"(?:^|, )" + re.escape(key) + r": (.*?)(?=, [^,:<>]{1,24}: |$)", text, re.S)
    return m.group(1).strip() if m else ""

# Word Universe / Word Bank topics from the dictionary's own 의미 범주
# (e.g. "식생활 > 식사 및 조리 행위"), most specific match first.
TOPICS = [
    ("food", ("식생활", "음식", "요리", "식사", "식품", "맛")),
    ("study", ("교육", "학문", "학교", "언어")),
    ("places", ("장소", "지역", "교통", "주거", "건물", "시설", "위치")),
    ("work", ("직장", "경제", "직업", "산업", "회사", "업무")),
    ("culture", ("문화", "예술", "종교", "여가", "스포츠", "대중 매체", "취미")),
    ("nature", ("자연", "동식물", "동물", "식물", "날씨", "기후", "천체", "지형")),
    ("people", ("사람의 종류", "인간관계", "가족", "친족")),
    ("society", ("정치", "행정", "사회", "법", "국가", "제도", "군사")),
]
def topic_tag(cat):
    for tag, keys in TOPICS:
        if any(k in cat for k in keys): return tag
    return "daily"

LEVEL = {"초급": "Beginner", "중급": "Intermediate", "고급": "Advanced"}
POS_OK = {"명사", "동사", "형용사", "부사", "대명사", "수사", "관형사", "감탄사"}
NO_EQ = re.compile(r"^\(?(no equivalent|no corresponding)", re.I)

words = OrderedDict()
stats = Counter()
for t in df["text"]:
    head = field(t, "표제어"); kind = field(t, "구분"); pos = field(t, "품사"); grade = field(t, "어휘 등급")
    stats["senses"] += 1
    if kind != "단어" or pos not in POS_OK or grade not in LEVEL: continue
    if not re.fullmatch(r"[가-힣]+", head or ""): continue
    en = field(t, "영어 대역어")
    en = "" if NO_EQ.match(en) else en.strip(" .")
    if pos == "명사" and head.endswith("적"):          # 치명적 → "fatal", not "being fatal"
        en = re.sub(r"(^|; )being ", r"\1", en)
    ex = ""
    for part in re.split(r"\\n|\n", field(t, "용례") or ""):
        if part.startswith("<문장> "):
            ex = part[len("<문장> "):].strip(); break
    cat = field(t, "의미 범주")
    w = words.get(head)
    if not w:
        words[head] = w = {"ko": head, "pos": pos, "level": LEVEL[grade], "en": [], "example_ko": ex, "tag": ""}
    if not w["tag"] and cat and cat != "없음": w["tag"] = topic_tag(cat)
    if en and len(w["en"]) < 3:
        for part in [x.strip() for x in en.split(";") if x.strip()]:
            if part.lower() not in [e.lower() for e in w["en"]] and len(w["en"]) < 3: w["en"].append(part)
    if not w["example_ko"] and ex: w["example_ko"] = ex

rows = [dict(w, en="; ".join(w["en"])) for w in words.values() if w["en"]]

# Stats on everything the dictionary has (graded or not) — informs whether the
# ungraded rest is worth importing. Not written anywhere.
all_heads, ungraded = Counter(), {}
for t in df["text"]:
    head = field(t, "표제어"); kind = field(t, "구분"); pos = field(t, "품사"); grade = field(t, "어휘 등급")
    if kind != "단어": continue
    all_heads[pos] += 0
    if pos in POS_OK and re.fullmatch(r"[가-힣]+", head or "") and grade not in LEVEL and head not in words:
        en = field(t, "영어 대역어")
        if en and not NO_EQ.match(en): ungraded.setdefault(head, (pos, en))
print("ungraded content words with English (not already graded):", len(ungraded))
print("  by pos:", Counter(v[0] for v in ungraded.values()).most_common())
random.seed(3)
print("  samples:", [k + "=" + v[1][:30] for k, v in random.sample(list(ungraded.items()), 40)])
print("senses:", stats["senses"], "| graded headwords:", len(words), "| with English:", len(rows))
print("by level:", Counter(r["level"] for r in rows))
print("by pos:", Counter(r["pos"] for r in rows).most_common())
print("with example:", sum(1 for r in rows if r["example_ko"]))
print("by topic:", Counter(r["tag"] or "-" for r in rows).most_common())
random.seed(7)
for lv in ["Beginner", "Intermediate", "Advanced"]:
    print("--- samples", lv)
    for r in random.sample([r for r in rows if r["level"] == lv], 15):
        print(f'  {r["ko"]} [{r["pos"]}] = {r["en"]} | {r["example_ko"][:60]}')
os.makedirs("build", exist_ok=True)
json.dump(rows, open("build/words.json", "w"), ensure_ascii=False)
