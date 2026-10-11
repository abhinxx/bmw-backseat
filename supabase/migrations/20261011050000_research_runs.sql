-- Research Agent: every run and every finding, append-only (ARCHITECTURE.md §7).
-- Findings keep a verbatim quote that the server checked against the page text Linkup returned.
-- relation is computed by the server from BMW feedback counts (bmw_context), never by the model.

create table public.research_run (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  vehicle         text not null,
  mission         text not null,
  depth           text not null check (depth in ('quick', 'standard', 'deep')),
  question        text not null,
  queries         jsonb not null default '[]',   -- [{q, depth, include_domains, results, seconds}]
  sources         jsonb not null default '[]',   -- [{sid, url, name}] every page the model was shown
  dropped         jsonb not null default '[]',   -- findings rejected by the server, with the reason
  model           text not null,
  prompt_version  text not null,
  linkup_calls    integer not null default 0,
  duration_ms     integer
);

create table public.research_finding (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references public.research_run (id) on delete cascade,
  created_at      timestamptz not null default now(),
  vehicle         text not null,
  claim           text not null,
  quote           text not null,                 -- verbatim, found in the page text
  source_url      text not null,
  source_name     text,
  source_type     text,                          -- official_spec / press / review / forum_post / analysis / other
  published_date  text,                          -- only if the page states it
  market          text,
  feature_id      text,                          -- one of the 16 features in lib/features.ts, or null
  stance          text,                          -- positive / negative / mixed / neutral, about that feature
  relation        text,                          -- agrees / contradicts / new_signal / context (server rule)
  bmw_context     jsonb                          -- BMW comment counts the relation was computed from
);
create index research_finding_run_idx on public.research_finding (run_id);
create index research_finding_feature_idx on public.research_finding (feature_id, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['research_run', 'research_finding']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "read %1$s" on public.%1$I for select to anon, authenticated using (true)', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;
