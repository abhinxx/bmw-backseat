-- Deck export (docs/DECK-EXPORT-SPEC.md): one PDF decision memo per stored What-If run.
-- Written only by the server (service role). Anyone can read the status; the files sit in a private bucket
-- and are streamed by /api/deck/file.

create table public.deck_export (
  run_id        uuid primary key references public.simulation_run (id) on delete cascade,
  status        text not null check (status in ('generating', 'ready', 'failed')),
  pdf_path      text,                 -- path in storage bucket 'decks'
  png_path      text,                 -- cover image, if one was generated
  copy          jsonb,                -- the narrative copy that went into the PDF
  copy_source   text,                 -- 'model' or 'fallback' (validator rejected the model copy)
  image_prompt  text,                 -- the exact prompt sent to the image model, footer included
  model         text,
  image_model   text,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.deck_export enable row level security;
create policy "read deck_export" on public.deck_export for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.deck_export from anon, authenticated;

insert into storage.buckets (id, name, public)
values ('decks', 'decks', false)
on conflict (id) do nothing;
