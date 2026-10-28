"""Import build/words.json (with rom) into vocabulary_bank via the Supabase
Management API. New words are inserted (source='krdict', qa_at=now()); words
already in the bank keep their meaning/level and only get pos/example_ko
filled when empty. The requeue trigger is paused inside each transaction so
those two new columns don't push 4k reviewed rows back into the paid queue."""
import json, os, sys, urllib.request

REF = os.environ["PROJECT_REF"]; TOKEN = os.environ["SUPABASE_ACCESS_TOKEN"]
rows = json.load(open("build/words_rom.json"))
def q(sql):
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{REF}/database/query",
        data=json.dumps({"query": sql}).encode(), method="POST",
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read() or b"null")

print("before:", q("select level, count(*) from public.vocabulary_bank where is_active group by 1 order by 1"))
ins = upd = 0
B = 500
for i in range(0, len(rows), B):
    batch = [{k: r.get(k, "") for k in ("ko", "rom", "en", "level", "pos", "example_ko")} for r in rows[i:i + B]]
    payload = json.dumps(batch, ensure_ascii=False)
    assert "$wb$" not in payload
    res = q(f"""begin;
alter table public.vocabulary_bank disable trigger kh_requeue_vocab_bank;
with j as (select distinct on (ko) * from jsonb_to_recordset($wb${payload}$wb$::jsonb)
             as x(ko text, rom text, en text, level text, pos text, example_ko text)),
ins as (insert into public.vocabulary_bank (word_key, word_ko, word_rom, word_en, level, is_active, frequency, pos, example_ko, source, qa_at)
        select j.ko, j.ko, j.rom, j.en, j.level, true, 0, j.pos, nullif(j.example_ko, ''), 'krdict', now() from j
        where not exists (select 1 from public.vocabulary_bank v where v.word_key = j.ko or v.word_ko = j.ko)
        returning 1),
upd as (update public.vocabulary_bank v set pos = coalesce(v.pos, j.pos), example_ko = coalesce(v.example_ko, nullif(j.example_ko, ''))
        from j where v.word_ko = j.ko and (v.pos is null or v.example_ko is null) returning 1)
select (select count(*) from ins) as ins, (select count(*) from upd) as upd;
alter table public.vocabulary_bank enable trigger kh_requeue_vocab_bank;
commit;""")
    r = res[0] if isinstance(res, list) and res else {}
    ins += int(r.get("ins", 0) or 0); upd += int(r.get("upd", 0) or 0)
    print(f"batch {i // B + 1}: {res}")
print("inserted:", ins, "| filled pos/example on existing:", upd)

# Topics from the dictionary's 의미 범주 — only for words with no tag yet, so
# content-qa's AI tagger is left with the few words the dictionary can't place.
tagged = 0
tag_rows = [{"ko": r["ko"], "tag": r["tag"]} for r in rows if r.get("tag")]
for i in range(0, len(tag_rows), 1000):
    payload = json.dumps(tag_rows[i:i + 1000], ensure_ascii=False)
    res = q(f"""with j as (select distinct on (ko) * from jsonb_to_recordset($wt${payload}$wt$::jsonb) as x(ko text, tag text))
insert into public.word_tags (word_ko, tag) select ko, tag from j
on conflict (word_ko) do nothing returning 1""")
    tagged += len(res or [])
print("topic tags added:", tagged)
print("after:", q("select level, count(*) from public.vocabulary_bank where is_active group by 1 order by 1"))
