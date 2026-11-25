begin;

-- No user/catalog seed records. This migration is additive and owns app_private.
create schema app_private;
revoke all on schema app_private from public, anon, authenticated;

create type public.entertainment_kind as enum ('anime','movie','series','cartoon','drama','documentary');
create type public.account_status as enum ('active','suspended','banned','deletion_pending','purging');
create type public.tracking_status as enum ('planned','watching','completed','on_hold','dropped');
create type public.collection_visibility as enum ('private','published');
create type public.review_status as enum ('pending','approved','rejected');
create type public.admin_role as enum ('super_admin','moderator','catalog_editor');
create type public.moderation_kind as enum ('dismissal','content_removal','warning','suspension','ban');
create type public.notification_kind as enum ('new_follower','collection_favorite','collection_published');
create type public.catalog_status as enum ('announced','airing','released','ended','unavailable','merged');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text check (username is null or username ~ '^[a-z][a-z0-9_]{2,29}$'),
  display_name text not null default 'SceneStack member' check (char_length(btrim(display_name)) between 1 and 80),
  avatar_path text check (avatar_path is null or char_length(avatar_path) <= 300),
  bio text not null default '' check (char_length(bio) <= 500),
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index profiles_username_ci on public.profiles(lower(username)) where username is not null;
create index profiles_active_name on public.profiles(display_name,id) where status='active';

create table public.onboarding (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  completed_at timestamptz, created_at timestamptz not null default now()
);
create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default true, new_followers boolean not null default true,
  collection_favorites boolean not null default true, followed_collections boolean not null default true,
  updated_at timestamptz not null default now()
);
create table public.recommendation_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default true, include_mature boolean not null default false,
  diversify boolean not null default true, updated_at timestamptz not null default now()
);
create table public.preferred_categories (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  category public.entertainment_kind not null, primary key(user_id,category)
);

create table public.metadata_providers (
  id uuid primary key default gen_random_uuid(), key text not null unique check(key ~ '^[a-z][a-z0-9_-]{1,39}$'),
  name text not null check(char_length(name) between 1 and 100),
  approved boolean not null default false, enabled boolean not null default false,
  attribution text, terms_url text, created_at timestamptz not null default now(),
  check(not enabled or approved)
);
create table public.titles (
  id uuid primary key default gen_random_uuid(),
  display_title text not null check(char_length(btrim(display_title)) between 1 and 300),
  original_title text check(char_length(original_title) <= 300),
  kind public.entertainment_kind not null,
  edition text not null default 'standalone' check(edition in ('standalone','series','season','special')),
  parent_title_id uuid references public.titles(id) on delete restrict,
  season_number integer check(season_number >= 0),
  release_year integer check(release_year between 1888 and 2200),
  description text not null default '' check(char_length(description) <= 20000),
  status public.catalog_status not null default 'announced',
  age_rating text check(char_length(age_rating) <= 40),
  search_document tsvector generated always as (to_tsvector('simple',coalesce(display_title,'') || ' ' || coalesce(original_title,'') || ' ' || coalesce(description,''))) stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(parent_title_id is null or parent_title_id <> id),
  check((edition='season' and parent_title_id is not null and season_number is not null) or edition <> 'season'),
  unique(parent_title_id,season_number)
);
create index titles_search on public.titles using gin(search_document);
create index titles_category_year on public.titles(kind,release_year,id);
create index titles_parent on public.titles(parent_title_id);
create table public.provider_title_ids (
  id uuid primary key default gen_random_uuid(), title_id uuid not null references public.titles(id) on delete restrict,
  provider_id uuid not null references public.metadata_providers(id) on delete restrict,
  external_id text not null check(char_length(external_id) between 1 and 160),
  external_type text not null check(char_length(external_type) between 1 and 50),
  unique(provider_id,external_type,external_id), unique(title_id,provider_id,external_type)
);
create index provider_title_ids_title on public.provider_title_ids(title_id);
create table public.languages (code text primary key check(code ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$'), name text not null);
create table public.countries (code text primary key check(code ~ '^[A-Z]{2}$'), name text not null);
create table public.title_names (
  id uuid primary key default gen_random_uuid(), title_id uuid not null references public.titles(id) on delete cascade,
  name text not null check(char_length(btrim(name)) between 1 and 300),
  name_kind text not null check(name_kind in ('original','translated','romanized','alternative')),
  language_code text references public.languages(code),
  search_document tsvector generated always as (to_tsvector('simple',name)) stored,
  unique(title_id,name,name_kind)
);
create index title_names_search on public.title_names using gin(search_document);
create index title_names_title on public.title_names(title_id);
create table public.genres (id uuid primary key default gen_random_uuid(), name text not null unique check(char_length(name) between 1 and 80));
create table public.title_genres (title_id uuid references public.titles(id) on delete cascade, genre_id uuid references public.genres(id) on delete restrict, primary key(title_id,genre_id));
create index title_genres_genre on public.title_genres(genre_id,title_id);
create table public.title_countries (title_id uuid references public.titles(id) on delete cascade, country_code text references public.countries(code), primary key(title_id,country_code));
create table public.title_languages (title_id uuid references public.titles(id) on delete cascade, language_code text references public.languages(code), primary key(title_id,language_code));
create table public.favorite_genres (user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade, genre_id uuid references public.genres(id), primary key(user_id,genre_id));
create table public.preferred_languages (user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade, language_code text references public.languages(code), primary key(user_id,language_code));
create table public.title_artwork (
  id uuid primary key default gen_random_uuid(), title_id uuid not null references public.titles(id) on delete cascade,
  provider_id uuid references public.metadata_providers(id), kind text not null check(kind in ('poster','backdrop')),
  url text not null check(url ~ '^https://[^[:space:]]+$' and char_length(url)<=2000),
  attribution text, language_code text references public.languages(code), width integer check(width>0), height integer check(height>0),
  created_at timestamptz not null default now()
);
create index title_artwork_title on public.title_artwork(title_id,kind);
create table public.title_trailers (
  id uuid primary key default gen_random_uuid(), title_id uuid not null references public.titles(id) on delete cascade,
  provider_id uuid references public.metadata_providers(id), url text not null check(url ~ '^https://[^[:space:]]+$' and char_length(url)<=2000),
  language_code text references public.languages(code), label text check(char_length(label)<=120)
);
create index title_trailers_title on public.title_trailers(title_id);
create table public.content_warnings (id uuid primary key default gen_random_uuid(), label text not null unique check(char_length(label) between 1 and 100));
create table public.title_content_warnings (title_id uuid references public.titles(id) on delete cascade, warning_id uuid references public.content_warnings(id), primary key(title_id,warning_id));
create table public.people (id uuid primary key default gen_random_uuid(), name text not null check(char_length(name) between 1 and 200));
create table public.title_credits (
  id uuid primary key default gen_random_uuid(), title_id uuid not null references public.titles(id) on delete cascade,
  person_id uuid not null references public.people(id), department text not null check(department in ('cast','director','writer','creator','producer','other')),
  role_name text not null default '' check(char_length(role_name)<=200), billing_order integer not null default 0 check(billing_order>=0),
  unique(title_id,person_id,department,role_name)
);
create index title_credits_title on public.title_credits(title_id,billing_order,id);
create table public.title_relations (
  source_id uuid references public.titles(id) on delete restrict, related_id uuid references public.titles(id) on delete restrict,
  relation text not null check(relation in ('adaptation','sequel','prequel','season','spin_off','remake','other')),
  primary key(source_id,related_id,relation), check(source_id<>related_id)
);
create table public.title_redirects (
  source_id uuid primary key references public.titles(id) on delete restrict,
  target_id uuid not null references public.titles(id) on delete restrict,
  created_at timestamptz not null default now(), check(source_id<>target_id)
);
create table public.metadata_provenance (
  id uuid primary key default gen_random_uuid(), title_id uuid not null references public.titles(id) on delete cascade,
  provider_id uuid references public.metadata_providers(id), field_name text not null check(char_length(field_name) between 1 and 80),
  source_reference text check(char_length(source_reference)<=2000), retrieved_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
create index metadata_provenance_title on public.metadata_provenance(title_id,field_name);
create table public.provider_sync_state (
  title_id uuid references public.titles(id) on delete cascade, provider_id uuid references public.metadata_providers(id),
  last_success_at timestamptz, next_attempt_at timestamptz, attempts integer not null default 0 check(attempts>=0),
  state text not null default 'pending' check(state in ('pending','running','ready','failed','disabled')),
  last_error_code text check(char_length(last_error_code)<=120), last_error text check(char_length(last_error)<=1000),
  updated_at timestamptz not null default now(), primary key(title_id,provider_id)
);
create index provider_sync_due on public.provider_sync_state(next_attempt_at) where state in ('pending','failed');
create table public.metadata_refresh_requests (
  id uuid primary key default gen_random_uuid(), title_id uuid not null references public.titles(id), provider_id uuid not null references public.metadata_providers(id),
  requested_by uuid references public.profiles(id) on delete set null, state text not null default 'pending' check(state in ('pending','running','completed','failed')),
  created_at timestamptz not null default now(), finished_at timestamptz
);
create unique index metadata_refresh_one_pending on public.metadata_refresh_requests(title_id,provider_id) where state in ('pending','running');
create table public.admin_alerts (id uuid primary key default gen_random_uuid(), provider_id uuid references public.metadata_providers(id), title_id uuid references public.titles(id), code text not null, message text not null check(char_length(message)<=1000), created_at timestamptz not null default now(), resolved_at timestamptz);

create table public.tracking (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title_id uuid not null references public.titles(id) on delete restrict, status public.tracking_status not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,title_id)
);
create index tracking_library on public.tracking(user_id,status,updated_at desc,id);
create table public.tracking_history (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  tracking_id uuid references public.tracking(id) on delete set null, title_id uuid not null references public.titles(id) on delete restrict,
  previous_status public.tracking_status, next_status public.tracking_status,
  changed_at timestamptz not null default now(), check(previous_status is distinct from next_status)
);
create index tracking_history_owner on public.tracking_history(user_id,changed_at desc,id);
create table public.ratings (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title_id uuid not null references public.titles(id) on delete restrict,
  score numeric not null check(score>=1 and score<=10 and score*10=trunc(score*10)),
  eligible boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,title_id)
);
create index ratings_title_eligible on public.ratings(title_id,user_id) where eligible;
create table public.rating_history (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  rating_id uuid references public.ratings(id) on delete set null, title_id uuid not null references public.titles(id) on delete restrict,
  previous_score numeric, next_score numeric, changed_at timestamptz not null default now(),
  check(previous_score is distinct from next_score)
);
create index rating_history_owner on public.rating_history(user_id,changed_at desc,id);
create table public.favorites (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title_id uuid not null references public.titles(id) on delete restrict, created_at timestamptz not null default now(), unique(user_id,title_id)
);
create index favorites_owner on public.favorites(user_id,created_at desc,id);

create table public.collections (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check(char_length(btrim(title)) between 1 and 160), description text not null default '' check(char_length(description)<=5000),
  visibility public.collection_visibility not null default 'private', spoiler_warning boolean not null default false,
  cover_path text check(char_length(cover_path)<=300), collage_reference text,
  sort_by text not null default 'manual' check(sort_by in ('manual','title','release_year','added_at')), sort_desc boolean not null default false,
  removed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(collage_reference is null or char_length(collage_reference)<=300)
);
create index collections_owner on public.collections(owner_id,created_at desc,id);
create index collections_published on public.collections(created_at desc,id) where visibility='published' and removed_at is null;
create table public.collection_items (
  id uuid primary key default gen_random_uuid(), collection_id uuid not null references public.collections(id) on delete cascade,
  title_id uuid not null references public.titles(id) on delete restrict, position bigint not null check(position>=0),
  creator_note text not null default '' check(char_length(creator_note)<=2000), created_at timestamptz not null default now(),
  unique(collection_id,title_id), constraint collection_item_position_key unique(collection_id,position) deferrable initially immediate
);
create index collection_items_page on public.collection_items(collection_id,position,id);
create table public.collection_favorites (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade, created_at timestamptz not null default now(), unique(user_id,collection_id)
);
create index collection_favorites_source on public.collection_favorites(collection_id);
create table public.collection_saves (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade, created_at timestamptz not null default now(), unique(user_id,collection_id)
);
create index collection_saves_owner on public.collection_saves(user_id,created_at desc,id);
create index collection_saves_source on public.collection_saves(collection_id);
create table public.collection_imports (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  imported_collection_id uuid not null unique references public.collections(id) on delete cascade,
  source_collection_id uuid references public.collections(id) on delete set null,
  source_owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index collection_imports_source on public.collection_imports(source_collection_id);
create index collection_imports_owner on public.collection_imports(user_id,created_at desc,id);
create table public.follows (
  id uuid primary key default gen_random_uuid(), follower_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade, created_at timestamptz not null default now(),
  unique(follower_id,followed_id), check(follower_id<>followed_id)
);
create index follows_followed on public.follows(followed_id,follower_id);
create table public.blocks (
  id uuid primary key default gen_random_uuid(), blocker_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade, created_at timestamptz not null default now(),
  unique(blocker_id,blocked_id), check(blocker_id<>blocked_id)
);
create index blocks_reverse on public.blocks(blocked_id,blocker_id);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade, kind public.notification_kind not null,
  collection_id uuid references public.collections(id) on delete cascade, dedupe_key text not null,
  read_at timestamptz, created_at timestamptz not null default now(), unique(recipient_id,dedupe_key),
  check(read_at is null or read_at>=created_at)
);
create index notifications_recipient on public.notifications(recipient_id,created_at desc,id);
create index notifications_unread on public.notifications(recipient_id,created_at desc) where read_at is null;

create table public.reports (
  id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid references public.profiles(id) on delete set null, collection_id uuid references public.collections(id) on delete set null,
  reason text not null check(reason in ('spam','harassment','hate','inappropriate','spoiler','copyright','other')),
  details text not null default '' check(char_length(details)<=3000),
  status public.review_status not null default 'pending', reviewer_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz, reviewer_notes text check(char_length(reviewer_notes)<=3000), created_at timestamptz not null default now()
);
create index reports_queue on public.reports(status,created_at,id);
create table public.admin_roles (
  user_id uuid references public.profiles(id) on delete cascade, role public.admin_role,
  granted_by uuid references public.profiles(id) on delete set null, granted_at timestamptz not null default now(), primary key(user_id,role)
);
create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(), report_id uuid references public.reports(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null, target_user_id uuid references public.profiles(id) on delete cascade,
  collection_id uuid references public.collections(id) on delete set null, action public.moderation_kind not null,
  reason text not null check(char_length(reason) between 1 and 3000), expires_at timestamptz, created_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id) on delete set null,
  action text not null, entity_type text not null, entity_id uuid, detail text not null default '' check(char_length(detail)<=3000), created_at timestamptz not null default now()
);
create index audit_logs_time on public.audit_logs(created_at desc,id);
create table public.missing_title_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check(char_length(btrim(title)) between 1 and 300), kind public.entertainment_kind not null,
  details text not null default '' check(char_length(details)<=3000), status public.review_status not null default 'pending',
  reviewer_id uuid references public.profiles(id) on delete set null, reviewed_at timestamptz,
  reviewer_notes text check(char_length(reviewer_notes)<=3000), resolved_title_id uuid references public.titles(id), created_at timestamptz not null default now()
);
create table public.metadata_corrections (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  title_id uuid not null references public.titles(id), field_name text not null check(field_name in ('display_title','original_title','description','release_year','kind','age_rating')),
  proposed_value text not null check(char_length(proposed_value) between 1 and 20000), reason text not null check(char_length(reason) between 1 and 3000),
  status public.review_status not null default 'pending', reviewer_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz, reviewer_notes text check(char_length(reviewer_notes)<=3000), created_at timestamptz not null default now()
);
create table public.catalog_merge_requests (
  id uuid primary key default gen_random_uuid(), source_id uuid not null references public.titles(id), target_id uuid not null references public.titles(id),
  requested_by uuid not null references public.profiles(id) on delete cascade, reason text not null check(char_length(reason) between 1 and 3000),
  status public.review_status not null default 'pending', reviewer_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz, reviewer_notes text, created_at timestamptz not null default now(), check(source_id<>target_id)
);
create table public.account_deletions (
  user_id uuid primary key references public.profiles(id) on delete cascade, requested_at timestamptz not null default now(),
  recover_until timestamptz not null default (now()+interval '30 days'), claimed_at timestamptz,
  check(recover_until=requested_at+interval '30 days'), check(claimed_at is null or claimed_at>=recover_until)
);
create index account_deletions_due on public.account_deletions(recover_until) where claimed_at is null;
create table public.data_export_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  format text not null check(format in ('json','csv')), status text not null default 'pending' check(status in ('pending','processing','ready','failed','expired')),
  created_at timestamptz not null default now(), completed_at timestamptz, expires_at timestamptz
);
create table app_private.platform_owner (singleton boolean primary key default true check(singleton), user_id uuid not null unique references public.profiles(id) on delete restrict);
create table app_private.rate_limits (user_id uuid references public.profiles(id) on delete cascade, bucket text, window_start timestamptz, count integer not null check(count>0), primary key(user_id,bucket,window_start));

-- Lock only tables created above, immediately, before this transaction commits.
alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant all on public.profiles to service_role;
alter table public.onboarding enable row level security;
revoke all on public.onboarding from public, anon, authenticated;
grant all on public.onboarding to service_role;
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from public, anon, authenticated;
grant all on public.notification_preferences to service_role;
alter table public.recommendation_preferences enable row level security;
revoke all on public.recommendation_preferences from public, anon, authenticated;
grant all on public.recommendation_preferences to service_role;
alter table public.preferred_categories enable row level security;
revoke all on public.preferred_categories from public, anon, authenticated;
grant all on public.preferred_categories to service_role;
alter table public.metadata_providers enable row level security;
revoke all on public.metadata_providers from public, anon, authenticated;
grant all on public.metadata_providers to service_role;
alter table public.titles enable row level security;
revoke all on public.titles from public, anon, authenticated;
grant all on public.titles to service_role;
alter table public.provider_title_ids enable row level security;
revoke all on public.provider_title_ids from public, anon, authenticated;
grant all on public.provider_title_ids to service_role;
alter table public.languages enable row level security;
revoke all on public.languages from public, anon, authenticated;
grant all on public.languages to service_role;
alter table public.countries enable row level security;
revoke all on public.countries from public, anon, authenticated;
grant all on public.countries to service_role;
alter table public.title_names enable row level security;
revoke all on public.title_names from public, anon, authenticated;
grant all on public.title_names to service_role;
alter table public.genres enable row level security;
revoke all on public.genres from public, anon, authenticated;
grant all on public.genres to service_role;
alter table public.title_genres enable row level security;
revoke all on public.title_genres from public, anon, authenticated;
grant all on public.title_genres to service_role;
alter table public.title_countries enable row level security;
revoke all on public.title_countries from public, anon, authenticated;
grant all on public.title_countries to service_role;
alter table public.title_languages enable row level security;
revoke all on public.title_languages from public, anon, authenticated;
grant all on public.title_languages to service_role;
alter table public.favorite_genres enable row level security;
revoke all on public.favorite_genres from public, anon, authenticated;
grant all on public.favorite_genres to service_role;
alter table public.preferred_languages enable row level security;
revoke all on public.preferred_languages from public, anon, authenticated;
grant all on public.preferred_languages to service_role;
alter table public.title_artwork enable row level security;
revoke all on public.title_artwork from public, anon, authenticated;
grant all on public.title_artwork to service_role;
alter table public.title_trailers enable row level security;
revoke all on public.title_trailers from public, anon, authenticated;
grant all on public.title_trailers to service_role;
alter table public.content_warnings enable row level security;
revoke all on public.content_warnings from public, anon, authenticated;
grant all on public.content_warnings to service_role;
alter table public.title_content_warnings enable row level security;
revoke all on public.title_content_warnings from public, anon, authenticated;
grant all on public.title_content_warnings to service_role;
alter table public.people enable row level security;
revoke all on public.people from public, anon, authenticated;
grant all on public.people to service_role;
alter table public.title_credits enable row level security;
revoke all on public.title_credits from public, anon, authenticated;
grant all on public.title_credits to service_role;
alter table public.title_relations enable row level security;
revoke all on public.title_relations from public, anon, authenticated;
grant all on public.title_relations to service_role;
alter table public.title_redirects enable row level security;
revoke all on public.title_redirects from public, anon, authenticated;
grant all on public.title_redirects to service_role;
alter table public.metadata_provenance enable row level security;
revoke all on public.metadata_provenance from public, anon, authenticated;
grant all on public.metadata_provenance to service_role;
alter table public.provider_sync_state enable row level security;
revoke all on public.provider_sync_state from public, anon, authenticated;
grant all on public.provider_sync_state to service_role;
alter table public.metadata_refresh_requests enable row level security;
revoke all on public.metadata_refresh_requests from public, anon, authenticated;
grant all on public.metadata_refresh_requests to service_role;
alter table public.admin_alerts enable row level security;
revoke all on public.admin_alerts from public, anon, authenticated;
grant all on public.admin_alerts to service_role;
alter table public.tracking enable row level security;
revoke all on public.tracking from public, anon, authenticated;
grant all on public.tracking to service_role;
alter table public.tracking_history enable row level security;
revoke all on public.tracking_history from public, anon, authenticated;
grant all on public.tracking_history to service_role;
alter table public.ratings enable row level security;
revoke all on public.ratings from public, anon, authenticated;
grant all on public.ratings to service_role;
alter table public.rating_history enable row level security;
revoke all on public.rating_history from public, anon, authenticated;
grant all on public.rating_history to service_role;
alter table public.favorites enable row level security;
revoke all on public.favorites from public, anon, authenticated;
grant all on public.favorites to service_role;
alter table public.collections enable row level security;
revoke all on public.collections from public, anon, authenticated;
grant all on public.collections to service_role;
alter table public.collection_items enable row level security;
revoke all on public.collection_items from public, anon, authenticated;
grant all on public.collection_items to service_role;
alter table public.collection_favorites enable row level security;
revoke all on public.collection_favorites from public, anon, authenticated;
grant all on public.collection_favorites to service_role;
alter table public.collection_saves enable row level security;
revoke all on public.collection_saves from public, anon, authenticated;
grant all on public.collection_saves to service_role;
alter table public.collection_imports enable row level security;
revoke all on public.collection_imports from public, anon, authenticated;
grant all on public.collection_imports to service_role;
alter table public.follows enable row level security;
revoke all on public.follows from public, anon, authenticated;
grant all on public.follows to service_role;
alter table public.blocks enable row level security;
revoke all on public.blocks from public, anon, authenticated;
grant all on public.blocks to service_role;
alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant all on public.notifications to service_role;
alter table public.reports enable row level security;
revoke all on public.reports from public, anon, authenticated;
grant all on public.reports to service_role;
alter table public.admin_roles enable row level security;
revoke all on public.admin_roles from public, anon, authenticated;
grant all on public.admin_roles to service_role;
alter table public.moderation_actions enable row level security;
revoke all on public.moderation_actions from public, anon, authenticated;
grant all on public.moderation_actions to service_role;
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from public, anon, authenticated;
grant all on public.audit_logs to service_role;
alter table public.missing_title_requests enable row level security;
revoke all on public.missing_title_requests from public, anon, authenticated;
grant all on public.missing_title_requests to service_role;
alter table public.metadata_corrections enable row level security;
revoke all on public.metadata_corrections from public, anon, authenticated;
grant all on public.metadata_corrections to service_role;
alter table public.catalog_merge_requests enable row level security;
revoke all on public.catalog_merge_requests from public, anon, authenticated;
grant all on public.catalog_merge_requests to service_role;
alter table public.account_deletions enable row level security;
revoke all on public.account_deletions from public, anon, authenticated;
grant all on public.account_deletions to service_role;
alter table public.data_export_requests enable row level security;
revoke all on public.data_export_requests from public, anon, authenticated;
grant all on public.data_export_requests to service_role;
alter table app_private.platform_owner enable row level security;
revoke all on app_private.platform_owner from public, anon, authenticated;
grant all on app_private.platform_owner to service_role;
alter table app_private.rate_limits enable row level security;
revoke all on app_private.rate_limits from public, anon, authenticated;
grant all on app_private.rate_limits to service_role;

commit;
