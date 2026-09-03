alter table public.projects
  add column if not exists logo_url text;

comment on column public.projects.logo_url is
  'Optional publicly accessible square logo URL used for project identity surfaces such as navigation shortcuts.';
