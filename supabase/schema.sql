-- Katy Queens schema. Paste into Supabase: SQL Editor -> New query -> Run.
-- Safe to re-run.

-- The board for each day, so every device plays the same uploaded puzzle.
create table if not exists public.puzzles (
  puzzle_date date primary key,
  size        int   not null check (size between 4 and 12),
  regions     jsonb not null,           -- size*size region ids, row-major
  colors      jsonb not null,           -- one hex colour per region
  created_at  timestamptz not null default now()
);

-- One solve time per player per day. Streaks and the leaderboard are
-- worked out from these rows.
create table if not exists public.results (
  id          bigint generated always as identity primary key,
  player      text not null check (char_length(player) between 1 and 40),
  puzzle_date date not null,
  seconds     int  not null check (seconds > 0 and seconds < 86400),
  created_at  timestamptz not null default now(),
  unique (player, puzzle_date)
);

create index if not exists results_date_idx on public.results (puzzle_date desc);

-- The app talks to Supabase with the public anon key and has no login, so
-- anyone with the site's URL can read and add times. Rows can't be deleted
-- from the app. Fine for a family leaderboard; don't store anything private.
alter table public.puzzles enable row level security;
alter table public.results enable row level security;

drop policy if exists "anyone can read puzzles"   on public.puzzles;
drop policy if exists "anyone can add puzzles"    on public.puzzles;
drop policy if exists "anyone can update puzzles" on public.puzzles;
drop policy if exists "anyone can read results"   on public.results;
drop policy if exists "anyone can add results"    on public.results;
drop policy if exists "anyone can update results" on public.results;

create policy "anyone can read puzzles"   on public.puzzles for select to anon, authenticated using (true);
create policy "anyone can add puzzles"    on public.puzzles for insert to anon, authenticated with check (true);
create policy "anyone can update puzzles" on public.puzzles for update to anon, authenticated using (true) with check (true);
create policy "anyone can read results"   on public.results for select to anon, authenticated using (true);
create policy "anyone can add results"    on public.results for insert to anon, authenticated with check (true);
create policy "anyone can update results" on public.results for update to anon, authenticated using (true) with check (true);

grant select, insert, update on public.puzzles to anon, authenticated;
grant select, insert, update on public.results to anon, authenticated;
