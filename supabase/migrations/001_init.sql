-- ============================================================================
-- HerWay v2 - Supabase + PostGIS Initial Migration
-- File: supabase/migrations/001_init.sql
-- ============================================================================

-- 1. Enable PostGIS & UUID generation
create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- 2. Custom Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'report_category') then
    create type public.report_category as enum (
      'well_lit',
      'crowded_safe',
      'police_patrol',
      'poor_lighting',
      'deserted',
      'harassment_alert',
      'blocked_construction'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'report_sentiment') then
    create type public.report_sentiment as enum (
      'positive',
      'caution',
      'danger'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'time_window_type') then
    create type public.time_window_type as enum (
      'all_day',
      'evening_night',
      'early_morning'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'trip_status_type') then
    create type public.trip_status_type as enum (
      'active',
      'completed',
      'sos_triggered',
      'missed_checkin'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'vote_kind') then
    create type public.vote_kind as enum (
      'upvote',
      'flag'
    );
  end if;
end $$;

-- 3. Profiles Table (synced with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  emergency_contacts jsonb not null default '[]'::jsonb,
  safety_preferences jsonb not null default '{
    "prioritize_lighting": true,
    "avoid_deserted": true,
    "night_mode_strict": true,
    "checkin_interval_mins": 15
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, 'User'), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Route Reports Table (Daily Community Updates)
create table if not exists public.route_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  location extensions.geography(Point, 4326) not null,
  area_name text not null default '',
  category public.report_category not null,
  sentiment public.report_sentiment not null,
  note text not null default '' check (char_length(note) <= 280),
  upvotes integer not null default 0 check (upvotes >= 0),
  flags integer not null default 0 check (flags >= 0),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  created_at timestamptz not null default now()
);

create index if not exists idx_route_reports_location
  on public.route_reports using gist (location);

create index if not exists idx_route_reports_created_expires
  on public.route_reports (created_at desc, expires_at);

-- 5. Route Suggestions Table (Community Corridor Tips & Safer Paths)
create table if not exists public.route_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  origin_area text not null,
  destination_area text not null,
  start_point extensions.geography(Point, 4326) not null,
  end_point extensions.geography(Point, 4326) not null,
  waypoints jsonb not null default '[]'::jsonb,
  title text not null check (char_length(trim(title)) between 3 and 120),
  advice text not null check (char_length(trim(advice)) between 5 and 500),
  time_window public.time_window_type not null default 'all_day',
  helpful_count integer not null default 0 check (helpful_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_route_suggestions_start
  on public.route_suggestions using gist (start_point);

create index if not exists idx_route_suggestions_end
  on public.route_suggestions using gist (end_point);

-- 6. Report Votes Table (Prevents duplicate upvotes/flags per user)
create table if not exists public.report_votes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  report_id uuid not null references public.route_reports(id) on delete cascade,
  vote_type public.vote_kind not null,
  created_at timestamptz not null default now(),
  primary key (user_id, report_id)
);

create or replace function public.sync_report_vote_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_report_id uuid;
begin
  target_report_id := coalesce(new.report_id, old.report_id);

  update public.route_reports
  set
    upvotes = (
      select count(*) from public.report_votes
      where report_id = target_report_id and vote_type = 'upvote'
    ),
    flags = (
      select count(*) from public.report_votes
      where report_id = target_report_id and vote_type = 'flag'
    )
  where id = target_report_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_report_votes on public.report_votes;
create trigger trg_sync_report_votes
  after insert or update or delete on public.report_votes
  for each row execute function public.sync_report_vote_counts();

-- 7. Active Trips Table (Link-Based Live Trip Tracking)
create table if not exists public.active_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  share_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  status public.trip_status_type not null default 'active',
  origin_label text not null,
  dest_label text not null,
  route_geojson jsonb not null,
  safety_score integer not null default 80 check (safety_score between 0 and 100),
  current_lat double precision not null,
  current_lng double precision not null,
  heading double precision,
  eta_minutes integer,
  next_checkin_at timestamptz,
  last_ping_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists idx_active_trips_share_token
  on public.active_trips (share_token);

create index if not exists idx_active_trips_user_status
  on public.active_trips (user_id, status);

-- Enable Realtime on active_trips for live link watchers
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'active_trips'
  ) then
    alter publication supabase_realtime add table public.active_trips;
  end if;
end $$;

-- ============================================================================
-- 8. Row-Level Security (RLS) Policies
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.route_reports enable row level security;
alter table public.route_suggestions enable row level security;
alter table public.report_votes enable row level security;
alter table public.active_trips enable row level security;

-- Profiles: users read & update only their own profile
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Route Reports: active non-hidden reports readable by anyone; inserts/deletes scoped to owner
drop policy if exists "route_reports_select_active" on public.route_reports;
create policy "route_reports_select_active"
  on public.route_reports for select
  using (expires_at > now() and flags < 10);

drop policy if exists "route_reports_insert_auth" on public.route_reports;
create policy "route_reports_insert_auth"
  on public.route_reports for insert
  with check (auth.uid() = user_id);

drop policy if exists "route_reports_delete_own" on public.route_reports;
create policy "route_reports_delete_own"
  on public.route_reports for delete
  using (auth.uid() = user_id);

-- Route Suggestions: readable by anyone; inserts/updates/deletes scoped to owner
drop policy if exists "route_suggestions_select_all" on public.route_suggestions;
create policy "route_suggestions_select_all"
  on public.route_suggestions for select
  using (true);

drop policy if exists "route_suggestions_insert_auth" on public.route_suggestions;
create policy "route_suggestions_insert_auth"
  on public.route_suggestions for insert
  with check (auth.uid() = user_id);

drop policy if exists "route_suggestions_update_own" on public.route_suggestions;
create policy "route_suggestions_update_own"
  on public.route_suggestions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "route_suggestions_delete_own" on public.route_suggestions;
create policy "route_suggestions_delete_own"
  on public.route_suggestions for delete
  using (auth.uid() = user_id);

-- Report Votes: authenticated users manage their own vote rows
drop policy if exists "report_votes_select_own" on public.report_votes;
create policy "report_votes_select_own"
  on public.report_votes for select
  using (auth.uid() = user_id);

drop policy if exists "report_votes_insert_own" on public.report_votes;
create policy "report_votes_insert_own"
  on public.report_votes for insert
  with check (auth.uid() = user_id);

drop policy if exists "report_votes_update_own" on public.report_votes;
create policy "report_votes_update_own"
  on public.report_votes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "report_votes_delete_own" on public.report_votes;
create policy "report_votes_delete_own"
  on public.report_votes for delete
  using (auth.uid() = user_id);

-- Active Trips: owners manage their trips; public link viewers read via RPC get_trip_by_token
drop policy if exists "active_trips_select_own" on public.active_trips;
create policy "active_trips_select_own"
  on public.active_trips for select
  using (auth.uid() = user_id);

drop policy if exists "active_trips_insert_own" on public.active_trips;
create policy "active_trips_insert_own"
  on public.active_trips for insert
  with check (auth.uid() = user_id);

drop policy if exists "active_trips_update_own" on public.active_trips;
create policy "active_trips_update_own"
  on public.active_trips for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "active_trips_delete_own" on public.active_trips;
create policy "active_trips_delete_own"
  on public.active_trips for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- 9. Spatial & Live-Tracking RPC Functions
-- ============================================================================

-- Fetch active community route reports within radius_meters of (lat, lng)
create or replace function public.get_nearby_reports(
  lat double precision,
  lng double precision,
  radius_meters double precision default 3000,
  max_age_hours integer default 48
)
returns table (
  id uuid,
  lat double precision,
  lng double precision,
  area_name text,
  category public.report_category,
  sentiment public.report_sentiment,
  note text,
  upvotes integer,
  flags integer,
  created_at timestamptz,
  expires_at timestamptz,
  distance_meters double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with origin as (
    select extensions.ST_SetSRID(extensions.ST_MakePoint(lng, lat), 4326)::extensions.geography as pt
  )
  select
    r.id,
    extensions.ST_Y(r.location::extensions.geometry) as lat,
    extensions.ST_X(r.location::extensions.geometry) as lng,
    r.area_name,
    r.category,
    r.sentiment,
    r.note,
    r.upvotes,
    r.flags,
    r.created_at,
    r.expires_at,
    extensions.ST_Distance(r.location, origin.pt) as distance_meters
  from public.route_reports r, origin
  where r.expires_at > now()
    and r.flags < 10
    and r.created_at >= (now() - make_interval(hours => max_age_hours))
    and extensions.ST_DWithin(r.location, origin.pt, radius_meters)
  order by r.created_at desc
  limit 200;
$$;

-- Fetch community route suggestions near a searched point
create or replace function public.get_nearby_suggestions(
  lat double precision,
  lng double precision,
  radius_meters double precision default 5000
)
returns table (
  id uuid,
  origin_area text,
  destination_area text,
  start_lat double precision,
  start_lng double precision,
  end_lat double precision,
  end_lng double precision,
  waypoints jsonb,
  title text,
  advice text,
  time_window public.time_window_type,
  helpful_count integer,
  created_at timestamptz,
  distance_meters double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with pt_ref as (
    select extensions.ST_SetSRID(extensions.ST_MakePoint(lng, lat), 4326)::extensions.geography as pt
  )
  select
    s.id,
    s.origin_area,
    s.destination_area,
    extensions.ST_Y(s.start_point::extensions.geometry) as start_lat,
    extensions.ST_X(s.start_point::extensions.geometry) as start_lng,
    extensions.ST_Y(s.end_point::extensions.geometry) as end_lat,
    extensions.ST_X(s.end_point::extensions.geometry) as end_lng,
    s.waypoints,
    s.title,
    s.advice,
    s.time_window,
    s.helpful_count,
    s.created_at,
    least(
      extensions.ST_Distance(s.start_point, pt_ref.pt),
      extensions.ST_Distance(s.end_point, pt_ref.pt)
    ) as distance_meters
  from public.route_suggestions s, pt_ref
  where extensions.ST_DWithin(s.start_point, pt_ref.pt, radius_meters)
     or extensions.ST_DWithin(s.end_point, pt_ref.pt, radius_meters)
  order by s.helpful_count desc, s.created_at desc
  limit 50;
$$;

-- Score a set of sampled route coordinates ([lng, lat] pairs) against nearby reports
create or replace function public.score_route_points(
  coords jsonb,
  buffer_meters double precision default 150
)
returns table (
  report_id uuid,
  lat double precision,
  lng double precision,
  category public.report_category,
  sentiment public.report_sentiment,
  note text,
  upvotes integer,
  created_at timestamptz,
  min_distance_meters double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with sampled as (
    select
      extensions.ST_SetSRID(
        extensions.ST_MakePoint(
          (elem->>0)::double precision,
          (elem->>1)::double precision
        ),
        4326
      )::extensions.geography as pt
    from jsonb_array_elements(coords) as elem
    where jsonb_typeof(elem) = 'array'
      and jsonb_array_length(elem) >= 2
  ),
  route_line as (
    select extensions.ST_MakeLine(array_agg(pt::extensions.geometry))::extensions.geography as geog
    from sampled
  )
  select
    r.id as report_id,
    extensions.ST_Y(r.location::extensions.geometry) as lat,
    extensions.ST_X(r.location::extensions.geometry) as lng,
    r.category,
    r.sentiment,
    r.note,
    r.upvotes,
    r.created_at,
    extensions.ST_Distance(r.location, rl.geog) as min_distance_meters
  from public.route_reports r
  cross join route_line rl
  where rl.geog is not null
    and r.expires_at > now()
    and r.flags < 10
    and extensions.ST_DWithin(r.location, rl.geog, buffer_meters)
  order by r.created_at desc;
$$;

-- Public link-based trip lookup by share_token (safe for unauthenticated recipients)
create or replace function public.get_trip_by_token(p_share_token text)
returns table (
  id uuid,
  status public.trip_status_type,
  origin_label text,
  dest_label text,
  route_geojson jsonb,
  safety_score integer,
  current_lat double precision,
  current_lng double precision,
  heading double precision,
  eta_minutes integer,
  next_checkin_at timestamptz,
  last_ping_at timestamptz,
  created_at timestamptz,
  ended_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    t.status,
    t.origin_label,
    t.dest_label,
    t.route_geojson,
    t.safety_score,
    t.current_lat,
    t.current_lng,
    t.heading,
    t.eta_minutes,
    t.next_checkin_at,
    t.last_ping_at,
    t.created_at,
    t.ended_at
  from public.active_trips t
  where t.share_token = p_share_token
  limit 1;
$$;

-- Increment helpful counter on a route suggestion safely
create or replace function public.increment_suggestion_helpful(p_suggestion_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.route_suggestions
  set helpful_count = helpful_count + 1
  where id = p_suggestion_id;
$$;

-- Grant RPC execution permissions
grant execute on function public.get_nearby_reports(double precision, double precision, double precision, integer) to anon, authenticated;
grant execute on function public.get_nearby_suggestions(double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.score_route_points(jsonb, double precision) to anon, authenticated;
grant execute on function public.get_trip_by_token(text) to anon, authenticated;
grant execute on function public.increment_suggestion_helpful(uuid) to anon, authenticated;