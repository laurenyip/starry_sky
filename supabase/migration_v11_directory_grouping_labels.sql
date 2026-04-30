alter table public.directories
  add column if not exists grouping_label_1 text default 'Locations',
  add column if not exists grouping_label_2 text default 'Constellations';
