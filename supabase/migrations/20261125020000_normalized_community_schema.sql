create type public.article_review_status as enum (
  'comment',
  'revision_requested',
  'rejected',
  'approved'
);

create type public.comment_status as enum ('published', 'pending', 'hidden');

create type public.article_translation_language as enum ('english', 'bangla');

create type public.article_translation_style as enum (
  'simple_bangla',
  'professional_bangla',
  'bangla_technical'
);

alter table public.profiles rename column display_name to full_name;
alter table public.profiles
  add column username text,
  add column bio text not null default '';

update public.profiles
set username = coalesce(
  nullif(
    trim(both '-' from left(regexp_replace(lower(full_name), '[^a-z0-9]+', '-', 'g'), 54)),
    ''
  ),
  'member'
) || '-' || left(id::text, 8);

alter table public.profiles
  alter column username set not null,
  add constraint profiles_username_format_check
    check (char_length(username) between 1 and 64 and username ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  add constraint profiles_bio_length_check
    check (char_length(bio) <= 500);

create unique index profiles_username_lower_unique_idx
  on public.profiles (lower(username));

alter table public.categories
  add column description text not null default ''
    check (char_length(description) <= 500);

alter table public.articles rename column summary to excerpt;
alter table public.articles rename column cover_image_path to cover_image;
alter table public.articles rename column reading_time_minutes to reading_time;

alter table public.article_revisions rename column actor_id to editor_id;
alter table public.article_revisions rename column summary to excerpt;
alter table public.article_revisions rename column content to content_snapshot;
alter table public.article_revisions rename column cover_image_path to cover_image;
alter table public.article_revisions rename column reading_time_minutes to reading_time;
alter table public.article_revisions
  add column revision_number integer;

with numbered_revisions as (
  select id,
    row_number() over (partition by article_id order by created_at, id)::integer as revision_number
  from public.article_revisions
)
update public.article_revisions revisions
set revision_number = numbered_revisions.revision_number
from numbered_revisions
where revisions.id = numbered_revisions.id;

alter table public.article_revisions
  alter column revision_number set not null,
  add constraint article_revisions_number_positive_check check (revision_number > 0),
  add constraint article_revisions_article_number_unique unique (article_id, revision_number);

create function public.assign_article_revision_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.revision_number is null then
    select coalesce(max(revision_number), 0) + 1
      into new.revision_number
    from public.article_revisions
    where article_id = new.article_id;
  end if;
  return new;
end;
$$;

create trigger article_revisions_assign_number
before insert on public.article_revisions
for each row execute function public.assign_article_revision_number();

alter table public.editorial_feedback rename to article_reviews;
alter sequence public.editorial_feedback_id_seq rename to article_reviews_id_seq;
alter table public.article_reviews rename column editor_id to reviewer_id;
alter table public.article_reviews rename column kind to status;
alter table public.article_reviews rename column message to feedback;
alter table public.article_reviews
  alter column status type public.article_review_status
  using (
    case status::text
      when 'comment' then 'comment'
      when 'revision_request' then 'revision_requested'
      when 'rejection' then 'rejected'
      when 'approval' then 'approved'
    end
  )::public.article_review_status;
create index article_reviews_article_created_idx
  on public.article_reviews (article_id, created_at desc);
alter table public.article_reviews
  add column previous_status public.article_status,
  add column new_status public.article_status;

update public.article_reviews review
set previous_status = event.from_status,
    new_status = event.to_status
from public.article_events event
where review.status in ('revision_requested', 'rejected', 'approved')
  and event.article_id = review.article_id
  and event.actor_id = review.reviewer_id
  and event.created_at = review.created_at
  and event.action = case review.status
    when 'revision_requested' then 'request_revision'
    when 'rejected' then 'reject'
    when 'approved' then 'approve'
  end;

alter table public.article_reviews
  add constraint article_reviews_status_pair_check
  check ((previous_status is null) = (new_status is null));

alter table public.article_comments rename to comments;
alter sequence public.article_comments_id_seq rename to comments_id_seq;
alter table public.comments rename column body to content;
alter table public.comments
  add column parent_id bigint references public.comments (id) on delete cascade,
  add column status public.comment_status not null default 'published';

create index comments_parent_idx on public.comments (parent_id);
create index comments_article_status_created_idx
  on public.comments (article_id, status, created_at);

alter table public.article_bookmarks rename to bookmarks;
alter table public.bookmarks add column id uuid not null default gen_random_uuid();
alter table public.bookmarks drop constraint article_bookmarks_pkey;
alter table public.bookmarks add constraint bookmarks_pkey primary key (id);
alter table public.bookmarks
  add constraint bookmarks_user_article_unique unique (user_id, article_id);

alter table public.article_likes rename to likes;
alter table public.likes add column id uuid not null default gen_random_uuid();
alter table public.likes drop constraint article_likes_pkey;
alter table public.likes add constraint likes_pkey primary key (id);
alter table public.likes
  add constraint likes_user_article_unique unique (user_id, article_id);

alter table public.moderation_logs rename to audit_logs;
alter table public.audit_logs rename column actor_id to user_id;
alter table public.audit_logs rename column actor_name to user_name;
alter table public.audit_logs rename column target_user_id to entity_id;
alter table public.audit_logs rename column details to metadata;
alter table public.audit_logs
  add column entity_type text not null default 'system'
    check (entity_type in ('user', 'article', 'article_review', 'category', 'tag', 'site_setting', 'system'));

update public.audit_logs
set entity_type = case
  when metadata ? 'article_id' then 'article'
  when entity_id is not null then 'user'
  else 'system'
end,
entity_id = coalesce(entity_id, nullif(metadata ->> 'article_id', '')::uuid);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_user_idx on public.audit_logs (user_id, created_at desc);

create table public.ai_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 30000),
  task text check (task is null or char_length(task) <= 40),
  created_at timestamptz not null default now()
);

insert into public.ai_messages (conversation_id, role, content, task, created_at)
select conversation.id,
  message.value ->> 'role',
  message.value ->> 'content',
  nullif(message.value ->> 'task', ''),
  conversation.created_at + message.ordinality * interval '1 millisecond'
from public.ai_conversations conversation
cross join lateral jsonb_array_elements(conversation.messages)
  with ordinality as message(value, ordinality)
where message.value ->> 'role' in ('user', 'assistant')
  and char_length(coalesce(message.value ->> 'content', '')) between 1 and 30000;

alter table public.ai_conversations
  drop column messages,
  drop column message_count;

create index ai_messages_conversation_created_idx
  on public.ai_messages (conversation_id, created_at, id);

create table public.article_translations (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  language public.article_translation_language not null,
  style public.article_translation_style not null,
  translated_content jsonb not null
    check (
      jsonb_typeof(translated_content) = 'object'
      and translated_content ?& array['title', 'summary', 'content']
      and jsonb_typeof(translated_content -> 'title') = 'string'
      and jsonb_typeof(translated_content -> 'summary') = 'string'
      and char_length(translated_content ->> 'title') between 1 and 500
      and char_length(translated_content ->> 'summary') between 1 and 1000
      and jsonb_typeof(translated_content -> 'content') = 'object'
      and coalesce(translated_content -> 'content' ->> 'type' = 'doc', false)
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (article_id, language, style)
);

create index article_translations_article_idx
  on public.article_translations (article_id, language);

create trigger article_translations_set_updated_at
before update on public.article_translations
for each row execute function public.set_updated_at();

alter table public.ai_messages enable row level security;
alter table public.article_translations enable row level security;

drop policy if exists editorial_feedback_read_assigned on public.article_reviews;
drop policy if exists editorial_feedback_add_editor on public.article_reviews;
create policy article_reviews_read_assigned on public.article_reviews
for select to authenticated
using (
  exists (
    select 1 from public.articles article
    where article.id = article_id
      and public.current_user_is_active()
      and (
        article.author_id = (select auth.uid())
        or public.current_user_has_role(array['owner', 'editor']::public.app_role[])
      )
  )
);
create policy article_reviews_add_editor on public.article_reviews
for insert to authenticated
with check (
  reviewer_id = (select auth.uid())
  and reviewer_name = (
    select profile.full_name from public.profiles profile
    where profile.id = (select auth.uid())
  )
  and status = 'comment'
  and public.current_user_has_role(array['owner', 'editor']::public.app_role[])
  and exists (
    select 1 from public.articles article
    where article.id = article_id and article.status in ('submitted', 'in_review')
  )
);

drop policy if exists comments_read_published on public.comments;
drop policy if exists comments_add_reader on public.comments;
drop policy if exists comments_delete_own_or_owner on public.comments;
create policy comments_read_published on public.comments
for select to anon, authenticated
using (
  status = 'published'
  and exists (
    select 1 from public.articles article
    where article.id = article_id and article.status = 'published'
  )
);
create policy comments_add_reader on public.comments
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'published'
  and public.current_user_has_role(array['reader']::public.app_role[])
  and exists (
    select 1 from public.articles article
    where article.id = article_id and article.status = 'published'
  )
);
create policy comments_moderate_owner on public.comments
for update to authenticated
using (public.current_user_has_role(array['owner']::public.app_role[]))
with check (public.current_user_has_role(array['owner']::public.app_role[]));
create policy comments_delete_own_or_owner on public.comments
for delete to authenticated
using (
  public.current_user_is_active()
  and (
    user_id = (select auth.uid())
    or public.current_user_has_role(array['owner']::public.app_role[])
  )
);

drop policy if exists ai_messages_read_own on public.ai_messages;
create policy ai_messages_read_own on public.ai_messages
for select to authenticated
using (
  exists (
    select 1 from public.ai_conversations conversation
    where conversation.id = conversation_id
      and conversation.user_id = (select auth.uid())
      and public.current_user_is_active()
  )
);

create policy article_translations_read_published on public.article_translations
for select to anon, authenticated
using (
  exists (
    select 1 from public.articles article
    where article.id = article_id and article.status = 'published'
  )
);

drop policy if exists moderation_logs_read_owner on public.audit_logs;
create policy audit_logs_read_owner on public.audit_logs
for select to authenticated
using (public.current_user_has_role(array['owner']::public.app_role[]));

drop policy if exists bookmarks_manage_own_reader on public.bookmarks;
create policy bookmarks_manage_own_reader on public.bookmarks
for all to authenticated
using (
  user_id = (select auth.uid())
  and public.current_user_has_role(array['reader']::public.app_role[])
)
with check (
  user_id = (select auth.uid())
  and public.current_user_has_role(array['reader']::public.app_role[])
  and exists (
    select 1 from public.articles article
    where article.id = article_id and article.status = 'published'
  )
);

drop policy if exists likes_read_published on public.likes;
drop policy if exists likes_add_reader on public.likes;
drop policy if exists likes_remove_own on public.likes;
create policy likes_read_own_or_owner on public.likes
for select to authenticated
using (
  (user_id = (select auth.uid()) and public.current_user_is_active())
  or public.current_user_has_role(array['owner']::public.app_role[])
);
create policy likes_add_reader on public.likes
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.current_user_has_role(array['reader']::public.app_role[])
  and exists (
    select 1 from public.articles article
    where article.id = article_id and article.status = 'published'
  )
);
create policy likes_remove_own on public.likes
for delete to authenticated
using (
  user_id = (select auth.uid())
  and public.current_user_has_role(array['reader']::public.app_role[])
);

revoke all on public.article_reviews, public.comments, public.bookmarks, public.likes,
  public.ai_conversations, public.ai_messages, public.article_translations, public.audit_logs
  from anon, authenticated, service_role;

grant select on public.article_reviews, public.comments, public.bookmarks,
  public.likes, public.ai_conversations, public.ai_messages, public.article_translations,
  public.audit_logs to authenticated;
grant select on public.comments, public.article_translations to anon;
grant insert on public.article_reviews, public.comments, public.bookmarks, public.likes to authenticated;
grant delete on public.comments, public.bookmarks, public.likes, public.ai_conversations to authenticated;
grant update (status) on public.comments to authenticated;
grant usage, select on sequence public.comments_id_seq, public.article_reviews_id_seq
  to authenticated;

revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, username, avatar_url, bio) on public.profiles to authenticated;

create function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  full_name_value text;
  username_value text;
begin
  full_name_value := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'New member'
  );
  username_value := coalesce(
    nullif(trim(both '-' from left(regexp_replace(lower(full_name_value), '[^a-z0-9]+', '-', 'g'), 54)), ''),
    'member'
  ) || '-' || left(new.id::text, 8);
  insert into public.profiles (id, full_name, username)
  values (new.id, full_name_value, username_value);
  return new;
end;
$$;

create or replace function public.get_published_article_authors(article_ids uuid[])
returns table(article_id uuid, author_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select article.id, coalesce(profile.full_name, 'Former member')
  from public.articles article
  left join public.profiles profile on profile.id = article.author_id
  where article.status = 'published'
    and article.id = any(coalesce(article_ids, '{}'::uuid[]))
  limit 200;
$$;

drop function public.get_public_authors(uuid);
create function public.get_public_authors(target_author_id uuid default null)
returns table(author_id uuid, full_name text, avatar_url text, article_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id, profile.full_name, profile.avatar_url, count(article.id)::bigint
  from public.profiles profile
  join public.articles article
    on article.author_id = profile.id and article.status = 'published'
  where profile.status = 'active'
    and (target_author_id is null or profile.id = target_author_id)
  group by profile.id, profile.full_name, profile.avatar_url
  order by count(article.id) desc, profile.full_name
  limit 500;
$$;
grant execute on function public.get_public_authors(uuid) to anon, authenticated;

create or replace function public.admin_update_profile(
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

  insert into public.audit_logs (
    user_id, user_name, action, entity_type, entity_id, metadata
  )
  select auth.uid(), profile.full_name, 'profile_updated', 'user', target_user_id,
    jsonb_build_object(
      'old_role', old_profile.role,
      'new_role', coalesce(new_role, old_profile.role),
      'old_status', old_profile.status,
      'new_status', coalesce(new_status, old_profile.status)
    )
  from public.profiles profile
  where profile.id = auth.uid();
end;
$$;

create or replace function public.log_owner_action(
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
  insert into public.audit_logs (
    user_id, user_name, action, entity_type, entity_id, metadata
  )
  select auth.uid(), profile.full_name, action_name,
    case when target_user is null then 'system' else 'user' end,
    target_user, coalesce(action_details, '{}'::jsonb)
  from public.profiles profile
  where profile.id = auth.uid();
end;
$$;

create or replace function public.save_article(
  target_article_id uuid,
  article_title text,
  article_slug text,
  article_summary text,
  article_content jsonb,
  article_category_id uuid default null,
  article_cover_image_path text default null,
  article_difficulty public.article_difficulty default 'beginner',
  article_tag_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_full_name text;
  existing_article public.articles%rowtype;
  saved_article_id uuid;
  calculated_reading_time integer;
  tag_snapshot jsonb;
  requested_tags uuid[] := coalesce(article_tag_ids, '{}'::uuid[]);
  existing_tag_ids uuid[];
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
    or char_length(article_slug) > 160
    or not public.is_safe_article_document(article_content)
    or article_difficulty is null then
    raise exception using errcode = '22023', message = 'Article content is invalid';
  end if;
  if cardinality(requested_tags) > 10
    or (select count(distinct requested_tag.tag_id) from unnest(requested_tags) as requested_tag(tag_id))
      <> cardinality(requested_tags)
    or exists (
      select 1
      from unnest(requested_tags) as requested_tag(tag_id)
      where not exists (select 1 from public.tags tag where tag.id = requested_tag.tag_id)
    ) then
    raise exception using errcode = '22023', message = 'Article tags are invalid';
  end if;
  select coalesce(array_agg(requested_tag.tag_id order by requested_tag.tag_id), '{}'::uuid[])
    into requested_tags
  from unnest(requested_tags) as requested_tag(tag_id);
  if article_category_id is null or not exists (
    select 1 from public.categories category
    where category.id = article_category_id and category.is_active
  ) then
    raise exception using errcode = '22023', message = 'Category is unavailable';
  end if;

  select profile.full_name into actor_full_name
  from public.profiles profile
  where profile.id = actor_id;
  calculated_reading_time := public.article_reading_time(article_content);

  if target_article_id is null then
    if not public.current_user_has_role(array['owner', 'contributor']::public.app_role[]) then
      raise exception using errcode = '42501', message = 'Only contributors and owners can create articles';
    end if;
    if article_cover_image_path is not null and (
      not exists (
        select 1 from storage.objects object
        where object.bucket_id = 'article-covers' and object.name = article_cover_image_path
      )
      or (
        not public.current_user_has_role(array['owner']::public.app_role[])
        and split_part(article_cover_image_path, '/', 1) <> actor_id::text
      )
    ) then
      raise exception using errcode = '42501', message = 'Cover image is unavailable to this user';
    end if;

    insert into public.articles (
      author_id, category_id, title, slug, excerpt, content, cover_image,
      difficulty, reading_time
    )
    values (
      actor_id, article_category_id, btrim(article_title), article_slug,
      btrim(article_summary), article_content, article_cover_image_path,
      article_difficulty, calculated_reading_time
    )
    returning id into saved_article_id;

    insert into public.article_tags (article_id, tag_id)
    select saved_article_id, requested_tag.tag_id
    from unnest(requested_tags) as requested_tag(tag_id);

    select coalesce(
      jsonb_agg(jsonb_build_object('id', tag.id, 'name', tag.name, 'slug', tag.slug) order by tag.name),
      '[]'::jsonb
    ) into tag_snapshot
    from public.article_tags article_tag
    join public.tags tag on tag.id = article_tag.tag_id
    where article_tag.article_id = saved_article_id;

    insert into public.article_revisions (
      article_id, editor_id, title, slug, excerpt, content_snapshot, category_id,
      cover_image, difficulty, reading_time, tags
    )
    values (
      saved_article_id, actor_id, btrim(article_title), article_slug,
      btrim(article_summary), article_content, article_category_id,
      article_cover_image_path, article_difficulty, calculated_reading_time, tag_snapshot
    );
    insert into public.article_events (article_id, actor_id, actor_name, action, to_status)
    values (saved_article_id, actor_id, actor_full_name, 'created', 'draft');
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
      select 1 from storage.objects object
      where object.bucket_id = 'article-covers' and object.name = article_cover_image_path
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

  select coalesce(
    jsonb_agg(jsonb_build_object('id', tag.id, 'name', tag.name, 'slug', tag.slug) order by tag.name),
    '[]'::jsonb
  ), coalesce(array_agg(article_tag.tag_id order by article_tag.tag_id), '{}'::uuid[])
    into tag_snapshot, existing_tag_ids
  from public.article_tags article_tag
  join public.tags tag on tag.id = article_tag.tag_id
  where article_tag.article_id = existing_article.id;

  if existing_article.category_id is distinct from article_category_id
    or existing_article.title is distinct from btrim(article_title)
    or existing_article.slug is distinct from article_slug
    or existing_article.excerpt is distinct from btrim(article_summary)
    or existing_article.content is distinct from article_content
    or existing_article.cover_image is distinct from article_cover_image_path
    or existing_article.difficulty is distinct from article_difficulty
    or existing_tag_ids is distinct from requested_tags then
    insert into public.article_revisions (
      article_id, editor_id, title, slug, excerpt, content_snapshot, category_id,
      cover_image, difficulty, reading_time, tags
    )
    values (
      existing_article.id, actor_id, existing_article.title, existing_article.slug,
      existing_article.excerpt, existing_article.content, existing_article.category_id,
      existing_article.cover_image, existing_article.difficulty,
      existing_article.reading_time, tag_snapshot
    );

    update public.articles
    set category_id = article_category_id,
        title = btrim(article_title),
        slug = article_slug,
        excerpt = btrim(article_summary),
        content = article_content,
        cover_image = article_cover_image_path,
        difficulty = article_difficulty,
        reading_time = calculated_reading_time
    where id = target_article_id;

    if existing_tag_ids is distinct from requested_tags then
      delete from public.article_tags where article_id = target_article_id;
      insert into public.article_tags (article_id, tag_id)
      select target_article_id, requested_tag.tag_id
      from unnest(requested_tags) as requested_tag(tag_id);
    end if;
    delete from public.article_translations
    where article_id = target_article_id;
    insert into public.article_events (article_id, actor_id, actor_name, action, from_status, to_status)
    values (target_article_id, actor_id, actor_full_name, 'edited', existing_article.status, existing_article.status);
  end if;
  return target_article_id;
end;
$$;

create or replace function public.transition_article(
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
  actor_full_name text;
  article_author uuid;
  old_status public.article_status;
  next_status public.article_status;
  review_status public.article_review_status;
begin
  if actor_id is null or not public.current_user_is_active() then
    raise exception using errcode = '42501', message = 'Active account required';
  end if;
  select profile.role, profile.full_name into actor_role, actor_full_name
  from public.profiles profile where profile.id = actor_id;
  select article.author_id, article.status into article_author, old_status
  from public.articles article where article.id = target_article_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Article not found';
  end if;

  if requested_action = 'submit' then
    if actor_role not in ('owner', 'contributor') or article_author is distinct from actor_id
      or old_status not in ('draft', 'revision_requested', 'rejected') then
      raise exception using errcode = '42501', message = 'Article cannot be submitted by this user';
    end if;
    if not exists (
      with recursive content_nodes(node) as (
        select article.content from public.articles article where article.id = target_article_id
        union all
        select child.node from content_nodes
        cross join lateral jsonb_array_elements(
          case when jsonb_typeof(content_nodes.node -> 'content') = 'array'
            then content_nodes.node -> 'content' else '[]'::jsonb end
        ) as child(node)
      )
      select 1 from content_nodes
      where node ->> 'type' = 'text' and btrim(coalesce(node ->> 'text', '')) <> ''
    ) then
      raise exception using errcode = '22023', message = 'Add article content before submitting';
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
    review_status := 'revision_requested';
  elsif requested_action = 'reject' then
    if actor_role not in ('owner', 'editor') or old_status not in ('submitted', 'in_review') then
      raise exception using errcode = '42501', message = 'Article cannot be rejected';
    end if;
    next_status := 'rejected';
    review_status := 'rejected';
  elsif requested_action = 'approve' then
    if actor_role not in ('owner', 'editor') or old_status <> 'in_review' then
      raise exception using errcode = '42501', message = 'Article cannot be approved';
    end if;
    next_status := 'approved';
    review_status := 'approved';
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
  insert into public.article_events (article_id, actor_id, actor_name, action, from_status, to_status)
  values (target_article_id, actor_id, actor_full_name, requested_action, old_status, next_status);

  if review_status is not null and feedback_message is not null and btrim(feedback_message) <> '' then
    insert into public.article_reviews (
      article_id, reviewer_id, reviewer_name, status, feedback,
      previous_status, new_status
    )
    values (
      target_article_id, actor_id, actor_full_name, review_status, btrim(feedback_message),
      old_status, next_status
    );
  end if;
end;
$$;

create or replace function public.delete_article(target_article_id uuid)
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
  from public.articles where id = target_article_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Article not found';
  end if;
  insert into public.audit_logs (user_id, user_name, action, entity_type, entity_id, metadata)
  select auth.uid(), profile.full_name, 'article_deleted', 'article', article_record.id,
    jsonb_build_object('title', article_record.title)
  from public.profiles profile where profile.id = auth.uid();
  delete from public.articles where id = target_article_id;
end;
$$;

create function public.record_article_event_in_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (
    user_id, user_name, action, entity_type, entity_id, metadata, created_at
  )
  values (
    new.actor_id, new.actor_name, new.action, 'article', new.article_id,
    jsonb_build_object('from_status', new.from_status, 'to_status', new.to_status),
    new.created_at
  );
  return new;
end;
$$;

create trigger article_events_write_audit_log
after insert on public.article_events
for each row execute function public.record_article_event_in_audit_log();

create function public.record_article_review_in_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (
    user_id, user_name, action, entity_type, entity_id, metadata, created_at
  )
  values (
    new.reviewer_id, new.reviewer_name, 'article_review_' || new.status::text,
    'article', new.article_id,
    jsonb_build_object(
      'review_id', new.id,
      'status', new.status,
      'feedback', new.feedback,
      'previous_status', new.previous_status,
      'new_status', new.new_status
    ),
    new.created_at
  );
  return new;
end;
$$;

create trigger article_reviews_write_audit_log
after insert on public.article_reviews
for each row execute function public.record_article_review_in_audit_log();

insert into public.audit_logs (
  user_id, user_name, action, entity_type, entity_id, metadata, created_at
)
select event.actor_id, event.actor_name, event.action, 'article', event.article_id,
  jsonb_build_object('from_status', event.from_status, 'to_status', event.to_status),
  event.created_at
from public.article_events event;

insert into public.audit_logs (
  user_id, user_name, action, entity_type, entity_id, metadata, created_at
)
select review.reviewer_id, review.reviewer_name, 'article_review_' || review.status::text,
  'article', review.article_id,
  jsonb_build_object(
    'review_id', review.id,
    'status', review.status,
    'feedback', review.feedback,
    'previous_status', review.previous_status,
    'new_status', review.new_status
  ),
  review.created_at
from public.article_reviews review;

create function public.check_comment_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_article_id uuid;
  parent_status public.comment_status;
begin
  if new.parent_id is null then
    return new;
  end if;
  select parent.article_id, parent.status
    into parent_article_id, parent_status
  from public.comments parent
  where parent.id = new.parent_id;
  if not found or parent_article_id is distinct from new.article_id or parent_status <> 'published' then
    raise exception using errcode = '22023', message = 'Reply must reference a visible comment on the same article';
  end if;
  return new;
end;
$$;

create trigger comments_check_parent
before insert or update of parent_id, article_id on public.comments
for each row execute function public.check_comment_parent();

create function public.save_ai_conversation(
  target_conversation_id uuid,
  conversation_title text,
  message_values jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  saved_conversation_id uuid;
begin
  if actor_id is null or not public.current_user_is_active() then
    raise exception using errcode = '42501', message = 'Active account required';
  end if;
  if char_length(btrim(conversation_title)) not between 1 and 120
    or jsonb_typeof(message_values) <> 'array'
    or jsonb_array_length(message_values) not between 1 and 100
    or exists (
      select 1 from jsonb_array_elements(message_values) as item(value)
      where coalesce(item.value ->> 'role', '') not in ('user', 'assistant')
        or char_length(btrim(coalesce(item.value ->> 'content', ''))) not between 1 and 30000
        or char_length(coalesce(item.value ->> 'task', '')) > 40
    )
    or (
      select coalesce(sum(char_length(item.value ->> 'content')), 0)
      from jsonb_array_elements(message_values) as item(value)
    ) > 100000 then
    raise exception using errcode = '22023', message = 'Conversation data is invalid or too large';
  end if;

  if target_conversation_id is null then
    if (
      select count(*) from public.ai_conversations conversation
      where conversation.user_id = actor_id
    ) >= 100 then
      raise exception using errcode = '22023', message = 'Conversation history limit reached';
    end if;
    insert into public.ai_conversations (user_id, title)
    values (actor_id, btrim(conversation_title))
    returning id into saved_conversation_id;
  else
    update public.ai_conversations
    set title = btrim(conversation_title)
    where id = target_conversation_id and user_id = actor_id
    returning id into saved_conversation_id;
    if saved_conversation_id is null then
      raise exception using errcode = 'P0002', message = 'Conversation not found';
    end if;
    delete from public.ai_messages message
    where message.conversation_id = saved_conversation_id;
  end if;

  insert into public.ai_messages (conversation_id, role, content, task, created_at)
  select saved_conversation_id,
    item.value ->> 'role',
    btrim(item.value ->> 'content'),
    nullif(item.value ->> 'task', ''),
    coalesce(nullif(item.value ->> 'createdAt', '')::timestamptz, now())
  from jsonb_array_elements(message_values) as item(value);

  return saved_conversation_id;
end;
$$;

create function public.save_article_translation(
  target_article_id uuid,
  target_language public.article_translation_language,
  target_style public.article_translation_style,
  translation_document jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  translation_id uuid;
begin
  if jsonb_typeof(translation_document) <> 'object'
    or octet_length(translation_document::text) > 600000
    or not exists (
      select 1 from public.articles article
      where article.id = target_article_id and article.status = 'published'
    ) then
    raise exception using errcode = '22023', message = 'Translation or published article is invalid';
  end if;
  insert into public.article_translations (
    article_id, language, style, translated_content
  )
  values (target_article_id, target_language, target_style, translation_document)
  on conflict (article_id, language, style)
  do update set translated_content = excluded.translated_content,
    updated_at = now()
  returning id into translation_id;
  return translation_id;
end;
$$;

revoke all on function public.assign_article_revision_number() from public, anon, authenticated;
revoke all on function public.record_article_event_in_audit_log() from public, anon, authenticated;
revoke all on function public.record_article_review_in_audit_log() from public, anon, authenticated;
revoke all on function public.check_comment_parent() from public, anon, authenticated;
revoke all on function public.save_ai_conversation(uuid, text, jsonb) from public, anon;
revoke all on function public.save_article_translation(uuid, public.article_translation_language, public.article_translation_style, jsonb) from public, anon, authenticated;
grant execute on function public.save_ai_conversation(uuid, text, jsonb) to authenticated;
grant execute on function public.save_article_translation(uuid, public.article_translation_language, public.article_translation_style, jsonb) to service_role;
