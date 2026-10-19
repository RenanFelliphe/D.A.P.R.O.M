-- 1. A conversão da 0033 de novo (idempotente: só pega o que ainda for "separar_itens"). A 0033 foi gerada vazia e
-- preenchida logo depois; se o servidor de desenvolvimento a aplicou nesse intervalo, o banco dele ficou sem a conversão.
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
UPDATE "treinamento_servico_tentativa" AS t
SET "apresentacao" = jsonb_set(t."apresentacao", '{fases}', (
  SELECT jsonb_agg(
    CASE WHEN e.a->>'tipo' = 'separar_itens' THEN jsonb_build_object('tipo', 'selecione', 'itens', e.a->'itens') ELSE e.a END
    ORDER BY e.ordem
  )
  FROM jsonb_array_elements(t."apresentacao"->'fases') WITH ORDINALITY AS e(a, ordem)
))
WHERE t."apresentacao"->'fases' @> '[{"tipo": "separar_itens"}]'::jsonb;
--> statement-breakpoint
-- 2. A nota das respostas e tentativas de antes dela (funcionalidades/treinamentos-de-servico.md, seção 12): cada fase era
-- tudo ou nada (1 acerto possível) e o tempo não era registrado, então entra com o multiplicador 1,0 (10 pontos se certa).
UPDATE "treinamento_servico_resposta"
SET "acertos" = CASE WHEN "certa" THEN 1 ELSE 0 END, "possiveis" = 1, "pontos" = CASE WHEN "certa" THEN 10 ELSE 0 END
WHERE "pontos" = 0 AND "certa";
--> statement-breakpoint
UPDATE "treinamento_servico_tentativa" AS t
SET "nota" = round(
  coalesce((SELECT sum(r."pontos") FROM "treinamento_servico_resposta" AS r WHERE r."tentativa_id" = t."id"), 0)
  * jsonb_array_length(v."fases") * 10
)::integer
FROM "treinamento_servico_versao" AS v
WHERE v."id" = t."versao_id" AND t."concluida_em" IS NOT NULL AND t."nota" IS NULL;
