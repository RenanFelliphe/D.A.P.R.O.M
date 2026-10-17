CREATE TABLE "treinamento_servico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"atividade_codigo" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	CONSTRAINT "treinamento_servico_atividadeCodigo_unique" UNIQUE("atividade_codigo")
);
--> statement-breakpoint
ALTER TABLE "treinamento_servico" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "treinamento_servico_reporte" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"versao_id" uuid NOT NULL,
	"fase" integer,
	"usuario_id" uuid NOT NULL,
	"texto" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"tratado_em" timestamp with time zone,
	"tratado_por" uuid,
	CONSTRAINT "treinamento_servico_reporte_fase_check" CHECK ("treinamento_servico_reporte"."fase" is null or "treinamento_servico_reporte"."fase" >= 0),
	CONSTRAINT "treinamento_servico_reporte_texto_preenchido" CHECK (btrim("treinamento_servico_reporte"."texto") <> ''),
	CONSTRAINT "treinamento_servico_reporte_tratamento" CHECK (("treinamento_servico_reporte"."tratado_em" is null) = ("treinamento_servico_reporte"."tratado_por" is null))
);
--> statement-breakpoint
ALTER TABLE "treinamento_servico_reporte" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "treinamento_servico_resposta" (
	"tentativa_id" uuid NOT NULL,
	"fase" integer NOT NULL,
	"resposta" jsonb NOT NULL,
	"certa" boolean NOT NULL,
	"respondida_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "treinamento_servico_resposta_pkey" PRIMARY KEY("tentativa_id","fase"),
	CONSTRAINT "treinamento_servico_resposta_fase_check" CHECK ("treinamento_servico_resposta"."fase" >= 0)
);
--> statement-breakpoint
ALTER TABLE "treinamento_servico_resposta" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "treinamento_servico_tentativa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"treinamento_id" uuid NOT NULL,
	"versao_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"iniciada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"concluida_em" timestamp with time zone,
	"apresentacao" jsonb NOT NULL,
	"pre_visualizacao" boolean DEFAULT false NOT NULL,
	"pontuada" boolean DEFAULT false NOT NULL,
	"fases_certas" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "treinamento_servico_tentativa_fases_certas_check" CHECK ("treinamento_servico_tentativa"."fases_certas" between 0 and 10),
	CONSTRAINT "treinamento_servico_tentativa_pontuada_concluida" CHECK (not "treinamento_servico_tentativa"."pontuada" or "treinamento_servico_tentativa"."concluida_em" is not null),
	CONSTRAINT "treinamento_servico_tentativa_previa_sem_pontos" CHECK (not "treinamento_servico_tentativa"."pre_visualizacao" or not "treinamento_servico_tentativa"."pontuada")
);
--> statement-breakpoint
ALTER TABLE "treinamento_servico_tentativa" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "treinamento_servico_versao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"treinamento_id" uuid NOT NULL,
	"versao" integer NOT NULL,
	"estado" text DEFAULT 'rascunho' NOT NULL,
	"explicacao" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cenario_path" text,
	"texto_origem" text,
	"gerado_com_ia" boolean DEFAULT false NOT NULL,
	"rodadas_ia" integer DEFAULT 0 NOT NULL,
	"publicada_em" timestamp with time zone,
	"publicada_por" uuid,
	"assinatura_path" text,
	"termo" text,
	CONSTRAINT "treinamento_servico_versao_treinamento_id_versao_key" UNIQUE("treinamento_id","versao"),
	CONSTRAINT "treinamento_servico_versao_versao_check" CHECK ("treinamento_servico_versao"."versao" > 0),
	CONSTRAINT "treinamento_servico_versao_estado_check" CHECK ("treinamento_servico_versao"."estado" in ('rascunho', 'publicada', 'substituida')),
	CONSTRAINT "treinamento_servico_versao_rodadas_ia_check" CHECK ("treinamento_servico_versao"."rodadas_ia" >= 0),
	CONSTRAINT "treinamento_servico_versao_publicacao_completa" CHECK (("treinamento_servico_versao"."publicada_em" is null) = ("treinamento_servico_versao"."publicada_por" is null) and ("treinamento_servico_versao"."publicada_em" is null) = ("treinamento_servico_versao"."assinatura_path" is null)),
	CONSTRAINT "treinamento_servico_versao_estado_publicacao" CHECK (("treinamento_servico_versao"."estado" = 'rascunho') = ("treinamento_servico_versao"."publicada_em" is null))
);
--> statement-breakpoint
ALTER TABLE "treinamento_servico_versao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auditoria" DROP CONSTRAINT "auditoria_entidade_check";--> statement-breakpoint
ALTER TABLE "conquista" DROP CONSTRAINT "conquista_criterio_check";--> statement-breakpoint
ALTER TABLE "regra_pontuacao" DROP CONSTRAINT "regra_pontuacao_codigo_check";--> statement-breakpoint
ALTER TABLE "treinamento_servico" ADD CONSTRAINT "treinamento_servico_atividade_codigo_atividade_codigo_fk" FOREIGN KEY ("atividade_codigo") REFERENCES "public"."atividade"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treinamento_servico" ADD CONSTRAINT "treinamento_servico_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treinamento_servico_reporte" ADD CONSTRAINT "treinamento_servico_reporte_versao_id_treinamento_servico_versao_id_fk" FOREIGN KEY ("versao_id") REFERENCES "public"."treinamento_servico_versao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treinamento_servico_reporte" ADD CONSTRAINT "treinamento_servico_reporte_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treinamento_servico_reporte" ADD CONSTRAINT "treinamento_servico_reporte_tratado_por_usuario_id_fk" FOREIGN KEY ("tratado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treinamento_servico_resposta" ADD CONSTRAINT "treinamento_servico_resposta_tentativa_id_treinamento_servico_tentativa_id_fk" FOREIGN KEY ("tentativa_id") REFERENCES "public"."treinamento_servico_tentativa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treinamento_servico_tentativa" ADD CONSTRAINT "treinamento_servico_tentativa_treinamento_id_treinamento_servico_id_fk" FOREIGN KEY ("treinamento_id") REFERENCES "public"."treinamento_servico"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treinamento_servico_tentativa" ADD CONSTRAINT "treinamento_servico_tentativa_versao_id_treinamento_servico_versao_id_fk" FOREIGN KEY ("versao_id") REFERENCES "public"."treinamento_servico_versao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treinamento_servico_tentativa" ADD CONSTRAINT "treinamento_servico_tentativa_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treinamento_servico_versao" ADD CONSTRAINT "treinamento_servico_versao_treinamento_id_treinamento_servico_id_fk" FOREIGN KEY ("treinamento_id") REFERENCES "public"."treinamento_servico"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treinamento_servico_versao" ADD CONSTRAINT "treinamento_servico_versao_publicada_por_usuario_id_fk" FOREIGN KEY ("publicada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "treinamento_servico_reporte_versao_idx" ON "treinamento_servico_reporte" USING btree ("versao_id");--> statement-breakpoint
CREATE INDEX "treinamento_servico_reporte_pendentes_idx" ON "treinamento_servico_reporte" USING btree ("versao_id") WHERE "treinamento_servico_reporte"."tratado_em" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "treinamento_servico_tentativa_pontuada_idx" ON "treinamento_servico_tentativa" USING btree ("usuario_id","treinamento_id") WHERE "treinamento_servico_tentativa"."pontuada";--> statement-breakpoint
CREATE INDEX "treinamento_servico_tentativa_usuario_idx" ON "treinamento_servico_tentativa" USING btree ("usuario_id","treinamento_id");--> statement-breakpoint
CREATE UNIQUE INDEX "treinamento_servico_versao_rascunho_idx" ON "treinamento_servico_versao" USING btree ("treinamento_id") WHERE "treinamento_servico_versao"."estado" = 'rascunho';--> statement-breakpoint
CREATE UNIQUE INDEX "treinamento_servico_versao_publicada_idx" ON "treinamento_servico_versao" USING btree ("treinamento_id") WHERE "treinamento_servico_versao"."estado" = 'publicada';--> statement-breakpoint
CREATE INDEX "treinamento_servico_versao_treinamento_idx" ON "treinamento_servico_versao" USING btree ("treinamento_id");--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_entidade_check" CHECK ("auditoria"."entidade" in ('usuario', 'equipe', 'modelo_apr', 'atividade', 'material', 'os', 'importacao', 'exportacao', 'plano_preventiva', 'patente', 'conquista', 'regra_pontuacao', 'rh', 'ausencia', 'treinamento'));--> statement-breakpoint
ALTER TABLE "conquista" ADD CONSTRAINT "conquista_criterio_check" CHECK ("conquista"."criterio" in ('aprs_completas', 'responsavel_apr', 'execucoes_concluidas', 'preventivas_em_dia', 'locais_criticos', 'os_retomadas', 'os_apoio', 'tecnicos_novos', 'locais_diferentes', 'ciencias_no_prazo', 'intervalos_definidos', 'campo_de_treino', 'treinamentos_servico_concluidos', 'treinamentos_gabaritados', 'pontos_gerais', 'pontos_numa_temporada', 'patente', 'posicao', 'temporadas', 'aprs_da_equipe', 'execucoes_da_equipe', 'preventivas_em_dia_da_equipe', 'pontos_gerais_da_equipe', 'patente_da_equipe', 'posicao_da_equipe', 'temporadas_impecaveis'));--> statement-breakpoint
ALTER TABLE "regra_pontuacao" ADD CONSTRAINT "regra_pontuacao_codigo_check" CHECK ("regra_pontuacao"."codigo" in ('apr_completa', 'responsavel_apr', 'execucao_concluida', 'preventiva_em_dia', 'preventiva_concluida', 'local_critico', 'resgate', 'apoio', 'tecnico_novo', 'assinatura_cadastrada', 'treinamento_concluido', 'ciencia_no_prazo', 'intervalo_definido', 'conquista_obtida', 'treinamento_servico_concluido', 'treinamento_servico_fases'));
--> statement-breakpoint
-- Carga dos treinamentos de serviço (escrita à mão, seção 3.8 do vitoria.md e seção 13 do gameficacao.md): as 2 tarefas que
-- pontuam e as 3 conquistas novas. Os dados ficam em `treinamento-servico-dados.ts` (um teste confere que batem com esta
-- migração); as imagens dos troféus são gravadas pela subida da api, como as da migração 0016 (que esta não altera).
INSERT INTO "regra_pontuacao" ("codigo", "nome", "descricao", "pontos") VALUES
('treinamento_servico_concluido', 'Treinamento de serviço concluído', 'Concluir a explicação e o jogo de um treinamento de serviço.', 5),
('treinamento_servico_fases', 'Fases certas no treinamento', 'Acertar fases do jogo de um treinamento de serviço.', 1);
--> statement-breakpoint
INSERT INTO "conquista" ("id", "titulo", "descricao", "criterio", "quantidade", "patente_id", "pontos", "imagem_path") VALUES
('d0000000-0000-4000-8000-000000000001', 'Aprendiz', 'Concluiu os primeiros treinamentos de serviço.', 'treinamentos_servico_concluidos', 3, NULL, 25, 'd1000000-0000-4000-8000-000000000001'),
('d0000000-0000-4000-8000-000000000002', 'Especialista', 'Treinou em boa parte dos serviços do catálogo.', 'treinamentos_servico_concluidos', 10, NULL, 50, 'd1000000-0000-4000-8000-000000000002'),
('d0000000-0000-4000-8000-000000000003', 'Nota máxima', 'Gabaritou um treinamento de serviço na primeira tentativa.', 'treinamentos_gabaritados', 1, NULL, 25, 'd1000000-0000-4000-8000-000000000003');