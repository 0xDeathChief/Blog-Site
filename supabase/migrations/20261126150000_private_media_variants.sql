-- Media pipeline V2: additive only. No article, user, auth or original media mutation.
-- Run with an authorized Supabase migration role, in the intended project.
BEGIN;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('madquill-media-variants', 'madquill-media-variants', false, 2097152, ARRAY['image/webp','image/avif'])
ON CONFLICT (id) DO NOTHING;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='madquill-media-variants' AND public=false
      AND file_size_limit=2097152 AND allowed_mime_types @> ARRAY['image/webp','image/avif']) THEN
    RAISE EXCEPTION 'Unexpected media variants bucket configuration. No changes applied.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='article-covers' AND public=false) THEN
    RAISE EXCEPTION 'Original article-covers bucket must already exist and be private. No changes applied.';
  END IF;
END $$;
-- Restrictive policy blocks direct client reads/writes even if a broad permissive
-- storage policy is added elsewhere. Server-side service credentials bypass RLS.
DROP POLICY IF EXISTS mq_variants_server_only ON storage.objects;
CREATE POLICY mq_variants_server_only ON storage.objects AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (bucket_id <> 'madquill-media-variants')
  WITH CHECK (bucket_id <> 'madquill-media-variants');
-- Strict public predicate for CDN eligibility, including an explicit published
-- status check. It grants no new access to articles (SECURITY INVOKER).
CREATE OR REPLACE FUNCTION public.mq_media_published(p_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
SELECT p_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|avif)$'
 AND EXISTS (SELECT 1 FROM public.articles a WHERE a.status = 'published'
   AND (a.cover_image = p_path OR jsonb_path_exists(a.content,
        'strict $.** ? (@.type == "image" && @.attrs.src == $src)',
        jsonb_build_object('src','/api/article-media/'||p_path),true)));
$$;
REVOKE ALL ON FUNCTION public.mq_media_published(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mq_media_published(text) TO anon,authenticated;
COMMIT;
