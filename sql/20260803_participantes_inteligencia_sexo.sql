alter table public.participantes
  add column if not exists sexo_estimado text,
  add column if not exists confianca_sexo numeric,
  add column if not exists metodo_classificacao text,
  add column if not exists motor_inteligencia text,
  add column if not exists versao_motor text,
  add column if not exists classificado_em timestamptz;

notify pgrst, 'reload schema';
