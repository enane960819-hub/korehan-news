"""Look inside candidate open Korean learner-dictionary datasets (read-only).
Run by .github/workflows/word-bank-data.yml (step=explore); prints to the job log."""
import json, os, sys
from huggingface_hub import list_repo_files, hf_hub_download

for repo in ["hac541309/basic_korean_dict", "J-Seo/kocca-ontology-tierB"]:
    print("=" * 70, "\n", repo)
    try:
        files = list_repo_files(repo, repo_type="dataset")
        print("files:", files[:40])
    except Exception as e:
        print("list failed:", e); continue
    if repo.startswith("hac541309"):
        import pandas as pd
        for f in files:
            if f.endswith((".parquet", ".jsonl", ".json", ".csv")):
                p = hf_hub_download(repo, f, repo_type="dataset")
                df = pd.read_parquet(p) if f.endswith(".parquet") else (pd.read_json(p, lines=f.endswith("jsonl")) if "json" in f else pd.read_csv(p))
                print(f, df.shape); print(df.columns.tolist())
                with pd.option_context("display.max_colwidth", 200, "display.width", 250):
                    print(df.head(5).to_string())
                for c in df.columns:
                    if any(k in c.lower() for k in ("grade", "level", "등급", "pos", "품사")):
                        print("value_counts", c, df[c].value_counts().head(12).to_dict())
                break
