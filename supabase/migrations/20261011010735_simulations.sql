-- What-If simulations: deterministic evidence selection + an append-only record of every run (the audit log).

-- Evidence for one persona and one feature, selected the same way every time:
-- comments of this model, from these countries (and engine types), whose BMW taxonomy class is one of the
-- feature's classes OR whose text matches the feature's pattern. Ordered by comment_id, capped per sentiment.
-- Returns the total per sentiment as well, so the UI can say "8 of 41 shown".
create or replace function public.evidence_comments(
  p_model text,
  p_countries text[],
  p_engines text[] default null,
  p_level2 text[] default '{}',
  p_pattern text default null,
  p_per_sentiment int default 8
)
returns table (
  comment_id text, country text, engine_type text, text text,
  sentiment text, level2 text, excel_row int, total_in_sentiment bigint
)
language sql stable
as $$
  with matched as (
    select c.comment_id, c.country, c.engine_type, c.text,
           -- sentiment/class of the first label that matches the feature, else of the comment's first label
           coalesce(
             (select l.sentiment from public.feedback_label l
               where l.comment_id = c.comment_id and l.level2 = any (p_level2) order by l.row_index limit 1),
             (select l.sentiment from public.feedback_label l
               where l.comment_id = c.comment_id order by l.row_index limit 1)) as sentiment,
           coalesce(
             (select l.level2 from public.feedback_label l
               where l.comment_id = c.comment_id and l.level2 = any (p_level2) order by l.row_index limit 1),
             (select l.level2 from public.feedback_label l
               where l.comment_id = c.comment_id order by l.row_index limit 1)) as level2,
           (select min(l.excel_row) from public.feedback_label l where l.comment_id = c.comment_id) as excel_row
    from public.feedback_comment c
    where c.model = p_model
      and c.country = any (p_countries)
      and (p_engines is null or c.engine_type = any (p_engines))
      and (
        exists (select 1 from public.feedback_label l where l.comment_id = c.comment_id and l.level2 = any (p_level2))
        or (p_pattern is not null and c.text ~* p_pattern)
      )
  ),
  ranked as (
    select m.*, row_number() over (partition by m.sentiment order by m.comment_id) as rn,
           count(*) over (partition by m.sentiment) as total_in_sentiment
    from matched m
  )
  select comment_id, country, engine_type, text, sentiment, level2, excel_row, total_in_sentiment
  from ranked
  where rn <= p_per_sentiment
  order by sentiment, comment_id
$$;
grant execute on function public.evidence_comments(text, text[], text[], text[], text, int) to anon, authenticated;

-- One row per What-If run.
create table public.simulation_run (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  vehicle             text not null,
  question            text not null,
  question_norm       text not null,             -- lower-cased, whitespace-collapsed; cache lookup key
  change              jsonb not null,            -- the structured change the model read from the question
  feature_id          text,                      -- null when the question matched no feature
  model               text not null,             -- LLM used
  prompt_version      text not null,
  feature_map_version text not null,
  evidence_hash       text not null,             -- hash of every evidence id given to every persona
  duration_ms         integer
);
create index simulation_run_lookup_idx on public.simulation_run (vehicle, question_norm, prompt_version, created_at desc);

-- One row per persona per run: the verdict, its citations and the exact evidence the model saw.
create table public.simulation_verdict (
  run_id             uuid not null references public.simulation_run (id),
  persona_id         text not null references public.persona (id),
  verdict            text not null check (verdict in ('more_likely','slightly_more_likely','no_effect',
                                                      'slightly_less_likely','less_likely','not_enough_evidence')),
  confidence         text not null check (confidence in ('high','medium','low')),
  reaction           text,                       -- one or two sentences in the segment's voice (simulated)
  reason             text,                       -- analyst-voice reason
  assumptions        text[] not null default '{}',
  supporting_ids     text[] not null default '{}',
  opposing_ids       text[] not null default '{}',
  dropped_citations  text[] not null default '{}', -- ids the model cited that were NOT in its evidence (rejected)
  evidence           jsonb not null,             -- exactly what the model was given
  llm_called         boolean not null,
  primary key (run_id, persona_id)
);

-- Append-only: anyone can read (it is the audit log), only the server (service role) can insert.
alter table public.simulation_run enable row level security;
alter table public.simulation_verdict enable row level security;
create policy "read simulation_run" on public.simulation_run for select to anon, authenticated using (true);
create policy "read simulation_verdict" on public.simulation_verdict for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.simulation_run, public.simulation_verdict from anon, authenticated;
