CREATE TABLE "ia_funcao" (
	"funcao" text PRIMARY KEY NOT NULL,
	"ligada" boolean DEFAULT false NOT NULL,
	"com_dados" boolean DEFAULT false NOT NULL,
	"versao_do_texto" integer,
	"autorizado_por" uuid,
	"autorizado_em" timestamp with time zone,
	"assinatura_path" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	CONSTRAINT "ia_funcao_funcao_check" CHECK ("ia_funcao"."funcao" in ('chatbot', 'minigames', 'recomendacao', 'digitalizacao')),
	CONSTRAINT "ia_funcao_dados_exigem_funcao_ligada" CHECK (not "ia_funcao"."com_dados" or "ia_funcao"."ligada"),
	CONSTRAINT "ia_funcao_autorizacao" CHECK ("ia_funcao"."com_dados" = ("ia_funcao"."versao_do_texto" is not null and "ia_funcao"."autorizado_por" is not null and "ia_funcao"."autorizado_em" is not null and "ia_funcao"."assinatura_path" is not null))
);
--> statement-breakpoint
ALTER TABLE "ia_funcao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "os_recomendacao_apr" (
	"os_id" uuid PRIMARY KEY NOT NULL,
	"codigo" text,
	"fonte" text NOT NULL,
	"motivo" text,
	"encontradas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"chave" text NOT NULL,
	"analisada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"tentativas_ia" integer DEFAULT 0 NOT NULL,
	"proxima_ia_em" timestamp with time zone,
	CONSTRAINT "os_recomendacao_apr_fonte_check" CHECK ("os_recomendacao_apr"."fonte" in ('palavras', 'ia')),
	CONSTRAINT "os_recomendacao_apr_tentativas_check" CHECK ("os_recomendacao_apr"."tentativas_ia" >= 0)
);
--> statement-breakpoint
ALTER TABLE "os_recomendacao_apr" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auditoria" DROP CONSTRAINT "auditoria_entidade_check";--> statement-breakpoint
ALTER TABLE "ia_funcao" ADD CONSTRAINT "ia_funcao_autorizado_por_usuario_id_fk" FOREIGN KEY ("autorizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ia_funcao" ADD CONSTRAINT "ia_funcao_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os_recomendacao_apr" ADD CONSTRAINT "os_recomendacao_apr_os_id_os_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."os"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "os_recomendacao_apr_ia_pendente_idx" ON "os_recomendacao_apr" USING btree ("proxima_ia_em") WHERE "os_recomendacao_apr"."fonte" = 'palavras';--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_entidade_check" CHECK ("auditoria"."entidade" in ('usuario', 'equipe', 'modelo_apr', 'atividade', 'material', 'os', 'importacao', 'exportacao', 'plano_preventiva', 'patente', 'conquista', 'regra_pontuacao', 'rh', 'ausencia', 'treinamento', 'sugestao_materiais', 'ia_funcao'));