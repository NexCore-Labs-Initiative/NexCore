alter table public.initiatives
  add column if not exists logo jsonb;

comment on column public.initiatives.logo is
  'Optional compact logo metadata for initiative shortcut cards. Expected shape: {"src":"https://..."} or {"src":"/assets/images/..."}';
