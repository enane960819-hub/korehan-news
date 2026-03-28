-- Reporter personal posts feed (v1)

create or replace function public.is_admin_email()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email','') in ('enane960819@gmail.com');
$$;

create table if not exists public.reporter_posts (
  id uuid primary key default gen_random_uuid(),
  reporter_id text not null,
  author_user_id uuid not null,
  content text not null default '',
  post_type text not null default 'general',
  status text not null default 'published' check (status in ('draft','published')),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reporter_posts_reporter_sort on public.reporter_posts(reporter_id, pinned desc, created_at desc);
create index if not exists idx_reporter_posts_author on public.reporter_posts(author_user_id, created_at desc);

create table if not exists public.reporter_post_images (
  id bigserial primary key,
  post_id uuid not null references public.reporter_posts(id) on delete cascade,
  image_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_reporter_post_images_post on public.reporter_post_images(post_id, sort_order asc);

alter table public.reporter_posts enable row level security;
alter table public.reporter_post_images enable row level security;

-- reporter_posts policies

drop policy if exists reporter_posts_select_public_or_owner on public.reporter_posts;
create policy reporter_posts_select_public_or_owner
on public.reporter_posts
for select
using (
  status = 'published'
  or auth.uid() = author_user_id
  or public.is_admin_email()
);

drop policy if exists reporter_posts_insert_owner_or_admin on public.reporter_posts;
create policy reporter_posts_insert_owner_or_admin
on public.reporter_posts
for insert
with check (
  auth.uid() = author_user_id
  or public.is_admin_email()
);

drop policy if exists reporter_posts_update_owner_or_admin on public.reporter_posts;
create policy reporter_posts_update_owner_or_admin
on public.reporter_posts
for update
using (
  auth.uid() = author_user_id
  or public.is_admin_email()
)
with check (
  auth.uid() = author_user_id
  or public.is_admin_email()
);

drop policy if exists reporter_posts_delete_owner_or_admin on public.reporter_posts;
create policy reporter_posts_delete_owner_or_admin
on public.reporter_posts
for delete
using (
  auth.uid() = author_user_id
  or public.is_admin_email()
);

-- reporter_post_images policies

drop policy if exists reporter_post_images_select_visible_post on public.reporter_post_images;
create policy reporter_post_images_select_visible_post
on public.reporter_post_images
for select
using (
  exists (
    select 1
    from public.reporter_posts rp
    where rp.id = reporter_post_images.post_id
      and (
        rp.status = 'published'
        or rp.author_user_id = auth.uid()
        or public.is_admin_email()
      )
  )
);

drop policy if exists reporter_post_images_insert_manageable_post on public.reporter_post_images;
create policy reporter_post_images_insert_manageable_post
on public.reporter_post_images
for insert
with check (
  exists (
    select 1
    from public.reporter_posts rp
    where rp.id = reporter_post_images.post_id
      and (
        rp.author_user_id = auth.uid()
        or public.is_admin_email()
      )
  )
);

drop policy if exists reporter_post_images_update_manageable_post on public.reporter_post_images;
create policy reporter_post_images_update_manageable_post
on public.reporter_post_images
for update
using (
  exists (
    select 1
    from public.reporter_posts rp
    where rp.id = reporter_post_images.post_id
      and (
        rp.author_user_id = auth.uid()
        or public.is_admin_email()
      )
  )
)
with check (
  exists (
    select 1
    from public.reporter_posts rp
    where rp.id = reporter_post_images.post_id
      and (
        rp.author_user_id = auth.uid()
        or public.is_admin_email()
      )
  )
);

drop policy if exists reporter_post_images_delete_manageable_post on public.reporter_post_images;
create policy reporter_post_images_delete_manageable_post
on public.reporter_post_images
for delete
using (
  exists (
    select 1
    from public.reporter_posts rp
    where rp.id = reporter_post_images.post_id
      and (
        rp.author_user_id = auth.uid()
        or public.is_admin_email()
      )
  )
);

grant select on public.reporter_posts to anon, authenticated;
grant insert, update, delete on public.reporter_posts to authenticated;
grant select on public.reporter_post_images to anon, authenticated;
grant insert, update, delete on public.reporter_post_images to authenticated;

-- Storage bucket for reporter post images
insert into storage.buckets (id, name, public)
values ('reporter-images', 'reporter-images', true)
on conflict (id) do nothing;

drop policy if exists reporter_images_public_read on storage.objects;
create policy reporter_images_public_read
on storage.objects
for select
using (bucket_id = 'reporter-images');

drop policy if exists reporter_images_auth_upload on storage.objects;
create policy reporter_images_auth_upload
on storage.objects
for insert
to authenticated
with check (bucket_id = 'reporter-images');

drop policy if exists reporter_images_auth_update on storage.objects;
create policy reporter_images_auth_update
on storage.objects
for update
to authenticated
using (bucket_id = 'reporter-images' and owner = auth.uid())
with check (bucket_id = 'reporter-images' and owner = auth.uid());

drop policy if exists reporter_images_auth_delete on storage.objects;
create policy reporter_images_auth_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'reporter-images' and owner = auth.uid());

notify pgrst, 'reload schema';
