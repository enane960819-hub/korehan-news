-- auto-apply
-- Reporter profiles: old brand in bios ("KoreHan News …" → "KoreHani") and an
-- English name for the one reporter whose Hangul name isn't Korean (앨리샤),
-- so the page can show it next to the Hangul (other names are romanized in
-- the browser). Only touches rows that still need it — safe to re-run.
do $$
declare k text;
begin
  if to_regclass('public.character_reporters') is null then return; end if;
  foreach k in array array['intro', 'intro_en', 'bio', 'bio_en', 'tone', 'personality'] loop
    update public.character_reporters
       set data = jsonb_set(data, array[k],
                            to_jsonb(replace(replace(data->>k, 'KoreHan News', 'KoreHani'), 'Korehan News', 'KoreHani')))
     where jsonb_typeof(data->k) = 'string'
       and (data->>k like '%KoreHan News%' or data->>k like '%Korehan News%');
  end loop;

  update public.character_reporters
     set data = data || jsonb_build_object('name_en', 'Alicia')
   where id = 'cr4' and data->>'name' = '앨리샤' and coalesce(data->>'name_en', '') = '';
end $$;
