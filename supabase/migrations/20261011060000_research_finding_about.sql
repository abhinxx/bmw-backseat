-- Research findings say WHAT they are about: the BMW being researched, a named rival, or the market.
-- The "agrees / contradicts BMW data" label only makes sense for findings about the BMW itself.
alter table public.research_finding
  add column about_kind text check (about_kind in ('bmw', 'competitor', 'market')),
  add column about text;   -- e.g. 'BMW 5 Series', 'Mercedes-Benz E-Class', 'premium EV buyers'
