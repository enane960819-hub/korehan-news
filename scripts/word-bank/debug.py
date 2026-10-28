"""Diagnostics for build.py (read-only): raw grade values, sense order per headword."""
import re
from collections import Counter
import pandas as pd
from huggingface_hub import hf_hub_download
df = pd.read_parquet(hf_hub_download("hac541309/basic_korean_dict", "data/train-00000-of-00001-5af3bc601874131d.parquet", repo_type="dataset"))
g = Counter(); k = Counter(); p = Counter()
for t in df["text"]:
    m = re.search(r"어휘 등급: ([^,]+)", t); g[m.group(1) if m else "<none>"] += 1
    m = re.search(r"구분: ([^,]+)", t); k[m.group(1) if m else "<none>"] += 1
    m = re.search(r"품사: ([^,]+)", t); p[m.group(1) if m else "<none>"] += 1
print("grades:", g.most_common(10)); print("kinds:", k.most_common(10)); print("pos:", p.most_common(15))
heads = Counter(re.search(r"표제어: ([^,]+)", t).group(1) for t in df["text"] if re.search(r"표제어: ([^,]+)", t))
print("unique headwords:", len(heads))
for w in ["붙다", "사실", "시장", "가다", "학교", "먹다"]:
    print("==", w)
    for t in df["text"]:
        if t.startswith("표제어: " + w + ","):
            print("   ", t[:200].replace("\n", " "))
