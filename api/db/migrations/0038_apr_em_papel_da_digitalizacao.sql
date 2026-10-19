CREATE TABLE "os_digitalizacao_apr" (
	"os_id" uuid PRIMARY KEY NOT NULL,
	"digitalizacao_id" uuid NOT NULL,
	"paginas" jsonb NOT NULL,
	"modelo_apr_id" uuid NOT NULL,
	"data_hora" timestamp with time zone,
	"servico" text,
	"participantes" jsonb NOT NULL,
	"respostas" jsonb NOT NULL,
	"manuscrito_fonte" text DEFAULT 'nenhuma' NOT NULL,
	"registrada_por" uuid NOT NULL,
	"registrada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "os_digitalizacao_apr_fonte_check" CHECK ("os_digitalizacao_apr"."manuscrito_fonte" in ('ia', 'manual', 'nenhuma'))
);
--> statement-breakpoint
ALTER TABLE "os_digitalizacao_apr" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "os_digitalizacao_apr" ADD CONSTRAINT "os_digitalizacao_apr_os_id_os_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."os"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os_digitalizacao_apr" ADD CONSTRAINT "os_digitalizacao_apr_digitalizacao_id_digitalizacao_id_fk" FOREIGN KEY ("digitalizacao_id") REFERENCES "public"."digitalizacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os_digitalizacao_apr" ADD CONSTRAINT "os_digitalizacao_apr_modelo_apr_id_modelo_apr_id_fk" FOREIGN KEY ("modelo_apr_id") REFERENCES "public"."modelo_apr"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os_digitalizacao_apr" ADD CONSTRAINT "os_digitalizacao_apr_registrada_por_usuario_id_fk" FOREIGN KEY ("registrada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "os_digitalizacao_apr_modelo_idx" ON "os_digitalizacao_apr" USING btree ("modelo_apr_id");