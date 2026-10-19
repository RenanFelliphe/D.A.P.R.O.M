ALTER TABLE "conquista" DROP CONSTRAINT "conquista_criterio_check";--> statement-breakpoint
ALTER TABLE "evento_campo" ADD COLUMN "offline" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "conquista" ADD CONSTRAINT "conquista_criterio_check" CHECK ("conquista"."criterio" in ('aprs_completas', 'responsavel_apr', 'execucoes_concluidas', 'preventivas_em_dia', 'locais_criticos', 'os_retomadas', 'os_apoio', 'tecnicos_novos', 'locais_diferentes', 'ciencias_no_prazo', 'intervalos_definidos', 'campo_de_treino', 'treinamentos_servico_concluidos', 'treinamentos_gabaritados', 'sincronizacoes_offline', 'pontos_gerais', 'pontos_numa_temporada', 'patente', 'posicao', 'temporadas', 'aprs_da_equipe', 'execucoes_da_equipe', 'preventivas_em_dia_da_equipe', 'pontos_gerais_da_equipe', 'patente_da_equipe', 'posicao_da_equipe', 'temporadas_impecaveis'));
--> statement-breakpoint
-- Escrito à mão (pendência 8, conquista de sincronização offline). Os eventos que já chegaram pela fila (mais de 60 s entre o relógio do
-- aparelho e o da api, a regra de `ATRASO_OFFLINE_MS`) são marcados agora, para a conquista contar o histórico.
UPDATE "evento_campo" SET "offline" = true WHERE "recebido_em" - "ocorrido_em" > interval '60 seconds';
--> statement-breakpoint
-- A conquista nova. O dado fica em `sincronizacao-offline-dados.ts` (um teste confere que bate com esta migração); a imagem do troféu é
-- gravada pela subida da api, como as das migrações 0016 e 0027. Vale 0 ponto: a sincronização não pontua (regra 2.2 do gameficacao.md).
INSERT INTO "conquista" ("id", "titulo", "descricao", "criterio", "quantidade", "patente_id", "pontos", "imagem_path") VALUES
('e0000000-0000-4000-8000-000000000001', 'Sem sinal, sem problema', 'Trabalhou onde o sinal não chega e o registro chegou ao painel quando ele voltou.', 'sincronizacoes_offline', 1, NULL, 0, 'e1000000-0000-4000-8000-000000000001');

--> statement-breakpoint
-- Vale para o passado (seção 7.1 do gameficacao.md): quem já tinha trabalhado sem sinal recebe o troféu, com a data da primeira chegada. Sem pontos,
-- não há lançamento a fazer; o aviso "Conquista desbloqueada" fica pendente (vista_em nulo).
INSERT INTO "conquista_usuario" ("conquista_id", "usuario_id", "obtida_em")
SELECT 'e0000000-0000-4000-8000-000000000001', e."usuario_id", min(e."recebido_em")
FROM "evento_campo" e JOIN "usuario" u ON u."id" = e."usuario_id"
WHERE e."offline" AND e."os_id" IS NOT NULL AND u."perfil" = 'tecnico' AND u."ativo"
GROUP BY e."usuario_id"
ON CONFLICT DO NOTHING;
