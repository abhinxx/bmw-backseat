-- Internal BMW snapshot. Loaded once from the cleaned files, then read-only.
-- Grounding rule: every row keeps a pointer back to its original file location
-- (spreadsheet row, survey cell, price-list page) so any claim can be listed and audited.
-- Writes happen only with the service role (loader script); the app reads with the anon key.

-- 1. Customer feedback: one row per unique comment (10,128) ------------------------------
create table public.feedback_comment (
  comment_id            text primary key,                 -- e.g. G60-0008
  model                 text not null check (model in ('G60', 'G70', 'F70')),
  source                text not null,                    -- anonymised source A-D
  country               text,
  engine_type           text,
  text                  text not null,                    -- verbatim customer text (text_raw)
  is_agent_transcribed  boolean not null default false,   -- source B "customer says..." transcripts
  us_only_source        boolean not null default false,   -- sources B, C, D only cover the US
  search                tsvector generated always as (to_tsvector('english', text)) stored
);
create index feedback_comment_scope_idx on public.feedback_comment (model, country);
create index feedback_comment_search_idx on public.feedback_comment using gin (search);

-- 2. Feedback labels: one row per original spreadsheet row (13,771) ----------------------
-- A comment can carry several BMW taxonomy labels; sentiment is per label.
create table public.feedback_label (
  comment_id      text not null references public.feedback_comment (comment_id),
  row_index       integer not null,                       -- 0-based data row in <model>_feedback_hackathon.xlsx
  excel_row       integer not null,                       -- the row number a human sees in Excel
  feedback_type   text,                                   -- Likes / Difficult to Use / Wants / ...
  sentiment       text not null check (sentiment in ('positive', 'negative', 'want', 'unknown')),
  level2          text,
  level3          text,
  vfc             text,                                   -- combined taxonomy label
  primary key (comment_id, row_index)
);
create index feedback_label_vfc_idx on public.feedback_label (vfc);
create index feedback_label_level2_idx on public.feedback_label (level2);

-- 3. Customer study (survey), long format (3,275 values) ----------------------------------
create table public.study_metric (
  id           bigint generated always as identity primary key,
  sheet        text not null,
  market       text not null,
  model        text not null,                             -- as written in the study, e.g. "BMW 5 Series G68"
  attribute    text not null,
  metric       text not null,
  value        double precision,
  n            integer,                                   -- sample size where the study gives one (it never does)
  source_cell  text not null,                             -- e.g. CN_EU_2025!B4
  unique (sheet, market, model, attribute, metric)
);

-- 4. Price lists: equipment items (431) and engine variants (23) --------------------------
create table public.option_item (
  id            bigint generated always as identity primary key,
  model         text not null check (model in ('G60', 'G70', 'F70')),
  page          integer not null,                         -- page in <model>_OptionList.PDF
  page_title    text,
  kind          text,
  section       text,
  name          text not null,
  code          text,                                     -- BMW option code, e.g. 7VB
  condition     text,
  price_gross   numeric,
  price_net     numeric,
  price_note    text,
  marks         jsonb not null default '{}',              -- per variant: standard / optional / ...
  description   text,
  constraints   jsonb not null default '[]'
);
create index option_item_model_code_idx on public.option_item (model, code);

create table public.vehicle_variant (
  model                 text not null check (model in ('G60', 'G70', 'F70')),
  variant               text not null,
  page                  integer not null,
  fuel                  text,
  power_kw              integer,
  power_ps              integer,
  base_price_eur_gross  numeric,
  primary key (model, variant)
);

-- 5. Sales volumes ------------------------------------------------------------------------
create table public.sales_volume (
  sheet         text not null,                            -- F70 / G60_G68 / G70 in sales_volumes.xlsx
  market        text not null check (market in ('EU', 'CN', 'US', 'RoW')),
  year          integer not null check (year in (2024, 2025, 2030)),
  volume        integer not null,
  is_forecast   boolean not null,                         -- 2030 is a forecast
  primary key (sheet, market, year)
);

-- 6. Personas (9, G60) and the comments they cite -----------------------------------------
create table public.persona (
  id             text primary key,                        -- AM-1 ... AS-3
  model          text not null default 'G60',
  name           text not null,                           -- illustration only
  label          text not null,
  region         text not null,
  market         text not null,
  evidence_tier  text not null,
  profile        jsonb not null                           -- the full persona JSON, unchanged
);

create table public.persona_evidence (
  persona_id   text not null references public.persona (id),
  comment_id   text not null references public.feedback_comment (comment_id),
  role         text,
  primary key (persona_id, comment_id)
);

-- Read-only for the app ------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['feedback_comment','feedback_label','study_metric','option_item',
                           'vehicle_variant','sales_volume','persona','persona_evidence']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "read %1$s" on public.%1$I for select to anon, authenticated using (true)', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;
