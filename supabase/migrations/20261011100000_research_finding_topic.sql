-- research-v4: findings carry a short topic label from the model (e.g. "wheel alignment"), shown when none of
-- the 16 features fits, and searches record which social platform they targeted.
alter table public.research_finding add column topic text;
