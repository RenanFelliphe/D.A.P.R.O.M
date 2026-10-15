CREATE TABLE "plano_preventiva_pergunta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plano_id" uuid NOT NULL,
	"texto" text NOT NULL,
	"posicao" integer NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plano_preventiva_pergunta_texto_check" CHECK (btrim("plano_preventiva_pergunta"."texto") <> '' and char_length("plano_preventiva_pergunta"."texto") <= 300),
	CONSTRAINT "plano_preventiva_pergunta_posicao_check" CHECK ("plano_preventiva_pergunta"."posicao" >= 0)
);
--> statement-breakpoint
ALTER TABLE "plano_preventiva_pergunta" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "alerta" DROP CONSTRAINT "alerta_tipo_check";--> statement-breakpoint
ALTER TABLE "regra_pontuacao" DROP CONSTRAINT "regra_pontuacao_codigo_check";--> statement-breakpoint
ALTER TABLE "plano_preventiva_pergunta" ADD CONSTRAINT "plano_preventiva_pergunta_plano_id_plano_preventiva_id_fk" FOREIGN KEY ("plano_id") REFERENCES "public"."plano_preventiva"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plano_preventiva_pergunta_plano_idx" ON "plano_preventiva_pergunta" USING btree ("plano_id","posicao");--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_tipo_check" CHECK ("alerta"."tipo" in ('bloqueio', 'conflito_planejamento', 'execucao_duplicada', 'apoio_encerrado', 'falha_importacao', 'preventiva_proxima', 'preventiva_vencida', 'inspecao_com_pendencia'));--> statement-breakpoint
ALTER TABLE "regra_pontuacao" ADD CONSTRAINT "regra_pontuacao_codigo_check" CHECK ("regra_pontuacao"."codigo" in ('apr_completa', 'responsavel_apr', 'execucao_concluida', 'preventiva_em_dia', 'preventiva_concluida', 'local_critico', 'resgate', 'apoio', 'tecnico_novo', 'assinatura_cadastrada', 'treinamento_concluido', 'ciencia_no_prazo', 'intervalo_definido', 'conquista_obtida'));--> statement-breakpoint
-- Carga da tarefa nova (escrita à mão): a preventiva concluída vale o dobro da corretiva, então entra com o mesmo valor da
-- "Execução concluída" (10). Não é lançada para as preventivas já encerradas, como as demais tarefas acrescentadas depois.
INSERT INTO "regra_pontuacao" ("codigo", "nome", "descricao", "pontos") VALUES
('preventiva_concluida', 'Preventiva concluída', 'Concluir uma OS preventiva: a preventiva vale o dobro da corretiva.', 10);
