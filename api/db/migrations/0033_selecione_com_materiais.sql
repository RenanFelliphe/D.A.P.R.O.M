-- O "Separar os itens" virou o Selecione "montado com os materiais do serviço" (funcionalidades/treinamentos-de-servico.md,
-- seção 10): cada fase "separar_itens" gravada passa a ser um "selecione" sem opções escritas e com `materiais`
-- (os mesmos `material_ids` e `quantidade_errados`), mantendo a ordem das fases e a meta da IA.
UPDATE "treinamento_servico_versao" AS v
SET "fases" = (
  SELECT jsonb_agg(
    CASE WHEN e.f->>'tipo' = 'separar_itens' THEN
      jsonb_strip_nulls(jsonb_build_object(
        'tipo', 'selecione',
        'enunciado', e.f->'enunciado',
        'opcoes', '[]'::jsonb,
        'materiais', jsonb_build_object('material_ids', e.f->'material_ids', 'quantidade_errados', e.f->'quantidade_errados'),
        'explicacao', e.f->'explicacao',
        'ia', e.f->'ia'
      ))
    ELSE e.f END
    ORDER BY e.ordem
  )
  FROM jsonb_array_elements(v."fases") WITH ORDINALITY AS e(f, ordem)
)
WHERE v."fases" @> '[{"tipo": "separar_itens"}]'::jsonb;
--> statement-breakpoint
-- As tentativas já abertas: a apresentação de "separar_itens" (os itens sorteados, já com nome) é a mesma do Selecione com materiais.
UPDATE "treinamento_servico_tentativa" AS t
SET "apresentacao" = jsonb_set(t."apresentacao", '{fases}', (
  SELECT jsonb_agg(
    CASE WHEN e.a->>'tipo' = 'separar_itens' THEN jsonb_build_object('tipo', 'selecione', 'itens', e.a->'itens') ELSE e.a END
    ORDER BY e.ordem
  )
  FROM jsonb_array_elements(t."apresentacao"->'fases') WITH ORDINALITY AS e(a, ordem)
))
WHERE t."apresentacao"->'fases' @> '[{"tipo": "separar_itens"}]'::jsonb;
