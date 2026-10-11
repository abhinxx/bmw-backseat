-- Dashboard aggregates. All counts are computed here, never by AI (PLAN §5.5).
-- Counts are DISTINCT comments, never label rows (one comment can carry several labels).

-- Comments per country for one vehicle.
create or replace function public.feedback_coverage(p_model text)
returns table (country text, comments bigint)
language sql stable
as $$
  select c.country, count(*)::bigint
  from public.feedback_comment c
  where c.model = p_model
  group by c.country
  order by 2 desc
$$;

-- Comments per BMW taxonomy theme (level2) and sentiment, optionally limited to some countries.
-- Unclassified labels ('no_class_found', null) and unknown sentiment are excluded.
create or replace function public.feedback_themes(p_model text, p_countries text[] default null)
returns table (level2 text, sentiment text, comments bigint)
language sql stable
as $$
  select l.level2, l.sentiment, count(distinct l.comment_id)::bigint
  from public.feedback_label l
  join public.feedback_comment c on c.comment_id = l.comment_id
  where c.model = p_model
    and (p_countries is null or c.country = any (p_countries))
    and l.level2 is not null
    and l.level2 <> 'no_class_found'
    and l.sentiment <> 'unknown'
  group by l.level2, l.sentiment
$$;

grant execute on function public.feedback_coverage(text) to anon, authenticated;
grant execute on function public.feedback_themes(text, text[]) to anon, authenticated;
