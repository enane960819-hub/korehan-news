create table if not exists public.saved_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word_ko text not null,
  word_rom text default '',
  word_en text default '',
  created_at timestamptz not null default now(),
  unique (user_id, word_ko)
);

create index if not exists saved_words_user_id_idx on public.saved_words(user_id);
create index if not exists saved_words_word_ko_idx on public.saved_words(word_ko);

alter table public.saved_words enable row level security;

create policy if not exists "saved_words_select_own"
on public.saved_words for select
using (auth.uid() = user_id);

create policy if not exists "saved_words_insert_own"
on public.saved_words for insert
with check (auth.uid() = user_id);

create policy if not exists "saved_words_update_own"
on public.saved_words for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy if not exists "saved_words_delete_own"
on public.saved_words for delete
using (auth.uid() = user_id);
