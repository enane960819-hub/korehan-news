"""Extra Word Bank words (owner request 2026-10-29: "about 5,000 more, easy
ones first"). NIKL only grades 9,846 headwords and all of them are already in
the bank, so this takes the dictionary's UNGRADED content words and ranks them
by how often they are actually used (OpenSubtitles 2018 Korean frequency list,
hermitdave/FrequencyWords — used only for ranking, nothing from it is stored).

The candidates go to public.word_bank_candidates (staging, not shown to
learners). Their meanings are then reviewed by hand and only the reviewed
words are copied into vocabulary_bank by a migration.

  dry run (default): stats + samples in the log
  STAGE=1 + SUPABASE_ACCESS_TOKEN: replace the staging table's rows
"""
import json, os, re, urllib.request
from collections import Counter, OrderedDict
import pandas as pd
from huggingface_hub import hf_hub_download

REPO = "hac541309/basic_korean_dict"
p = hf_hub_download(REPO, "data/train-00000-of-00001-5af3bc601874131d.parquet", repo_type="dataset")
df = pd.read_parquet(p)

def field(text, key):
    m = re.search(r"(?:^|, )" + re.escape(key) + r": (.*?)(?=, [^,:<>]{1,24}: |$)", text, re.S)
    return m.group(1).strip() if m else ""

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

GRADED = {"초급", "중급", "고급"}
POS_OK = {"명사", "동사", "형용사", "부사", "대명사", "수사", "관형사", "감탄사"}
NO_EQ = re.compile(r"^\(?(no equivalent|no corresponding)", re.I)

graded = set()
words = OrderedDict()
for t in df["text"]:
    head = field(t, "표제어"); kind = field(t, "구분"); pos = field(t, "품사"); grade = field(t, "어휘 등급")
    if kind != "단어" or not re.fullmatch(r"[가-힣]+", head or ""): continue
    if grade in GRADED: graded.add(head); continue
    if pos not in POS_OK or len(head) < 2: continue
    en = field(t, "영어 대역어")
    en = "" if NO_EQ.match(en) else en.strip(" .")
    if pos == "명사" and head.endswith("적"):
        en = re.sub(r"(^|; )being ", r"\1", en)
    ex = ""
    for part in re.split(r"\\n|\n", field(t, "용례") or ""):
        if part.startswith("<문장> "):
            ex = part[len("<문장> "):].strip(); break
    cat = field(t, "의미 범주")
    w = words.get(head)
    if not w:
        words[head] = w = {"ko": head, "pos": pos, "senses": [], "example_ko": ex, "tag": ""}
    if not w["tag"] and cat and cat != "없음": w["tag"] = topic_tag(cat)
    # Every sense's English, kept apart (homonyms are merged under one
    # headword here) so the reviewer can pick the sense learners need.
    if en and en not in w["senses"] and len(w["senses"]) < 8: w["senses"].append(en)
    if not w["example_ko"] and ex: w["example_ko"] = ex
for h in graded: words.pop(h, None)
words = {k: v for k, v in words.items() if v["senses"]}
print("ungraded content words with English:", len(words))

FREQ_URL = "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/ko/ko_full.txt"
freq = {}
with urllib.request.urlopen(FREQ_URL, timeout=120) as r:
    for line in r.read().decode("utf-8").splitlines():
        parts = line.rsplit(" ", 1)
        if len(parts) == 2 and parts[1].isdigit(): freq[parts[0]] = int(parts[1])
print("frequency list tokens:", len(freq))

PARTICLES = ["", "은", "는", "이", "가", "을", "를", "에", "에서", "에게", "도", "만", "으로", "로",
             "와", "과", "의", "이야", "야", "이에요", "예요", "이다", "이고", "랑", "이랑", "까지", "부터", "처럼"]
PARTICLE_SET = set(p for p in PARTICLES if p)
by_prefix = {}
for tok, n in freq.items():
    by_prefix.setdefault(tok[:2], []).append((tok, n))

def stems(head):
    s = head[:-1]
    out = [s]
    if s.endswith("하"): out += [s[:-1] + "해", s[:-1] + "했"]
    last = s[-1]
    code = ord(last) - 0xAC00
    if 0 <= code < 11172 and code % 28 == 17:          # final ㅂ (ㅂ-irregular: 쉽다 → 쉬워/쉬운)
        out.append(s[:-1] + chr(ord(last) - 17))
    return out

def score(w):
    head = w["ko"]
    if head.endswith("다") and w["pos"] in ("동사", "형용사"):
        total = 0
        for st in stems(head):
            for tok, n in by_prefix.get(st[:2], []):
                rest = tok[len(st):]
                # 우리다 must not count 우리는/우리가 (the noun 우리 + particle).
                if tok.startswith(st) and 0 < len(rest) <= 3 and rest not in PARTICLE_SET: total += n
        return total
    return sum(freq.get(head + p, 0) for p in PARTICLES)

for w in words.values(): w["freq"] = score(w)
ranked = sorted((w for w in words.values() if w["freq"] >= 3), key=lambda w: -w["freq"])
TOP = 9000
cands = ranked[:TOP]
for i, w in enumerate(cands, 1): w["rank"] = i
print("with freq >= 3:", len(ranked), "| staged:", len(cands))
print("by pos:", Counter(w["pos"] for w in cands).most_common())
print("with example:", sum(1 for w in cands if w["example_ko"]))
for lo, hi in ((1, 40), (1000, 1030), (3000, 3030), (5000, 5030), (7000, 7030), (8970, 9000)):
    print(f"--- rank {lo}-{hi}")
    for w in cands[lo - 1:hi]:
        print(f'  {w["rank"]} {w["ko"]} [{w["pos"]}] f={w["freq"]} = {" | ".join(w["senses"])[:90]}')

if os.environ.get("STAGE") == "1":
    REF = os.environ["PROJECT_REF"]; TOKEN = os.environ["SUPABASE_ACCESS_TOKEN"]
    def q(sql):
        req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{REF}/database/query",
            data=json.dumps({"query": sql}).encode(), method="POST",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read() or b"null")
    q("delete from public.word_bank_candidates")
    for i in range(0, len(cands), 500):
        batch = [{"ko": w["ko"], "pos": w["pos"], "senses": " | ".join(w["senses"]), "example_ko": w["example_ko"],
                  "tag": w["tag"], "freq": w["freq"], "rank": w["rank"]} for w in cands[i:i + 500]]
        payload = json.dumps(batch, ensure_ascii=False)
        assert "$wc$" not in payload
        q(f"""insert into public.word_bank_candidates (ko, pos, senses, example_ko, tag, freq, rank)
select ko, pos, senses, nullif(example_ko, ''), nullif(tag, ''), freq, rank
  from jsonb_to_recordset($wc${payload}$wc$::jsonb)
    as x(ko text, pos text, senses text, example_ko text, tag text, freq int, rank int)
 where not exists (select 1 from public.vocabulary_bank v where v.word_ko = x.ko)
on conflict (ko) do nothing""")
    print("staged rows:", q("select count(*) from public.word_bank_candidates"))
