-- Intervalo entre ciclos das preventivas: `plano_preventiva` (plano e item de manutenção do SAP, com o intervalo), os alertas
-- `preventiva_proxima` e `preventiva_vencida` ligados ao plano e `plano_preventiva` na auditoria. Os planos das OS que já
-- existem entram sem intervalo, para o admin definir.
CREATE TABLE "plano_preventiva" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plano_manutencao" text NOT NULL,
	"item_manutencao" text,
	"intervalo_quantidade" integer,
	"intervalo_unidade" text,
	"contar_a_partir" text DEFAULT 'execucao' NOT NULL,
	"antecedencia_dias" integer DEFAULT 7 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"observacao" text,
	"alerta_proximo_para" date,
	"alerta_vencido_para" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	CONSTRAINT "plano_preventiva_plano_item_key" UNIQUE NULLS NOT DISTINCT("plano_manutencao","item_manutencao"),
	CONSTRAINT "plano_preventiva_unidade_check" CHECK ("plano_preventiva"."intervalo_unidade" in ('dia', 'semana', 'quinzena', 'mes', 'bimestre', 'trimestre', 'semestre', 'ano')),
	CONSTRAINT "plano_preventiva_base_check" CHECK ("plano_preventiva"."contar_a_partir" in ('execucao', 'programacao')),
	CONSTRAINT "plano_preventiva_intervalo_completo" CHECK (("plano_preventiva"."intervalo_quantidade" is null) = ("plano_preventiva"."intervalo_unidade" is null)),
	CONSTRAINT "plano_preventiva_quantidade_check" CHECK ("plano_preventiva"."intervalo_quantidade" is null or "plano_preventiva"."intervalo_quantidade" between 1 and 999),
	CONSTRAINT "plano_preventiva_antecedencia_check" CHECK ("plano_preventiva"."antecedencia_dias" between 0 and 365),
	CONSTRAINT "plano_preventiva_plano_preenchido" CHECK (btrim("plano_preventiva"."plano_manutencao") <> '')
);
--> statement-breakpoint
ALTER TABLE "plano_preventiva" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auditoria" DROP CONSTRAINT "auditoria_entidade_check";--> statement-breakpoint
ALTER TABLE "alerta" DROP CONSTRAINT "alerta_tipo_check";--> statement-breakpoint
ALTER TABLE "alerta" ADD COLUMN "plano_preventiva_id" uuid;--> statement-breakpoint
ALTER TABLE "plano_preventiva" ADD CONSTRAINT "plano_preventiva_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_plano_preventiva_id_plano_preventiva_id_fk" FOREIGN KEY ("plano_preventiva_id") REFERENCES "public"."plano_preventiva"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "os_plano_idx" ON "os" USING btree ("plano_manutencao","item_manutencao") WHERE "os"."plano_manutencao" is not null;--> statement-breakpoint
CREATE INDEX "alerta_plano_idx" ON "alerta" USING btree ("plano_preventiva_id") WHERE "alerta"."plano_preventiva_id" is not null;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_entidade_check" CHECK ("auditoria"."entidade" in ('usuario', 'equipe', 'modelo_apr', 'atividade', 'material', 'os', 'importacao', 'exportacao', 'plano_preventiva'));--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_plano_so_na_preventiva" CHECK (("alerta"."tipo" in ('preventiva_proxima', 'preventiva_vencida')) = ("alerta"."plano_preventiva_id" is not null));--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_tipo_check" CHECK ("alerta"."tipo" in ('bloqueio', 'conflito_planejamento', 'execucao_duplicada', 'apoio_encerrado', 'falha_importacao', 'preventiva_proxima', 'preventiva_vencida'));--> statement-breakpoint
INSERT INTO "plano_preventiva" ("plano_manutencao", "item_manutencao")
SELECT DISTINCT btrim("plano_manutencao"), nullif(btrim("item_manutencao"), '') FROM "os"
WHERE "tipo" = 'preventiva' AND nullif(btrim("plano_manutencao"), '') IS NOT NULL
ON CONFLICT DO NOTHING;