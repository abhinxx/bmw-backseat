-- External evidence: public sources collected with Linkup and from the BMW Group Report 2025.
-- Kept separate from BMW's internal snapshot so the app can always say "internal" vs "external".
-- Every finding keeps its source (URL or report page), a verbatim quote, and the original record (raw).

create table public.external_source (
  id            text primary key,             -- e.g. bmw_report_2025, owner_voice_g60
  title         text not null,
  method        text not null,                -- how it was collected
  collected_at  timestamptz,
  record_count  integer,
  file          text                          -- local file it was loaded from
);

create table public.external_finding (
  id                 text primary key,        -- '<source_id>:<record id>'
  source_id          text not null references public.external_source (id),
  kind               text not null check (kind in ('metric', 'statement', 'owner_quote', 'trend', 'competitor_feature')),
  vehicle            text,                    -- 'G60' when the finding is about the 5 Series
  market             text,                    -- US / EU / CN / KR / JP / global, when known
  topic              text,                    -- theme, feature key or metric group
  subject            text,                    -- competitor id, region or metric segment
  title              text not null,           -- claim, summary, metric name or feature value
  stance             text,                    -- positive / negative / mixed / request
  value              numeric,
  unit               text,
  year               integer,
  quote              text,                    -- verbatim from the source
  quote_translation  text,                    -- machine translation for non-English quotes (labelled in the UI)
  source_name        text,
  source_url         text,
  source_page        integer,                 -- for PDF sources
  source_type        text,
  published_date     text,
  raw                jsonb not null           -- the original record, unchanged
);
create index external_finding_kind_idx on public.external_finding (source_id, kind, topic);

create table public.search_trend (
  region   text not null,                     -- US / DE / WORLD
  keyword  text not null,
  month    date not null,
  value    integer not null,                  -- Google Trends interest 0-100 (relative within one request)
  primary key (region, keyword, month)
);

do $$
declare t text;
begin
  foreach t in array array['external_source', 'external_finding', 'search_trend']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "read %1$s" on public.%1$I for select to anon, authenticated using (true)', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;
