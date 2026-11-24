create type public.app_role as enum ('owner', 'editor', 'contributor', 'reader');
create type public.account_status as enum ('active', 'deactivated');
create type public.article_status as enum (
  'draft',
  'submitted',
  'in_review',
  'revision_requested',
  'rejected',
  'approved',
  'published',
  'unpublished'
);
create type public.feedback_kind as enum ('comment', 'revision_request', 'rejection', 'approval');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url text,
  role public.app_role not null default 'reader',
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.api_rate_limits (
  bucket_key text primary key check (char_length(bucket_key) between 1 and 128),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 40),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

create table public.site_settings (
  setting_key text primary key check (char_length(setting_key) between 1 and 80),
  setting_value jsonb not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.ai_settings (
  id integer primary key default 1 check (id = 1),
  model_name text not null check (char_length(model_name) between 1 and 128),
  system_prompt text not null default '' check (char_length(system_prompt) <= 4000),
  enabled boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.ai_settings is
  'Store non-secret local model settings only. Keep credentials and service keys in server environment variables.';

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  title text not null check (char_length(title) between 5 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  summary text not null check (char_length(summary) between 20 and 280),
  content jsonb not null check (jsonb_typeof(content) = 'object' and content ->> 'type' = 'doc'),
  cover_image_path text,
  status public.article_status not null default 'draft',
  is_featured boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index articles_public_listing_idx
  on public.articles (published_at desc)
  where status = 'published';
create index articles_author_status_idx on public.articles (author_id, status);

create table public.article_tags (
  article_id uuid not null references public.articles (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (article_id, tag_id)
);

create table public.article_revisions (
  id bigint generated always as identity primary key,
  article_id uuid not null references public.articles (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  title text not null,
  slug text not null,
  summary text not null,
  content jsonb not null,
  category_id uuid references public.categories (id) on delete set null,
  cover_image_path text,
  created_at timestamptz not null default now()
);
create index article_revisions_article_idx
  on public.article_revisions (article_id, created_at desc);

create table public.article_events (
  id bigint generated always as identity primary key,
  article_id uuid not null references public.articles (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  from_status public.article_status,
  to_status public.article_status,
  created_at timestamptz not null default now()
);

create table public.editorial_feedback (
  id bigint generated always as identity primary key,
  article_id uuid not null references public.articles (id) on delete cascade,
  editor_id uuid references auth.users (id) on delete set null,
  kind public.feedback_kind not null,
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.moderation_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  actor_name text not null,
  action text not null,
  target_user_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.article_bookmarks (
  user_id uuid not null references auth.users (id) on delete cascade,
  article_id uuid not null references public.articles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

create table public.article_likes (
  user_id uuid not null references auth.users (id) on delete cascade,
  article_id uuid not null references public.articles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

create table public.article_comments (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  article_id uuid not null references public.articles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index article_comments_listing_idx on public.article_comments (article_id, created_at);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function public.consume_rate_limit(
  p_bucket_key text,
  p_request_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  if char_length(p_bucket_key) not between 1 and 128
    or p_request_limit not between 1 and 1000
    or p_window_seconds not between 1 and 86400 then
    raise exception using errcode = '22023', message = 'Invalid rate limit parameters';
  end if;

  insert into public.api_rate_limits (bucket_key, window_started_at, request_count)
  values (p_bucket_key, now(), 1)
  on conflict (bucket_key) do update
  set window_started_at = case
        when public.api_rate_limits.window_started_at
          + make_interval(secs => p_window_seconds) <= now()
        then now()
        else public.api_rate_limits.window_started_at
      end,
      request_count = case
        when public.api_rate_limits.window_started_at
          + make_interval(secs => p_window_seconds) <= now()
        then 1
        else public.api_rate_limits.request_count + 1
      end
  returning request_count into current_count;

  return current_count <= p_request_limit;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger articles_set_updated_at
before update on public.articles
for each row execute function public.set_updated_at();

create function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
begin
  requested_name := nullif(btrim(left(new.raw_user_meta_data ->> 'display_name', 80)), '');
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(requested_name, nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Reader')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger auth_user_created_profile
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

create function public.prevent_last_active_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  removing_active_owner boolean;
begin
  removing_active_owner := false;
  if old.role = 'owner' and old.status = 'active' then
    if tg_op = 'DELETE' then
      removing_active_owner := true;
    else
      removing_active_owner :=
        new.role is distinct from 'owner' or new.status is distinct from 'active';
    end if;
  end if;

  if removing_active_owner then
    perform pg_advisory_xact_lock(78123, 1);
    if not exists (
      select 1
      from public.profiles p
      where p.id <> old.id
        and p.role = 'owner'
        and p.status = 'active'
    ) then
      raise exception using errcode = '23514', message = 'Cannot remove the last active owner';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger profiles_keep_active_owner
before update of role, status or delete on public.profiles
for each row execute function public.prevent_last_active_owner();

create function public.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.status = 'active'
  );
$$;

create function public.current_user_has_role(allowed_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.status = 'active'
      and p.role = any (allowed_roles)
  );
$$;

create function public.can_edit_article(target_article_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.articles a
    join public.profiles p on p.id = (select auth.uid())
    where a.id = target_article_id
      and p.status = 'active'
      and (
        p.role = 'owner'
        or (p.role = 'editor' and a.status in ('submitted', 'in_review'))
        or (
          p.role = 'contributor'
          and a.author_id = p.id
          and a.status in ('draft', 'revision_requested', 'rejected')
        )
      )
  );
$$;

create function public.admin_update_profile(
  target_user_id uuid,
  new_role public.app_role default null,
  new_status public.account_status default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_profile public.profiles%rowtype;
begin
  if not public.current_user_has_role(array['owner']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'Owner role required';
  end if;
  if new_role is null and new_status is null then
    raise exception using errcode = '22023', message = 'A role or account status is required';
  end if;

  select * into old_profile
  from public.profiles
  where id = target_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'User profile not found';
  end if;

  update public.profiles
  set role = coalesce(new_role, role),
      status = coalesce(new_status, status)
  where id = target_user_id;

  insert into public.moderation_logs (actor_id, actor_name, action, target_user_id, details)
  select auth.uid(), p.display_name, 'profile_updated', target_user_id,
    jsonb_build_object(
      'old_role', old_profile.role,
      'new_role', coalesce(new_role, old_profile.role),
      'old_status', old_profile.status,
      'new_status', coalesce(new_status, old_profile.status)
    )
  from public.profiles p
  where p.id = auth.uid();
end;
$$;

create function public.log_owner_action(
  action_name text,
  target_user uuid,
  action_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.current_user_has_role(array['owner']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'Owner role required';
  end if;
  if char_length(action_name) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'Invalid action name';
  end if;

  insert into public.moderation_logs (actor_id, actor_name, action, target_user_id, details)
  select auth.uid(), p.display_name, action_name, target_user, coalesce(action_details, '{}'::jsonb)
  from public.profiles p
  where p.id = auth.uid();
end;
$$;

create function public.save_article(
  target_article_id uuid,
  article_title text,
  article_slug text,
  article_summary text,
  article_content jsonb,
  article_category_id uuid default null,
  article_cover_image_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  existing_article public.articles%rowtype;
  saved_article_id uuid;
begin
  if actor_id is null or not public.current_user_is_active() then
    raise exception using errcode = '42501', message = 'Active account required';
  end if;
  if not public.current_user_has_role(array['owner', 'editor', 'contributor']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'Contributor role required';
  end if;
  if char_length(btrim(article_title)) not between 5 and 120
    or char_length(btrim(article_summary)) not between 20 and 280
    or article_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or jsonb_typeof(article_content) <> 'object'
    or article_content ->> 'type' <> 'doc' then
    raise exception using errcode = '22023', message = 'Article content is invalid';
  end if;
  if article_category_id is not null and not exists (
    select 1 from public.categories c where c.id = article_category_id and c.is_active
  ) then
    raise exception using errcode = '22023', message = 'Category is unavailable';
  end if;
  if target_article_id is null then
    if not public.current_user_has_role(array['owner', 'contributor']::public.app_role[]) then
      raise exception using errcode = '42501', message = 'Only contributors and owners can create articles';
    end if;
    if article_cover_image_path is not null and (
      not exists (
        select 1 from storage.objects o
        where o.bucket_id = 'article-covers' and o.name = article_cover_image_path
      )
      or (
        not public.current_user_has_role(array['owner']::public.app_role[])
        and split_part(article_cover_image_path, '/', 1) <> actor_id::text
      )
    ) then
      raise exception using errcode = '42501', message = 'Cover image is unavailable to this user';
    end if;
    insert into public.articles (
      author_id, category_id, title, slug, summary, content, cover_image_path
    )
    values (
      actor_id, article_category_id, btrim(article_title), article_slug,
      btrim(article_summary), article_content, article_cover_image_path
    )
    returning id into saved_article_id;
    insert into public.article_revisions (
      article_id, actor_id, title, slug, summary, content, category_id, cover_image_path
    )
    values (
      saved_article_id, actor_id, btrim(article_title), article_slug,
      btrim(article_summary), article_content, article_category_id, article_cover_image_path
    );
    insert into public.article_events (article_id, actor_id, action, to_status)
    values (saved_article_id, actor_id, 'created', 'draft');
    return saved_article_id;
  end if;

  select * into existing_article
  from public.articles
  where id = target_article_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Article not found';
  end if;

  if not public.can_edit_article(target_article_id) then
    raise exception using errcode = '42501', message = 'You cannot edit this article';
  end if;

  if article_cover_image_path is not null and (
    not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'article-covers' and o.name = article_cover_image_path
    )
    or (
      not public.current_user_has_role(array['owner']::public.app_role[])
      and split_part(article_cover_image_path, '/', 1) <> actor_id::text
      and not (
        public.current_user_has_role(array['editor']::public.app_role[])
        and split_part(article_cover_image_path, '/', 1) = existing_article.author_id::text
      )
    )
  ) then
    raise exception using errcode = '42501', message = 'Cover image is unavailable to this user';
  end if;

  insert into public.article_revisions (
    article_id, actor_id, title, slug, summary, content, category_id, cover_image_path
  )
  values (
    existing_article.id,
    actor_id,
    existing_article.title,
    existing_article.slug,
    existing_article.summary,
    existing_article.content,
    existing_article.category_id,
    existing_article.cover_image_path
  );

  update public.articles
  set category_id = article_category_id,
      title = btrim(article_title),
      slug = article_slug,
      summary = btrim(article_summary),
      content = article_content,
      cover_image_path = article_cover_image_path
  where id = target_article_id;

  insert into public.article_events (article_id, actor_id, action, from_status, to_status)
  values (target_article_id, actor_id, 'edited', existing_article.status, existing_article.status);

  return target_article_id;
end;
$$;

create function public.transition_article(
  target_article_id uuid,
  requested_action text,
  feedback_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.app_role;
  article_author uuid;
  old_status public.article_status;
  next_status public.article_status;
  feedback_type public.feedback_kind;
begin
  if actor_id is null or not public.current_user_is_active() then
    raise exception using errcode = '42501', message = 'Active account required';
  end if;

  select p.role into actor_role from public.profiles p where p.id = actor_id;
  select a.author_id, a.status into article_author, old_status
  from public.articles a where a.id = target_article_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Article not found';
  end if;

  if requested_action = 'submit' then
    if actor_role not in ('owner', 'contributor') or article_author is distinct from actor_id
      or old_status not in ('draft', 'revision_requested', 'rejected') then
      raise exception using errcode = '42501', message = 'Article cannot be submitted by this user';
    end if;
    next_status := 'submitted';
  elsif requested_action = 'start_review' then
    if actor_role not in ('owner', 'editor') or old_status <> 'submitted' then
      raise exception using errcode = '42501', message = 'Article cannot enter review';
    end if;
    next_status := 'in_review';
  elsif requested_action = 'request_revision' then
    if actor_role not in ('owner', 'editor') or old_status <> 'in_review' then
      raise exception using errcode = '42501', message = 'Revision cannot be requested for this article';
    end if;
    next_status := 'revision_requested';
    feedback_type := 'revision_request';
  elsif requested_action = 'reject' then
    if actor_role not in ('owner', 'editor') or old_status not in ('submitted', 'in_review') then
      raise exception using errcode = '42501', message = 'Article cannot be rejected';
    end if;
    next_status := 'rejected';
    feedback_type := 'rejection';
  elsif requested_action = 'approve' then
    if actor_role not in ('owner', 'editor') or old_status <> 'in_review' then
      raise exception using errcode = '42501', message = 'Article cannot be approved';
    end if;
    next_status := 'approved';
    feedback_type := 'approval';
  elsif requested_action = 'publish' then
    if actor_role <> 'owner' or old_status not in ('approved', 'unpublished') then
      raise exception using errcode = '42501', message = 'Only an owner can publish an approved article';
    end if;
    next_status := 'published';
  elsif requested_action = 'unpublish' then
    if actor_role <> 'owner' or old_status <> 'published' then
      raise exception using errcode = '42501', message = 'Only an owner can unpublish an article';
    end if;
    next_status := 'unpublished';
  else
    raise exception using errcode = '22023', message = 'Unknown article action';
  end if;

  if requested_action in ('request_revision', 'reject')
    and (feedback_message is null or char_length(btrim(feedback_message)) not between 1 and 4000) then
    raise exception using errcode = '22023', message = 'Editorial feedback is required';
  end if;

  update public.articles
  set status = next_status,
      published_at = case when next_status = 'published' then now() else published_at end
  where id = target_article_id;

  insert into public.article_events (article_id, actor_id, action, from_status, to_status)
  values (target_article_id, actor_id, requested_action, old_status, next_status);

  if feedback_type is not null and feedback_message is not null and btrim(feedback_message) <> '' then
    insert into public.editorial_feedback (article_id, editor_id, kind, message)
    values (target_article_id, actor_id, feedback_type, btrim(feedback_message));
  end if;
end;
$$;

create function public.delete_article(target_article_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  article_record public.articles%rowtype;
begin
  if not public.current_user_has_role(array['owner']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'Owner role required';
  end if;

  select * into article_record
  from public.articles
  where id = target_article_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Article not found';
  end if;

  insert into public.moderation_logs (actor_id, actor_name, action, details)
  select auth.uid(), p.display_name, 'article_deleted',
    jsonb_build_object('article_id', article_record.id, 'title', article_record.title)
  from public.profiles p
  where p.id = auth.uid();

  delete from public.articles where id = target_article_id;
end;
$$;

create function public.set_article_featured(target_article_id uuid, featured boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.current_user_has_role(array['owner']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'Owner role required';
  end if;
  update public.articles
  set is_featured = featured
  where id = target_article_id
    and (not featured or status = 'published');
  if not found then
    raise exception using errcode = 'P0002', message = 'Published article not found';
  end if;
end;
$$;

create function public.get_owner_analytics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.current_user_has_role(array['owner']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'Owner role required';
  end if;

  select jsonb_build_object(
    'user_count', (select count(*) from public.profiles),
    'article_count', (select count(*) from public.articles),
    'articles_by_status', coalesce(
      (
        select jsonb_object_agg(status::text, status_count)
        from (
          select status, count(*) as status_count
          from public.articles
          group by status
        ) counts
      ),
      '{}'::jsonb
    )
  )
  into result;

  return result;
end;
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.site_settings enable row level security;
alter table public.ai_settings enable row level security;
alter table public.articles enable row level security;
alter table public.article_tags enable row level security;
alter table public.article_revisions enable row level security;
alter table public.article_events enable row level security;
alter table public.editorial_feedback enable row level security;
alter table public.moderation_logs enable row level security;
alter table public.article_bookmarks enable row level security;
alter table public.article_likes enable row level security;
alter table public.article_comments enable row level security;

create policy profiles_read_self_and_editorial on public.profiles
for select to authenticated
using (
  public.current_user_is_active()
  and (
    id = (select auth.uid())
    or public.current_user_has_role(array['owner', 'editor']::public.app_role[])
  )
);

create policy profiles_update_self on public.profiles
for update to authenticated
using (id = (select auth.uid()) and public.current_user_is_active())
with check (id = (select auth.uid()) and public.current_user_is_active());

create policy categories_public_read on public.categories
for select to anon, authenticated using (is_active or public.current_user_has_role(array['owner']::public.app_role[]));
create policy categories_owner_manage on public.categories
for all to authenticated
using (public.current_user_has_role(array['owner']::public.app_role[]))
with check (public.current_user_has_role(array['owner']::public.app_role[]));

create policy tags_public_read on public.tags
for select to anon, authenticated using (true);
create policy tags_owner_manage on public.tags
for all to authenticated
using (public.current_user_has_role(array['owner']::public.app_role[]))
with check (public.current_user_has_role(array['owner']::public.app_role[]));

create policy site_settings_owner_manage on public.site_settings
for all to authenticated
using (public.current_user_has_role(array['owner']::public.app_role[]))
with check (public.current_user_has_role(array['owner']::public.app_role[]));

create policy ai_settings_owner_manage on public.ai_settings
for all to authenticated
using (public.current_user_has_role(array['owner']::public.app_role[]))
with check (public.current_user_has_role(array['owner']::public.app_role[]));

create policy articles_read_published_or_assigned on public.articles
for select to anon, authenticated
using (
  status = 'published'
  or (
    (select auth.uid()) is not null
    and public.current_user_is_active()
    and (
      author_id = (select auth.uid())
      or public.current_user_has_role(array['owner', 'editor']::public.app_role[])
    )
  )
);

create policy article_tags_read_published_or_assigned on public.article_tags
for select to anon, authenticated
using (
  exists (
    select 1 from public.articles a
    where a.id = article_id
      and (
        a.status = 'published'
        or (
          public.current_user_is_active()
          and (
            a.author_id = (select auth.uid())
            or public.current_user_has_role(array['owner', 'editor']::public.app_role[])
          )
        )
      )
  )
);
create policy article_tags_manage_editable on public.article_tags
for all to authenticated
using (public.can_edit_article(article_id))
with check (public.can_edit_article(article_id));

create policy article_revisions_read_assigned on public.article_revisions
for select to authenticated
using (
  exists (
    select 1 from public.articles a
    where a.id = article_id
      and (
        public.current_user_is_active()
        and (
          a.author_id = (select auth.uid())
          or public.current_user_has_role(array['owner', 'editor']::public.app_role[])
        )
      )
  )
);

create policy article_events_read_assigned on public.article_events
for select to authenticated
using (
  exists (
    select 1 from public.articles a
    where a.id = article_id
      and (
        public.current_user_is_active()
        and (
          a.author_id = (select auth.uid())
          or public.current_user_has_role(array['owner', 'editor']::public.app_role[])
        )
      )
  )
);

create policy editorial_feedback_read_assigned on public.editorial_feedback
for select to authenticated
using (
  exists (
    select 1 from public.articles a
    where a.id = article_id
      and (
        public.current_user_is_active()
        and (
        a.author_id = (select auth.uid())
        or public.current_user_has_role(array['owner', 'editor']::public.app_role[])
        )
      )
  )
);
create policy editorial_feedback_add_editor on public.editorial_feedback
for insert to authenticated
with check (
  editor_id = (select auth.uid())
  and kind = 'comment'
  and public.current_user_has_role(array['owner', 'editor']::public.app_role[])
  and exists (
    select 1 from public.articles a
    where a.id = article_id and a.status in ('submitted', 'in_review')
  )
);

create policy moderation_logs_read_owner on public.moderation_logs
for select to authenticated
using (public.current_user_has_role(array['owner']::public.app_role[]));

create policy bookmarks_manage_own_reader on public.article_bookmarks
for all to authenticated
using (user_id = (select auth.uid()) and public.current_user_has_role(array['reader']::public.app_role[]))
with check (
  user_id = (select auth.uid())
  and public.current_user_has_role(array['reader']::public.app_role[])
  and exists (select 1 from public.articles a where a.id = article_id and a.status = 'published')
);

create policy likes_read_published on public.article_likes
for select to anon, authenticated
using (
  (user_id = (select auth.uid()) and public.current_user_is_active())
  or public.current_user_has_role(array['owner']::public.app_role[])
);
create policy likes_add_reader on public.article_likes
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.current_user_has_role(array['reader']::public.app_role[])
  and exists (select 1 from public.articles a where a.id = article_id and a.status = 'published')
);
create policy likes_remove_own on public.article_likes
for delete to authenticated
using (user_id = (select auth.uid()) and public.current_user_has_role(array['reader']::public.app_role[]));

create policy comments_read_published on public.article_comments
for select to anon, authenticated
using (exists (select 1 from public.articles a where a.id = article_id and a.status = 'published'));
create policy comments_add_reader on public.article_comments
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.current_user_has_role(array['reader']::public.app_role[])
  and exists (select 1 from public.articles a where a.id = article_id and a.status = 'published')
);
create policy comments_delete_own_or_owner on public.article_comments
for delete to authenticated
using (
  public.current_user_is_active()
  and (
    user_id = (select auth.uid())
    or public.current_user_has_role(array['owner']::public.app_role[])
  )
);

revoke all on public.profiles, public.articles, public.article_revisions, public.article_events,
  public.editorial_feedback, public.moderation_logs, public.article_bookmarks,
  public.article_likes, public.article_comments, public.categories, public.tags,
  public.site_settings, public.ai_settings, public.article_tags, public.api_rate_limits
  from anon, authenticated, service_role;

grant select on public.profiles, public.articles, public.article_revisions,
  public.article_events, public.editorial_feedback, public.moderation_logs,
  public.article_bookmarks, public.article_likes, public.article_comments,
  public.categories, public.tags, public.article_tags to authenticated;
grant select on public.articles, public.categories, public.tags, public.article_tags,
  public.article_comments to anon;
grant select on public.article_likes to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
grant insert, update, delete on public.categories, public.tags to authenticated;
grant select, insert, update, delete on public.site_settings, public.ai_settings to authenticated;
grant insert, delete on public.article_tags to authenticated;
grant insert on public.editorial_feedback to authenticated;
grant insert, delete on public.article_bookmarks, public.article_likes, public.article_comments to authenticated;
grant usage, select on sequence public.article_comments_id_seq to authenticated;

revoke all on function public.current_user_is_active() from public, anon;
revoke all on function public.current_user_has_role(public.app_role[]) from public, anon;
revoke all on function public.can_edit_article(uuid) from public, anon;
revoke all on function public.admin_update_profile(uuid, public.app_role, public.account_status) from public, anon;
revoke all on function public.log_owner_action(text, uuid, jsonb) from public, anon;
revoke all on function public.save_article(uuid, text, text, text, jsonb, uuid, text) from public, anon;
revoke all on function public.transition_article(uuid, text, text) from public, anon;
revoke all on function public.delete_article(uuid) from public, anon;
revoke all on function public.set_article_featured(uuid, boolean) from public, anon;
revoke all on function public.get_owner_analytics() from public, anon;
revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;

grant execute on function public.current_user_is_active() to authenticated;
grant execute on function public.current_user_has_role(public.app_role[]) to authenticated;
grant execute on function public.current_user_is_active() to anon;
grant execute on function public.current_user_has_role(public.app_role[]) to anon;
grant execute on function public.can_edit_article(uuid) to authenticated;
grant execute on function public.admin_update_profile(uuid, public.app_role, public.account_status) to authenticated;
grant execute on function public.log_owner_action(text, uuid, jsonb) to authenticated;
grant execute on function public.save_article(uuid, text, text, text, jsonb, uuid, text) to authenticated;
grant execute on function public.transition_article(uuid, text, text) to authenticated;
grant execute on function public.delete_article(uuid) to authenticated;
grant execute on function public.set_article_featured(uuid, boolean) to authenticated;
grant execute on function public.get_owner_analytics() to authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'article-covers',
  'article-covers',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy article_covers_upload on storage.objects
for insert to authenticated
with check (
  bucket_id = 'article-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.current_user_has_role(array['owner', 'contributor']::public.app_role[])
);
create policy article_covers_update on storage.objects
for update to authenticated
using (
  bucket_id = 'article-covers'
  and (
    public.current_user_has_role(array['owner']::public.app_role[])
    or (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and public.current_user_has_role(array['contributor']::public.app_role[])
    )
  )
)
with check (
  bucket_id = 'article-covers'
  and (
    public.current_user_has_role(array['owner']::public.app_role[])
    or (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and public.current_user_has_role(array['contributor']::public.app_role[])
    )
  )
);
create policy article_covers_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'article-covers'
  and (
    public.current_user_has_role(array['owner']::public.app_role[])
    or (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and public.current_user_has_role(array['contributor']::public.app_role[])
    )
  )
);

create view public.article_like_counts as
select l.article_id, count(*)::bigint as like_count
from public.article_likes l
join public.articles a on a.id = l.article_id
where a.status = 'published'
group by l.article_id;
grant select on public.article_like_counts to anon, authenticated;
revoke all on public.article_like_counts from public;
