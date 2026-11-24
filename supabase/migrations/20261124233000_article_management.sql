create type public.article_difficulty as enum (
  'beginner',
  'intermediate',
  'advanced',
  'expert'
);

alter table public.articles
  add constraint articles_slug_length_check check (char_length(slug) <= 160),
  add column difficulty public.article_difficulty not null default 'beginner',
  add column reading_time_minutes integer not null default 1
    check (reading_time_minutes between 1 and 1000);

alter table public.article_revisions
  add column difficulty public.article_difficulty not null default 'beginner',
  add column reading_time_minutes integer not null default 1
    check (reading_time_minutes between 1 and 1000),
  add column tags jsonb not null default '[]'::jsonb
    check (jsonb_typeof(tags) = 'array');

alter table public.article_events
  add column actor_name text not null default 'Former member';

alter table public.editorial_feedback
  add column reviewer_name text not null default 'Former member';

insert into public.categories (name, slug)
values
  ('Application Security', 'application-security'),
  ('Cloud Security', 'cloud-security'),
  ('Defensive Security', 'defensive-security'),
  ('Threat Intelligence', 'threat-intelligence'),
  ('Vulnerability Research', 'vulnerability-research')
on conflict do nothing;

insert into public.tags (name, slug)
values
  ('Beginner', 'beginner'),
  ('Blue Team', 'blue-team'),
  ('Cloud', 'cloud'),
  ('Incident Response', 'incident-response'),
  ('Linux', 'linux'),
  ('Networking', 'networking'),
  ('Web Security', 'web-security')
on conflict do nothing;

update public.articles
set category_id = (select id from public.categories where slug = 'defensive-security')
where category_id is null;

create function public.article_reading_time(article_content jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  with recursive content_nodes(node, depth) as (
    select article_content, 1
    union all
    select child.node, content_nodes.depth + 1
    from content_nodes
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(content_nodes.node -> 'content') = 'array'
          then content_nodes.node -> 'content'
        else '[]'::jsonb
      end
    ) as child(node)
    where content_nodes.depth < 31
  ),
  word_count as (
    select coalesce(
      sum(array_length(regexp_split_to_array(btrim(node ->> 'text'), '\s+'), 1)),
      0
    ) as words
    from content_nodes
    where jsonb_typeof(node) = 'object'
      and node ? 'text'
      and btrim(node ->> 'text') <> ''
  )
  select least(1000, greatest(1, ceil(words::numeric / 220)::integer))
  from word_count;
$$;

update public.articles
set reading_time_minutes = public.article_reading_time(content);
update public.article_revisions
set reading_time_minutes = public.article_reading_time(content);
update public.article_events event
set actor_name = profile.display_name
from public.profiles profile
where event.actor_id = profile.id;
update public.editorial_feedback feedback
set reviewer_name = profile.display_name
from public.profiles profile
where feedback.editor_id = profile.id;

create function public.is_safe_article_document(article_document jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  with recursive document_nodes(node, depth, parent_type) as (
    select article_document, 1, null::text
    union all
    select child.node, document_nodes.depth + 1, document_nodes.node ->> 'type'
    from document_nodes
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(document_nodes.node -> 'content') = 'array'
          then document_nodes.node -> 'content'
        else '[]'::jsonb
      end
    ) as child(node)
    where document_nodes.depth < 31
  )
  select coalesce(
    jsonb_typeof(article_document) = 'object'
    and article_document ->> 'type' = 'doc'
    and jsonb_typeof(article_document -> 'content') = 'array'
    and pg_column_size(article_document) <= 500000
    and not exists (
      select 1
      from document_nodes
      where depth > 30
        or jsonb_typeof(node) <> 'object'
        or coalesce(node ->> 'type', '') not in (
          'doc', 'paragraph', 'heading', 'text', 'bulletList', 'orderedList',
          'listItem', 'blockquote', 'codeBlock', 'horizontalRule', 'hardBreak',
          'image', 'table', 'tableRow', 'tableCell', 'tableHeader'
        )
        or (depth > 1 and node ->> 'type' = 'doc')
        or (node ? 'content' and jsonb_typeof(node -> 'content') <> 'array')
        or (
          node ->> 'type' in (
            'bulletList', 'orderedList', 'listItem', 'blockquote', 'table',
            'tableRow', 'tableCell', 'tableHeader'
          )
          and coalesce(
            case
              when jsonb_typeof(node -> 'content') = 'array'
                then jsonb_array_length(node -> 'content')
              else 0
            end,
            0
          ) = 0
        )
        or (
          parent_type = 'doc'
          and node ->> 'type' not in (
            'paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote',
            'codeBlock', 'horizontalRule', 'image', 'table'
          )
        )
        or (
          parent_type in ('paragraph', 'heading')
          and node ->> 'type' not in ('text', 'hardBreak')
        )
        or (
          parent_type in ('bulletList', 'orderedList')
          and node ->> 'type' <> 'listItem'
        )
        or (
          parent_type = 'listItem'
          and node ->> 'type' not in (
            'paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote',
            'codeBlock', 'horizontalRule', 'image', 'table'
          )
        )
        or (
          parent_type = 'blockquote'
          and node ->> 'type' not in (
            'paragraph', 'heading', 'bulletList', 'orderedList', 'codeBlock'
          )
        )
        or (parent_type = 'codeBlock' and node ->> 'type' <> 'text')
        or (parent_type = 'table' and node ->> 'type' <> 'tableRow')
        or (
          parent_type = 'tableRow'
          and node ->> 'type' not in ('tableCell', 'tableHeader')
        )
        or (
          parent_type in ('tableCell', 'tableHeader')
          and node ->> 'type' not in (
            'paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote',
            'codeBlock', 'horizontalRule', 'table'
          )
        )
        or parent_type in ('text', 'image', 'horizontalRule', 'hardBreak')
        or (node ? 'marks' and jsonb_typeof(node -> 'marks') <> 'array')
        or (
          node ->> 'type' = 'image'
          and coalesce(node -> 'attrs' ->> 'src', '') !~* '^https://'
        )
    )
    and not exists (
      select 1
      from document_nodes
      cross join lateral jsonb_array_elements(
        case
          when jsonb_typeof(node -> 'marks') = 'array' then node -> 'marks'
          else '[]'::jsonb
        end
      ) as mark(value)
      where coalesce(mark.value ->> 'type', '') not in ('bold', 'italic', 'strike', 'code', 'link')
        or (
          mark.value ->> 'type' = 'link'
          and coalesce(mark.value -> 'attrs' ->> 'href', '') !~* '^(https?://|mailto:)'
        )
    )
    and (
      select count(*) <= 5000
        and coalesce(sum(length(node ->> 'text')), 0) <= 500000
      from document_nodes
    ),
    false
  );
$$;

create function public.get_published_article_authors(article_ids uuid[])
returns table(article_id uuid, author_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, coalesce(p.display_name, 'Former member')
  from public.articles a
  left join public.profiles p on p.id = a.author_id
  where a.status = 'published'
    and a.id = any(coalesce(article_ids, '{}'::uuid[]))
  limit 200;
$$;

drop function public.save_article(uuid, text, text, text, jsonb, uuid, text);

create function public.save_article(
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
  actor_display_name text;
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
      where not exists (select 1 from public.tags t where t.id = requested_tag.tag_id)
    ) then
    raise exception using errcode = '22023', message = 'Article tags are invalid';
  end if;
  select coalesce(array_agg(requested_tag.tag_id order by requested_tag.tag_id), '{}'::uuid[])
  into requested_tags
  from unnest(requested_tags) as requested_tag(tag_id);
  if article_category_id is null or not exists (
    select 1 from public.categories c where c.id = article_category_id and c.is_active
  ) then
    raise exception using errcode = '22023', message = 'Category is unavailable';
  end if;

  select p.display_name into actor_display_name
  from public.profiles p
  where p.id = actor_id;
  calculated_reading_time := public.article_reading_time(article_content);

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
      author_id, category_id, title, slug, summary, content, cover_image_path,
      difficulty, reading_time_minutes
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
      jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug) order by t.name),
      '[]'::jsonb
    ) into tag_snapshot
    from public.article_tags at
    join public.tags t on t.id = at.tag_id
    where at.article_id = saved_article_id;

    insert into public.article_revisions (
      article_id, actor_id, title, slug, summary, content, category_id,
      cover_image_path, difficulty, reading_time_minutes, tags
    )
    values (
      saved_article_id, actor_id, btrim(article_title), article_slug,
      btrim(article_summary), article_content, article_category_id,
      article_cover_image_path, article_difficulty, calculated_reading_time, tag_snapshot
    );
    insert into public.article_events (article_id, actor_id, actor_name, action, to_status)
    values (saved_article_id, actor_id, actor_display_name, 'created', 'draft');
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

  select coalesce(
    jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug) order by t.name),
    '[]'::jsonb
  ), coalesce(array_agg(at.tag_id order by at.tag_id), '{}'::uuid[])
  into tag_snapshot, existing_tag_ids
  from public.article_tags at
  join public.tags t on t.id = at.tag_id
  where at.article_id = existing_article.id;

  if existing_article.category_id is distinct from article_category_id
    or existing_article.title is distinct from btrim(article_title)
    or existing_article.slug is distinct from article_slug
    or existing_article.summary is distinct from btrim(article_summary)
    or existing_article.content is distinct from article_content
    or existing_article.cover_image_path is distinct from article_cover_image_path
    or existing_article.difficulty is distinct from article_difficulty
    or existing_tag_ids is distinct from requested_tags then
    insert into public.article_revisions (
      article_id, actor_id, title, slug, summary, content, category_id,
      cover_image_path, difficulty, reading_time_minutes, tags
    )
    values (
      existing_article.id, actor_id, existing_article.title, existing_article.slug,
      existing_article.summary, existing_article.content, existing_article.category_id,
      existing_article.cover_image_path, existing_article.difficulty,
      existing_article.reading_time_minutes, tag_snapshot
    );

    update public.articles
    set category_id = article_category_id,
        title = btrim(article_title),
        slug = article_slug,
        summary = btrim(article_summary),
        content = article_content,
        cover_image_path = article_cover_image_path,
        difficulty = article_difficulty,
        reading_time_minutes = calculated_reading_time
    where id = target_article_id;

    if existing_tag_ids is distinct from requested_tags then
      delete from public.article_tags where article_id = target_article_id;
      insert into public.article_tags (article_id, tag_id)
      select target_article_id, requested_tag.tag_id
      from unnest(requested_tags) as requested_tag(tag_id);
    end if;

    insert into public.article_events (article_id, actor_id, actor_name, action, from_status, to_status)
    values (target_article_id, actor_id, actor_display_name, 'edited', existing_article.status, existing_article.status);
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
  actor_display_name text;
  article_author uuid;
  old_status public.article_status;
  next_status public.article_status;
  feedback_type public.feedback_kind;
begin
  if actor_id is null or not public.current_user_is_active() then
    raise exception using errcode = '42501', message = 'Active account required';
  end if;

  select p.role, p.display_name into actor_role, actor_display_name
  from public.profiles p where p.id = actor_id;
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
    if not exists (
      with recursive content_nodes(node) as (
        select a.content
        from public.articles a
        where a.id = target_article_id
        union all
        select child.node
        from content_nodes
        cross join lateral jsonb_array_elements(
          case
            when jsonb_typeof(content_nodes.node -> 'content') = 'array'
              then content_nodes.node -> 'content'
            else '[]'::jsonb
          end
        ) as child(node)
      )
      select 1
      from content_nodes
      where node ->> 'type' = 'text'
        and btrim(coalesce(node ->> 'text', '')) <> ''
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

  insert into public.article_events (
    article_id, actor_id, actor_name, action, from_status, to_status
  )
  values (
    target_article_id, actor_id, actor_display_name, requested_action, old_status, next_status
  );

  if feedback_type is not null and feedback_message is not null and btrim(feedback_message) <> '' then
    insert into public.editorial_feedback (
      article_id, editor_id, reviewer_name, kind, message
    )
    values (target_article_id, actor_id, actor_display_name, feedback_type, btrim(feedback_message));
  end if;
end;
$$;

revoke all on function public.article_reading_time(jsonb) from public, anon;
revoke all on function public.is_safe_article_document(jsonb) from public, anon, authenticated;
revoke all on function public.get_published_article_authors(uuid[]) from public, anon, authenticated;
revoke all on function public.save_article(
  uuid, text, text, text, jsonb, uuid, text, public.article_difficulty, uuid[]
) from public, anon, authenticated;
revoke all on function public.transition_article(uuid, text, text) from public, anon, authenticated;
grant execute on function public.save_article(
  uuid, text, text, text, jsonb, uuid, text, public.article_difficulty, uuid[]
) to authenticated;
grant execute on function public.transition_article(uuid, text, text) to authenticated;
grant execute on function public.get_published_article_authors(uuid[]) to anon, authenticated;

revoke insert, update, delete on public.article_tags from authenticated;
revoke insert on public.editorial_feedback from authenticated;
