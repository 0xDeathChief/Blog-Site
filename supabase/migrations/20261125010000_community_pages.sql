create table public.article_reading_history (
  user_id uuid not null references auth.users (id) on delete cascade,
  article_id uuid not null references public.articles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

create index article_reading_history_user_idx
  on public.article_reading_history (user_id, last_read_at desc);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  message_count integer not null default 0 check (message_count between 0 and 100),
  messages jsonb not null default '[]'::jsonb
    check (
      case
        when jsonb_typeof(messages) = 'array' then jsonb_array_length(messages) <= 100
        else false
      end
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_conversations_user_idx
  on public.ai_conversations (user_id, updated_at desc);

create trigger ai_conversations_set_updated_at
before update on public.ai_conversations
for each row execute function public.set_updated_at();

alter table public.article_reading_history enable row level security;
alter table public.ai_conversations enable row level security;

create policy reading_history_read_own on public.article_reading_history
for select to authenticated
using (user_id = (select auth.uid()) and public.current_user_is_active());

create policy reading_history_add_own on public.article_reading_history
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.current_user_is_active()
  and exists (
    select 1 from public.articles a
    where a.id = article_id and a.status = 'published'
  )
);

create policy reading_history_update_own on public.article_reading_history
for update to authenticated
using (user_id = (select auth.uid()) and public.current_user_is_active())
with check (
  user_id = (select auth.uid())
  and public.current_user_is_active()
  and exists (
    select 1 from public.articles a
    where a.id = article_id and a.status = 'published'
  )
);

create policy ai_conversations_manage_own on public.ai_conversations
for all to authenticated
using (user_id = (select auth.uid()) and public.current_user_is_active())
with check (user_id = (select auth.uid()) and public.current_user_is_active());

revoke all on public.article_reading_history, public.ai_conversations
  from anon, authenticated, service_role;
grant select, insert, update on public.article_reading_history to authenticated;
grant select, insert, update, delete on public.ai_conversations to authenticated;

create function public.get_public_authors(target_author_id uuid default null)
returns table(author_id uuid, display_name text, avatar_url text, article_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.avatar_url, count(a.id)::bigint
  from public.profiles p
  join public.articles a on a.author_id = p.id and a.status = 'published'
  where p.status = 'active'
    and (target_author_id is null or p.id = target_author_id)
  group by p.id, p.display_name, p.avatar_url
  order by count(a.id) desc, p.display_name
  limit 500;
$$;

revoke all on function public.get_public_authors(uuid) from public;
grant execute on function public.get_public_authors(uuid) to anon, authenticated;

create function public.get_public_contact_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select setting_value #>> '{}'
  from public.site_settings
  where setting_key = 'contact_email'
    and jsonb_typeof(setting_value) = 'string'
  limit 1;
$$;

revoke all on function public.get_public_contact_email() from public;
grant execute on function public.get_public_contact_email() to anon, authenticated;

create function public.get_public_site_metadata()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_object_agg(setting_key, setting_value #>> '{}'),
    '{}'::jsonb
  )
  from public.site_settings
  where setting_key in ('site_title', 'site_description')
    and jsonb_typeof(setting_value) = 'string';
$$;

revoke all on function public.get_public_site_metadata() from public;
grant execute on function public.get_public_site_metadata() to anon, authenticated;

create function public.get_ai_runtime_settings()
returns table(model_name text, enabled boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select settings.model_name, settings.enabled
  from public.ai_settings settings
  where settings.id = 1
  limit 1;
$$;

revoke all on function public.get_ai_runtime_settings() from public, anon, authenticated;
grant execute on function public.get_ai_runtime_settings() to service_role;
