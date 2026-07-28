alter table public.listas_evento
add column if not exists meta_pixel_id text;

notify pgrst, 'reload schema';
