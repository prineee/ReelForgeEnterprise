-- Persistent backing store for services/infrastructure/ProductionContextRepository.ts.
--
-- Movie Studio's production state was previously held only in an in-memory
-- Map (InMemoryProductionContextRepository), scoped to a single Node
-- process. On Vercel, POST /api/movie/create and GET
-- /api/movie/status/[productionId] are separate serverless functions with
-- independent process memory, so a production created by one instance was
-- never visible to a status poll served by another instance ("Unknown
-- production."). This table lets a database-backed
-- ProductionContextRepository implementation replace the in-memory one
-- without any change to MovieProductionService, which only depends on the
-- repository interface.
--
-- Only ever written/read via the service-role client
-- (lib/supabase/admin.ts) from server-side code — no browser client uses
-- this table, so RLS is enabled with no policies (deny-all to anon/
-- authenticated roles; service-role bypasses RLS by design).

create table if not exists public.movie_production_contexts (
  production_id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists movie_production_contexts_user_id_idx
  on public.movie_production_contexts (user_id);

alter table public.movie_production_contexts enable row level security;
