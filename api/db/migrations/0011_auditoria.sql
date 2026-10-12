CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"em" timestamp with time zone DEFAULT now() NOT NULL,
	"ator_id" uuid NOT NULL,
	"ator_nome" text NOT NULL,
	"acao" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" text,
	"alvo" text,
	"resumo" text NOT NULL,
	"detalhes" jsonb,
	CONSTRAINT "auditoria_entidade_check" CHECK ("auditoria"."entidade" in ('usuario', 'equipe', 'modelo_apr', 'atividade', 'os', 'importacao', 'exportacao'))
);
--> statement-breakpoint
ALTER TABLE "auditoria" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "auditoria_em_idx" ON "auditoria" USING btree ("em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "auditoria_entidade_idx" ON "auditoria" USING btree ("entidade","entidade_id");--> statement-breakpoint
CREATE INDEX "auditoria_ator_idx" ON "auditoria" USING btree ("ator_id");