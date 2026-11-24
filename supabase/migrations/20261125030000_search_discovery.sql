alter table public.articles
  add column search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(excerpt, '')), 'B')
    || setweight(jsonb_to_tsvector('english', coalesce(content, '{}'::jsonb), '["string"]'::jsonb), 'C')
    || setweight(
      to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(excerpt, '')),
      'D'
    )
    || setweight(
      jsonb_to_tsvector('simple', coalesce(content, '{}'::jsonb), '["string"]'::jsonb),
      'D'
    )
  ) stored;

create index articles_published_search_vector_idx
  on public.articles using gin (search_vector)
  where status = 'published';

create index articles_public_category_difficulty_idx
  on public.articles (category_id, difficulty, published_at desc)
  where status = 'published';

create index articles_public_author_idx
  on public.articles (author_id, published_at desc)
  where status = 'published';

create index article_tags_tag_article_idx
  on public.article_tags (tag_id, article_id);

create index likes_article_idx
  on public.likes (article_id);

create function public.search_published_articles(
  search_text text default '',
  category_filter text default null,
  tag_filter text default null,
  difficulty_filter public.article_difficulty default null,
  author_filter uuid default null,
  sort_order text default 'newest',
  page_number integer default 1,
  page_size integer default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_query text := btrim(coalesce(search_text, ''));
  english_query tsquery;
  simple_query tsquery;
  total_results bigint;
  result_articles jsonb;
begin
  if char_length(normalized_query) > 100
    or (category_filter is not null and (
      char_length(category_filter) > 160
      or category_filter !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    ))
    or (tag_filter is not null and (
      char_length(tag_filter) > 160
      or tag_filter !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    ))
    or sort_order is null
    or sort_order not in ('newest', 'popularity')
    or page_number is null
    or page_number not between 1 and 10000
    or page_size is null
    or page_size not between 1 and 50 then
    raise exception using errcode = '22023', message = 'Invalid article discovery parameters';
  end if;

  if normalized_query = '' then
    english_query := ''::tsquery;
    simple_query := ''::tsquery;
  else
    english_query := websearch_to_tsquery('english', normalized_query);
    simple_query := websearch_to_tsquery('simple', normalized_query);
  end if;

  with matching_articles as materialized (
    select
      article.id,
      article.author_id,
      article.title,
      article.slug,
      article.excerpt,
      article.published_at,
      article.reading_time,
      article.cover_image,
      article.difficulty,
      category.name as category_name,
      category.slug as category_slug,
      coalesce(popularity.like_count, 0)::bigint as like_count
    from public.articles article
    left join public.categories category on category.id = article.category_id
    left join public.article_like_counts popularity on popularity.article_id = article.id
    where article.status = 'published'
      and (category_filter is null or (category.is_active and category.slug = category_filter))
      and (difficulty_filter is null or article.difficulty = difficulty_filter)
      and (author_filter is null or article.author_id = author_filter)
      and (
        tag_filter is null
        or exists (
          select 1
          from public.article_tags relation
          join public.tags tag on tag.id = relation.tag_id
          where relation.article_id = article.id and tag.slug = tag_filter
        )
      )
      and (
        normalized_query = ''
        or article.search_vector @@ english_query
        or article.search_vector @@ simple_query
        or exists (
          select 1
          from public.categories search_category
          where search_category.id = article.category_id
            and (
              to_tsvector('english', search_category.name) @@ english_query
              or to_tsvector('simple', search_category.name) @@ simple_query
            )
        )
        or exists (
          select 1
          from public.article_tags search_relation
          join public.tags search_tag on search_tag.id = search_relation.tag_id
          where search_relation.article_id = article.id
            and (
              to_tsvector('english', search_tag.name) @@ english_query
              or to_tsvector('simple', search_tag.name) @@ simple_query
            )
        )
      )
  ),
  matching_total as (
    select count(*)::bigint as total from matching_articles
  ),
  page_articles as (
    select
      matching_articles.*,
      row_number() over (
        order by
          case when sort_order = 'newest' then published_at end desc nulls last,
          case when sort_order = 'popularity' then like_count end desc nulls last,
          published_at desc,
          id desc
      ) as position
    from matching_articles
    order by
      case when sort_order = 'newest' then published_at end desc nulls last,
      case when sort_order = 'popularity' then like_count end desc nulls last,
      published_at desc,
      id desc
    limit page_size
    offset (page_number - 1) * page_size
  )
  select
    matching_total.total,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', page_articles.id,
          'author_id', page_articles.author_id,
          'title', page_articles.title,
          'slug', page_articles.slug,
          'summary', page_articles.excerpt,
          'published_at', page_articles.published_at,
          'reading_time_minutes', page_articles.reading_time,
          'cover_image_path', page_articles.cover_image,
          'difficulty', page_articles.difficulty,
          'category', page_articles.category_name,
          'category_slug', page_articles.category_slug,
          'like_count', page_articles.like_count
        )
        order by page_articles.position
      ) filter (where page_articles.id is not null),
      '[]'::jsonb
    )
  into total_results, result_articles
  from matching_total
  left join page_articles on true
  group by matching_total.total;

  return jsonb_build_object(
    'total', total_results,
    'page', page_number,
    'page_size', page_size,
    'articles', result_articles
  );
end;
$$;

revoke all on function public.search_published_articles(
  text, text, text, public.article_difficulty, uuid, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.search_published_articles(
  text, text, text, public.article_difficulty, uuid, text, integer, integer
) to anon, authenticated;
