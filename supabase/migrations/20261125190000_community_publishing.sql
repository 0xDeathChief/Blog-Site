-- CipherBrief community upgrade; apply to existing database, not a reset.
BEGIN;
CREATE OR REPLACE FUNCTION public.create_profile_for_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE chosen text; display text;
BEGIN
  chosen := lower(btrim(coalesce(new.raw_user_meta_data->>'username','')));
  IF chosen !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR char_length(chosen) NOT BETWEEN 3 AND 40 THEN
    chosen := 'member-' || replace(new.id::text,'-','');
  END IF;
  display := left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'),''), chosen),80);
  INSERT INTO public.profiles(id,full_name,username,role) VALUES(new.id,display,chosen,'contributor');
  RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.create_profile_for_auth_user() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.current_user_is_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
SELECT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id
 WHERE p.id=auth.uid() AND p.status='active' AND u.email_confirmed_at IS NOT NULL);
$$;
CREATE OR REPLACE FUNCTION public.current_user_has_role(allowed_roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
SELECT public.current_user_is_active() AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role=ANY(allowed_roles));
$$;
DROP POLICY IF EXISTS comments_add_reader ON public.comments;
create policy comments_add_reader on public.comments
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'published'
  and public.current_user_has_role(array['reader','contributor','editor','owner']::public.app_role[])
  and exists (
    select 1 from public.articles article
    where article.id = article_id and article.status = 'published'
  )
);
DROP POLICY IF EXISTS bookmarks_manage_own_reader ON public.bookmarks;
create policy bookmarks_manage_own_reader on public.bookmarks
for all to authenticated
using (
  user_id = (select auth.uid())
  and public.current_user_has_role(array['reader','contributor','editor','owner']::public.app_role[])
)
with check (
  user_id = (select auth.uid())
  and public.current_user_has_role(array['reader','contributor','editor','owner']::public.app_role[])
  and exists (
    select 1 from public.articles article
    where article.id = article_id and article.status = 'published'
  )
);
DROP POLICY IF EXISTS likes_add_reader ON public.likes;
create policy likes_add_reader on public.likes
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.current_user_has_role(array['reader','contributor','editor','owner']::public.app_role[])
  and exists (
    select 1 from public.articles article
    where article.id = article_id and article.status = 'published'
  )
);
DROP POLICY IF EXISTS likes_remove_own ON public.likes;
create policy likes_remove_own on public.likes
for delete to authenticated
using (
  user_id = (select auth.uid())
  and public.current_user_has_role(array['reader','contributor','editor','owner']::public.app_role[])
);

-- Private bucket; only the server upload endpoint may write new objects.
UPDATE storage.buckets SET public=false WHERE id='article-covers';
DROP POLICY IF EXISTS article_covers_upload ON storage.objects;
DROP POLICY IF EXISTS article_covers_update ON storage.objects;
DROP POLICY IF EXISTS article_covers_delete ON storage.objects;
create or replace function public.is_safe_article_document(article_document jsonb)
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
          and coalesce(node -> 'attrs' ->> 'src', '') !~ '^/api/article-media/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|avif)$'
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
-- Enforce combined cover + inline image limit even for direct RPC calls.
CREATE OR REPLACE FUNCTION public.cb_validate_article_media() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE src text; path text; image_count integer;
BEGIN
  SELECT count(*) INTO image_count FROM jsonb_path_query(NEW.content, 'strict $.** ? (@.type == "image")', '{}'::jsonb, true) AS n;
  IF image_count + CASE WHEN NEW.cover_image IS NULL THEN 0 ELSE 1 END > 5 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Maximum five images including cover';
  END IF;
  FOR src IN SELECT n->'attrs'->>'src' FROM jsonb_path_query(NEW.content, 'strict $.** ? (@.type == "image")', '{}'::jsonb, true) AS n
  LOOP
    IF src IS NULL OR src !~ '^/api/article-media/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|avif)$' THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Upload images through CipherBrief';
    END IF;
    path := substr(src,length('/api/article-media/')+1);
    IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id='article-covers' AND o.name=path) THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Image is unavailable';
    END IF;
    IF split_part(path,'/',1) <> NEW.author_id::text AND split_part(path,'/',1) <> coalesce(auth.uid()::text,'') THEN
      IF TG_OP='UPDATE' THEN
        IF jsonb_path_exists(OLD.content,'strict $.** ? (@.type == "image" && @.attrs.src == $src)',jsonb_build_object('src',src),true) THEN CONTINUE; END IF;
      END IF;
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Image is unavailable';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.cb_validate_article_media() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS cb_validate_article_media ON public.articles;
CREATE TRIGGER cb_validate_article_media BEFORE INSERT OR UPDATE OF content,cover_image ON public.articles FOR EACH ROW EXECUTE FUNCTION public.cb_validate_article_media();
-- Use RLS to decide whether a requested image belongs to a visible article.
CREATE OR REPLACE FUNCTION public.cb_media_visible(p_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
SELECT p_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|avif)$' AND (
 (public.current_user_is_active() AND split_part(p_path,'/',1)=auth.uid()::text)
 OR EXISTS(SELECT 1 FROM public.articles a WHERE a.cover_image=p_path OR jsonb_path_exists(a.content,'strict $.** ? (@.type == "image" && @.attrs.src == $src)',jsonb_build_object('src','/api/article-media/'||p_path),true))
);
$$;
REVOKE ALL ON FUNCTION public.cb_media_visible(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cb_media_visible(text) TO anon,authenticated;
INSERT INTO public.categories(name,slug) VALUES ('Web Security','web-security'),('Networking','networking'),('Security Research','security-research'),('General','general') ON CONFLICT DO NOTHING;
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

  if requested_action = 'approve_publish' then
    if actor_role <> 'owner' or old_status <> 'in_review' then
      raise exception using errcode = '42501', message = 'Owner review required';
    end if;
    perform public.transition_article(target_article_id, 'approve', coalesce(nullif(btrim(feedback_message),''),'Approved for publication'));
    perform public.transition_article(target_article_id, 'publish', null);
    return;
  elsif requested_action = 'submit' then
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
COMMIT;
