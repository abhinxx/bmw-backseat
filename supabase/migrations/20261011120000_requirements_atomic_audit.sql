-- Requirement state and its audit events commit together. Service-role only.
-- Per-car generation locks apply to own and team keys. No API key is stored.
alter table public.requirement_run add column if not exists uses_team_key boolean not null default true;

create or replace function public.save_requirement_change(
  p_id uuid, p_expected_version integer, p_patch jsonb, p_events jsonb
) returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare
  r public.requirement%rowtype;
  n public.requirement%rowtype;
begin
  if jsonb_array_length(p_events) = 0 then raise exception 'An audit event is required for every change'; end if;
  if p_id is null then
    n := jsonb_populate_record(null::public.requirement,
      jsonb_build_object('id', gen_random_uuid(), 'created_at', now(), 'updated_at', now(),
        'version', 1, 'status', 'proposed', 'edited_by_pm', false, 'priority_override', null,
        'status_reason', null, 'assumptions', '[]'::jsonb, 'uncertainties', '[]'::jsonb, 'conflicts', '[]'::jsonb) || p_patch);
    insert into public.requirement select n.* returning * into r;
  else
    select * into r from public.requirement where id = p_id for update;
    if not found then raise exception 'Requirement not found'; end if;
    if r.version <> p_expected_version then raise exception 'Requirement changed; refresh and review the latest version'; end if;
    n := jsonb_populate_record(r, p_patch);
    update public.requirement set
      title = n.title, description = n.description, target = n.target, rationale = n.rationale,
      assumptions = n.assumptions, uncertainties = n.uncertainties, conflicts = n.conflicts, markets = n.markets,
      score = n.score, priority = n.priority, priority_override = n.priority_override, rank = n.rank,
      evidence_level = n.evidence_level, factors = n.factors, sources = n.sources,
      status = n.status, status_reason = n.status_reason, edited_by_pm = n.edited_by_pm, run_id = n.run_id,
      version = r.version + 1, updated_at = now()
    where id = p_id returning * into r;
  end if;
  insert into public.requirement_event (requirement_id, run_id, actor_type, actor, action, field, before, after, reason)
    select r.id, e.run_id, e.actor_type, e.actor, e.action, e.field, e.before, e.after, e.reason
    from jsonb_to_recordset(p_events) as e(run_id uuid, actor_type text, actor text, action text,
      field text, before jsonb, after jsonb, reason text);
  return to_jsonb(r);
end $$;
revoke all on function public.save_requirement_change(uuid, integer, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_requirement_change(uuid, integer, jsonb, jsonb) to service_role;

create or replace function public.begin_requirement_run(p_run jsonb, p_team boolean)
returns uuid language plpgsql set search_path = public, pg_temp as $$
declare
  rid uuid;
  car text := p_run->>'vehicle';
begin
  perform pg_advisory_xact_lock(hashtext('requirements:' || car));
  update public.requirement_run set status = 'failed', error = 'Previous run exceeded its five-minute execution window'
    where vehicle = car and status = 'running' and created_at < now() - interval '5 minutes';
  if exists (select 1 from public.requirement_run where vehicle = car and status = 'running') then
    raise exception 'Run limit: a run for this car line is already in progress';
  end if;
  if p_team and (select count(*) from public.requirement_run where vehicle = car and uses_team_key
    and created_at > now() - interval '10 minutes') >= 6 then
    raise exception 'Run limit: six runs per ten minutes on the team key; add your own key in Settings';
  end if;
  insert into public.requirement_run (vehicle, options, weights, score_version, prompt_version, model, csv_name, csv_rows, actor, uses_team_key)
    values (car, p_run->'options', p_run->'weights', p_run->>'score_version', p_run->>'prompt_version', p_run->>'model',
      p_run->>'csv_name', nullif(p_run->'csv_rows', 'null'::jsonb), p_run->>'actor', p_team) returning id into rid;
  return rid;
end $$;
revoke all on function public.begin_requirement_run(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.begin_requirement_run(jsonb, boolean) to service_role;

-- Reserve a paid challenge slot before spending; failed attempts also count.
create or replace function public.reserve_requirement_challenge(p_id uuid, p_actor text, p_reason text, p_team boolean)
returns void language plpgsql set search_path = public, pg_temp as $$
begin
  if length(trim(p_reason)) < 5 then raise exception 'Give a reason (at least 5 characters)'; end if;
  perform pg_advisory_xact_lock(hashtext('requirements:challenge-budget'));
  if p_team and (select count(*) from public.requirement_event where action = 'challenge_requested'
    and at > now() - interval '10 minutes' and after->>'uses_team_key' = 'true') >= 12 then
    raise exception 'Run limit: twelve AI challenges per ten minutes on the team key; add your own key in Settings';
  end if;
  insert into public.requirement_event (requirement_id, actor_type, actor, action, after, reason)
    values (p_id, 'pm', p_actor, 'challenge_requested', jsonb_build_object('uses_team_key', p_team), p_reason);
end $$;
revoke all on function public.reserve_requirement_challenge(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.reserve_requirement_challenge(uuid, text, text, boolean) to service_role;
