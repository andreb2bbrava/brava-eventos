ALTER TABLE participantes
ADD COLUMN IF NOT EXISTS nome_normalizado TEXT;

UPDATE participantes
SET nome_normalizado = lower(regexp_replace(regexp_replace(trim(unnest(string_to_array(nome, ' '))) , '\s+', ' ', 'g'), '[^a-zA-Z0-9 ]', '', 'g'))
WHERE nome_normalizado IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS participantes_lista_nome_normalizado_unique_idx
ON participantes (lista_id, nome_normalizado);
