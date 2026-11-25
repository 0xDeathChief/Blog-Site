-- CipherBrief 04: discovery, engagement, guest moderation, media limits.
-- Apply only to the existing Community + Workspace database. No data reset.
BEGIN;

-- New public comment identity fields (no email or guest token exposed).
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT 'Member';
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT false;
UPDATE public.comments c SET display_name=left(p.full_name,80)
FROM public.profiles p WHERE c.user_id=p.id AND c.display_name='Member' AND NOT c.is_guest;

-- Private, bounded engagement data. Public access is through aggregate views only.
CREATE TABLE IF NOT EXISTS public.cb_guest_reactions (
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  guest_hash text NOT NULL CHECK (guest_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id,guest_hash)
);
CREATE TABLE IF NOT EXISTS public.cb_article_views (
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  visitor_hash text NOT NULL CHECK (visitor_hash ~ '^[a-f0-9]{64}$'),
  view_day date NOT NULL DEFAULT (timezone('UTC',now())::date),
  PRIMARY KEY (article_id,visitor_hash,view_day)
);
ALTER TABLE public.cb_guest_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cb_article_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cb_guest_reactions, public.cb_article_views FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,DELETE ON public.cb_guest_reactions TO service_role;
CREATE INDEX IF NOT EXISTS cb_article_views_day_idx ON public.cb_article_views(view_day);
CREATE INDEX IF NOT EXISTS cb_guest_reactions_created_idx ON public.cb_guest_reactions(created_at);

-- Guest comment submissions: server-only, only for already published articles.
CREATE OR REPLACE FUNCTION public.cb_guest_comment(p_article_id uuid,p_display_name text,p_content text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF char_length(btrim(coalesce(p_display_name,''))) NOT BETWEEN 3 AND 32
     OR p_display_name ~ '[[:cntrl:]]' OR char_length(btrim(coalesce(p_content,''))) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid comment';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.articles a WHERE a.id=p_article_id AND a.status='published') THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Article unavailable';
  END IF;
  INSERT INTO public.comments(article_id,user_id,content,status,display_name,is_guest)
    VALUES(p_article_id,NULL,btrim(p_content),'pending',btrim(p_display_name),true);
END $$;
REVOKE ALL ON FUNCTION public.cb_guest_comment(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.cb_guest_comment(uuid,text,text) TO service_role;

-- Prevent client-provided identity and spam via direct authenticated table writes.
CREATE OR REPLACE FUNCTION public.cb_comment_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.user_id IS DISTINCT FROM auth.uid() OR NOT public.current_user_is_active() THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Active account required';
    END IF;
    IF NOT public.consume_rate_limit('comment:'||auth.uid()::text,12,3600) THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Comment limit reached';
    END IF;
    SELECT left(p.full_name,80) INTO NEW.display_name FROM public.profiles p WHERE p.id=auth.uid();
    NEW.is_guest := false;
  ELSIF NEW.user_id IS NULL AND NEW.is_guest THEN
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.cb_comment_identity() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS cb_comment_identity ON public.comments;
CREATE TRIGGER cb_comment_identity BEFORE INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.cb_comment_identity();

-- Owners must see pending and hidden comments to moderate them.
DROP POLICY IF EXISTS cb_comments_owner_read ON public.comments;
CREATE POLICY cb_comments_owner_read ON public.comments FOR SELECT TO authenticated
USING(public.current_user_has_role(ARRAY['owner']::public.app_role[]));

-- A single atomic moderation operation with audit trail.
CREATE OR REPLACE FUNCTION public.cb_moderate_comment(p_comment_id bigint,p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target_article uuid;
BEGIN
 IF NOT public.current_user_has_role(ARRAY['owner']::public.app_role[]) THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner role required';
 END IF;
 IF p_action IS NULL OR p_action NOT IN ('approve','hide','delete') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid action'; END IF;
 SELECT article_id INTO target_article FROM public.comments WHERE id=p_comment_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Comment unavailable'; END IF;
 IF p_action='delete' THEN DELETE FROM public.comments WHERE id=p_comment_id;
 ELSE UPDATE public.comments SET status=CASE WHEN p_action='approve' THEN 'published'::public.comment_status ELSE 'hidden'::public.comment_status END WHERE id=p_comment_id;
 END IF;
 PERFORM public.log_owner_action('comment_'||p_action,NULL,jsonb_build_object('comment_id',p_comment_id,'article_id',target_article));
END $$;
REVOKE ALL ON FUNCTION public.cb_moderate_comment(bigint,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.cb_moderate_comment(bigint,text) TO authenticated;
-- Use the checked RPC for moderation. Keep author/owner delete policy in place for legacy UI.
REVOKE UPDATE(status) ON public.comments FROM authenticated;

-- One counted view per browser identity / article / UTC day. No IP addresses stored.
CREATE OR REPLACE FUNCTION public.cb_record_article_view(p_article_id uuid,p_visitor_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_visitor_hash IS NULL OR p_visitor_hash !~ '^[a-f0-9]{64}$' THEN RETURN; END IF;
 INSERT INTO public.cb_article_views(article_id,visitor_hash)
 SELECT a.id,p_visitor_hash FROM public.articles a WHERE a.id=p_article_id AND a.status='published'
 ON CONFLICT DO NOTHING;
 -- Prune expired view deduplication rows opportunistically, on a small fraction of view requests.
 IF random()<0.01 THEN DELETE FROM public.cb_article_views WHERE view_day < timezone('UTC',now())::date-30; END IF;
END $$;
REVOKE ALL ON FUNCTION public.cb_record_article_view(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.cb_record_article_view(uuid,text) TO service_role;

-- Public aggregate only: no user identity, no draft articles.
CREATE OR REPLACE VIEW public.cb_article_engagement AS
WITH v AS (SELECT article_id,count(*)::bigint AS n FROM public.cb_article_views WHERE view_day >= timezone('UTC',now())::date-29 GROUP BY article_id),
 c AS (SELECT article_id,count(*)::bigint AS n,count(*) FILTER(WHERE created_at>=now()-interval '30 days')::bigint AS recent FROM public.comments WHERE status='published' GROUP BY article_id),
 l AS (SELECT article_id,count(*)::bigint AS n,count(*) FILTER(WHERE created_at>=now()-interval '30 days')::bigint AS recent FROM public.likes GROUP BY article_id),
 g AS (SELECT article_id,count(*)::bigint AS n,count(*) FILTER(WHERE created_at>=now()-interval '30 days')::bigint AS recent FROM public.cb_guest_reactions GROUP BY article_id)
SELECT a.id AS article_id,coalesce(v.n,0)::bigint AS view_count,coalesce(c.n,0)::bigint AS comment_count,
 (coalesce(l.n,0)+coalesce(g.n,0))::bigint AS like_count,
 (coalesce(v.n,0)+4*coalesce(c.recent,0)+2*(coalesce(l.recent,0)+coalesce(g.recent,0)))::bigint AS score
FROM public.articles a LEFT JOIN v ON v.article_id=a.id LEFT JOIN c ON c.article_id=a.id
LEFT JOIN l ON l.article_id=a.id LEFT JOIN g ON g.article_id=a.id WHERE a.status='published';
REVOKE ALL ON public.cb_article_engagement FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.cb_article_engagement TO anon,authenticated,service_role;

-- Search uses existing indexed full-text vector + substring + fuzzy titles/tags.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
DO $setup$
DECLARE ext_schema text;
BEGIN
 SELECT n.nspname INTO ext_schema FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pg_trgm';
 EXECUTE format('CREATE OR REPLACE FUNCTION public.cb_word_similarity(text,text) RETURNS real LANGUAGE sql IMMUTABLE STRICT SET search_path='''' AS %L',format('SELECT %I.word_similarity($1,$2)',ext_schema));
END $setup$;
REVOKE ALL ON FUNCTION public.cb_word_similarity(text,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.search_published_articles(
 search_text text default '',category_filter text default null,tag_filter text default null,
 difficulty_filter public.article_difficulty default null,author_filter uuid default null,
 sort_order text default 'newest',page_number integer default 1,page_size integer default 12
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE q text:=lower(btrim(coalesce(search_text,''))); en tsquery; simpleq tsquery; out_json jsonb;
BEGIN
 IF char_length(q)>100 OR (category_filter IS NOT NULL AND (char_length(category_filter)>160 OR category_filter !~ '^[a-z0-9]+(-[a-z0-9]+)*$'))
 OR (tag_filter IS NOT NULL AND (char_length(tag_filter)>160 OR tag_filter !~ '^[a-z0-9]+(-[a-z0-9]+)*$'))
 OR sort_order IS NULL OR sort_order NOT IN ('newest','popularity','relevance') OR page_number IS NULL OR page_number NOT BETWEEN 1 AND 10000 OR page_size IS NULL OR page_size NOT BETWEEN 1 AND 50 THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid discovery parameters';
 END IF;
 en:=websearch_to_tsquery('english',q); simpleq:=websearch_to_tsquery('simple',q);
 WITH candidates AS (
   SELECT a.id,a.author_id,a.title,a.slug,a.excerpt AS summary,a.published_at,a.reading_time AS reading_time_minutes,a.cover_image AS cover_image_path,
     a.difficulty,c.name AS category,c.slug AS category_slug,coalesce(p.full_name,'Former member') AS author_name,
     coalesce(e.like_count,0) AS like_count,coalesce(e.comment_count,0) AS comment_count,coalesce(e.view_count,0) AS view_count,coalesce(e.score,0) AS score,
     CASE WHEN q='' THEN 0.0 ELSE
       (CASE WHEN lower(a.title)=q THEN 20 ELSE 0 END)
       +(CASE WHEN strpos(lower(a.title),q)>0 THEN 10 ELSE 0 END)
       +(CASE WHEN strpos(lower(coalesce(a.excerpt,'')),q)>0 THEN 5 ELSE 0 END)
       +(CASE WHEN strpos(lower(coalesce(c.name,'')||' '||coalesce(t.names,'')),q)>0 THEN 7 ELSE 0 END)
       +(CASE WHEN strpos(lower(a.content::text),q)>0 THEN 2 ELSE 0 END)
       +5*ts_rank_cd(a.search_vector,en)+3*ts_rank_cd(a.search_vector,simpleq)
       +(CASE WHEN to_tsvector('english',coalesce(c.name,'')||' '||coalesce(t.names,'')) @@ en THEN 5 ELSE 0 END)
       +(CASE WHEN char_length(q)>=3 AND public.cb_word_similarity(q,lower(a.title||' '||coalesce(c.name,'')||' '||coalesce(t.names,'')))>=0.52 THEN 3*public.cb_word_similarity(q,lower(a.title||' '||coalesce(c.name,'')||' '||coalesce(t.names,''))) ELSE 0 END)
     END AS relevance
   FROM public.articles a LEFT JOIN public.categories c ON c.id=a.category_id
   LEFT JOIN public.profiles p ON p.id=a.author_id
   LEFT JOIN public.cb_article_engagement e ON e.article_id=a.id
   LEFT JOIN LATERAL (SELECT string_agg(tag.name,' ') AS names FROM public.article_tags atg JOIN public.tags tag ON tag.id=atg.tag_id WHERE atg.article_id=a.id) t ON true
   WHERE a.status='published' AND (category_filter IS NULL OR (c.is_active AND c.slug=category_filter))
     AND (difficulty_filter IS NULL OR a.difficulty=difficulty_filter) AND (author_filter IS NULL OR a.author_id=author_filter)
     AND (tag_filter IS NULL OR EXISTS(SELECT 1 FROM public.article_tags atg JOIN public.tags tag ON tag.id=atg.tag_id WHERE atg.article_id=a.id AND tag.slug=tag_filter))
 ), matches AS MATERIALIZED(SELECT * FROM candidates WHERE q='' OR relevance>0),
 page AS (SELECT m.*,row_number() OVER(ORDER BY CASE WHEN sort_order='relevance' THEN relevance END DESC NULLS LAST,CASE WHEN sort_order='popularity' THEN score END DESC NULLS LAST,published_at DESC,id DESC) AS pos
 FROM matches m ORDER BY pos LIMIT page_size OFFSET (page_number-1)*page_size)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM matches),'page',page_number,'page_size',page_size,'articles',coalesce((SELECT jsonb_agg(to_jsonb(page)-'pos'-'relevance' ORDER BY pos) FROM page),'[]'::jsonb)) INTO out_json;
 RETURN out_json;
END $$;
REVOKE ALL ON FUNCTION public.search_published_articles(text,text,text,public.article_difficulty,uuid,text,integer,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.search_published_articles(text,text,text,public.article_difficulty,uuid,text,integer,integer) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.cb_validate_article_media() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE src text; path text; image_count integer;
BEGIN
  SELECT count(*) INTO image_count FROM jsonb_path_query(NEW.content, 'strict $.** ? (@.type == "image")', '{}'::jsonb, true) AS n;
  IF (image_count + (CASE WHEN NEW.cover_image IS NULL THEN 0 ELSE 1 END)) > 3 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Maximum three images including cover';
  END IF;
  IF NEW.cover_image IS NOT NULL THEN
    IF NEW.cover_image !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|avif)$'
       OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='article-covers' AND o.name=NEW.cover_image) THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Cover image unavailable';
    END IF;
    IF split_part(NEW.cover_image,'/',1)<>NEW.author_id::text AND split_part(NEW.cover_image,'/',1)<>coalesce(auth.uid()::text,'') THEN
      IF TG_OP='INSERT' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cover image unavailable';
      ELSIF NEW.cover_image IS DISTINCT FROM OLD.cover_image THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cover image unavailable'; END IF;
    END IF;
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

CREATE OR REPLACE FUNCTION public.cb_validate_publish_limit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 IF NEW.status='published' AND OLD.status IS DISTINCT FROM NEW.status THEN
   SELECT count(*) INTO n FROM jsonb_path_query(NEW.content,'strict $.** ? (@.type == "image")','{}'::jsonb,true);
   IF n+(CASE WHEN NEW.cover_image IS NULL THEN 0 ELSE 1 END)>3 THEN
     RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Reduce this article to three images before publication';
   END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.cb_validate_publish_limit() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS cb_validate_publish_limit ON public.articles;
CREATE TRIGGER cb_validate_publish_limit BEFORE UPDATE OF status ON public.articles FOR EACH ROW EXECUTE FUNCTION public.cb_validate_publish_limit();

CREATE OR REPLACE FUNCTION public.cb_guest_react(p_article_id uuid,p_guest_hash text,p_liked boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_liked IS NULL OR p_guest_hash IS NULL OR p_guest_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid reaction'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.articles a WHERE a.id=p_article_id AND a.status='published') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Article unavailable'; END IF;
 IF p_liked THEN INSERT INTO public.cb_guest_reactions(article_id,guest_hash) VALUES(p_article_id,p_guest_hash) ON CONFLICT DO NOTHING;
 ELSE DELETE FROM public.cb_guest_reactions WHERE article_id=p_article_id AND guest_hash=p_guest_hash; END IF;
 RETURN p_liked;
END $$;
REVOKE ALL ON FUNCTION public.cb_guest_react(uuid,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.cb_guest_react(uuid,text,boolean) TO service_role;
REVOKE INSERT,DELETE ON public.cb_guest_reactions FROM service_role;

CREATE OR REPLACE FUNCTION public.cb_like_rate_limit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.consume_rate_limit('like:'||auth.uid()::text,60,600) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Reaction limit reached'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.cb_like_rate_limit() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS cb_like_rate_limit ON public.likes;
CREATE TRIGGER cb_like_rate_limit BEFORE INSERT ON public.likes FOR EACH ROW EXECUTE FUNCTION public.cb_like_rate_limit();

NOTIFY pgrst, 'reload schema';
COMMIT;
