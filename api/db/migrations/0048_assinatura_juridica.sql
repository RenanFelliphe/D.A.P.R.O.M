CREATE TABLE "assinatura_juridica" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"resumo" text,
	"os_id" uuid,
	"situacao" text NOT NULL,
	"provedor" text,
	"documento_id" text,
	"url_assinatura" text,
	"pdf_path" text,
	"origem_offline" boolean DEFAULT false NOT NULL,
	"ato" text,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"assinada_em" timestamp with time zone,
	"usada_em" timestamp with time zone,
	CONSTRAINT "assinatura_juridica_situacao_check" CHECK ("assinatura_juridica"."situacao" in ('pendente_offline', 'aguardando', 'assinada', 'recusada', 'falhou')),
	CONSTRAINT "assinatura_juridica_documento_completo" CHECK (("assinatura_juridica"."situacao" = 'pendente_offline') = ("assinatura_juridica"."documento_id" is null)),
	CONSTRAINT "assinatura_juridica_assinada_completa" CHECK (("assinatura_juridica"."situacao" = 'assinada') = ("assinatura_juridica"."assinada_em" is not null))
);
--> statement-breakpoint
ALTER TABLE "assinatura_juridica" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "assinatura_juridica" ADD CONSTRAINT "assinatura_juridica_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assinatura_juridica" ADD CONSTRAINT "assinatura_juridica_os_id_os_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."os"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assinatura_juridica_documento_key" ON "assinatura_juridica" USING btree ("documento_id");--> statement-breakpoint
CREATE INDEX "assinatura_juridica_usuario_idx" ON "assinatura_juridica" USING btree ("usuario_id","criada_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "assinatura_juridica_pendentes_idx" ON "assinatura_juridica" USING btree ("usuario_id") WHERE "assinatura_juridica"."situacao" = 'pendente_offline';