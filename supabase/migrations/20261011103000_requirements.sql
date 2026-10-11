-- Requirements: AI-drafted, code-scored, PM-decided (PLAN §0b). Append-only audit log.
-- Writes happen only through the server (service role); the browser reads.

-- One "Create requirements" run: options, weights, versions, and the CSV the PM uploaded (kept here as a
-- snapshot so citations to CSV rows stay traceable; never loaded into the BMW tables).
create table public.requirement_run (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  vehicle         text not null,
  options         jsonb not null,               -- { public, research, whatif }
  weights         jsonb not null,               -- factor id -> weight used
  score_version   text not null,
  prompt_version  text not null,
  model           text not null,
  csv_name        text,
  csv_rows        jsonb,                        -- [{ id: CSV-1, text, extra }] as uploaded, unverified
  actor           text,                         -- display name typed by the PM (no login)
  status          text not null default 'running' check (status in ('running', 'done', 'failed')),
  duration_ms     integer,
  summary         jsonb,
  error           text
);
create index requirement_run_vehicle_idx on public.requirement_run (vehicle, created_at desc);

-- The current state of each requirement. One per car line x feature x kind; a new run updates it in place
-- and every change is written to requirement_event first.
create table public.requirement (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,      -- REQ-G60-CTRL-FIX
  vehicle            text not null,
  feature_id         text not null,
  kind               text not null check (kind in ('fix', 'add', 'protect')),
  title              text not null,
  description        text not null,
  target             text,
  rationale          text,
  assumptions        text[] not null default '{}',
  uncertainties      text[] not null default '{}',
  conflicts          text[] not null default '{}',
  markets            text[] not null default '{}',
  score              integer not null,
  priority           text not null check (priority in ('P1', 'P2', 'P3')),
  priority_override  text check (priority_override in ('P1', 'P2', 'P3')),
  rank               integer not null,
  evidence_level     text not null check (evidence_level in ('A', 'B', 'C', 'D')),
  factors            jsonb not null,
  sources            jsonb not null,
  status             text not null default 'proposed' check (status in ('proposed', 'in_review', 'approved', 'rejected', 'postponed')),
  status_reason      text,
  edited_by_pm       boolean not null default false,
  run_id             uuid references public.requirement_run (id),
  version            integer not null default 1,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (vehicle, feature_id, kind)
);
create index requirement_vehicle_idx on public.requirement (vehicle, rank);

-- Audit trail: who or what changed which field, when, from what to what, and why.
create table public.requirement_event (
  id              bigint generated always as identity primary key,
  requirement_id  uuid not null references public.requirement (id) on delete cascade,
  run_id          uuid references public.requirement_run (id),
  at              timestamptz not null default now(),
  actor_type      text not null check (actor_type in ('ai', 'code', 'pm', 'system')),
  actor           text not null,
  action          text not null,
  field           text,
  before          jsonb,
  after           jsonb,
  reason          text
);
create index requirement_event_req_idx on public.requirement_event (requirement_id, at);

-- Unique comments per sentiment and market bucket for one feature (same matching rule as evidence_comments:
-- a BMW taxonomy class of the feature, or the feature's text pattern; sentiment of the first matching label).
create or replace function public.requirement_feature_counts(
  p_model text,
  p_level2 text[],
  p_pattern text,
  p_europe text[]
)
returns table (sentiment text, bucket text, comments bigint)
language sql stable
as $$
  with matched as (
    select c.comment_id, c.country,
           coalesce(
             (select l.sentiment from public.feedback_label l
               where l.comment_id = c.comment_id and l.level2 = any (p_level2) order by l.row_index limit 1),
             (select l.sentiment from public.feedback_label l
               where l.comment_id = c.comment_id order by l.row_index limit 1)) as sentiment
    from public.feedback_comment c
    where c.model = p_model
      and (
        exists (select 1 from public.feedback_label l where l.comment_id = c.comment_id and l.level2 = any (p_level2))
        or (p_pattern is not null and c.text ~* p_pattern)
      )
  )
  select m.sentiment,
         case when m.country = 'US' then 'US'
              when m.country = 'CN' then 'CN'
              when m.country = any (p_europe) then 'EU'
              else 'RoW' end as bucket,
         count(*)::bigint
  from matched m
  group by 1, 2
$$;
grant execute on function public.requirement_feature_counts(text, text[], text, text[]) to anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['requirement_run', 'requirement', 'requirement_event']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "read %1$s" on public.%1$I for select to anon, authenticated using (true)', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;
