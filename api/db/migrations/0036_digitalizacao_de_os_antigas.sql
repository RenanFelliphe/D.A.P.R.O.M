CREATE TABLE "digitalizacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"nome_arquivo" text NOT NULL,
	"arquivo" text NOT NULL,
	"paginas" integer DEFAULT 0 NOT NULL,
	"paginas_lidas" integer DEFAULT 0 NOT NULL,
	"estado" text DEFAULT 'lendo' NOT NULL,
	"etapa" text DEFAULT 'preparando' NOT NULL,
	"leitura" jsonb,
	"usou_ia" boolean DEFAULT false NOT NULL,
	"erro" text,
	"importacao_id" uuid,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "digitalizacao_estado_check" CHECK ("digitalizacao"."estado" in ('lendo', 'lida', 'falhou', 'registrada')),
	CONSTRAINT "digitalizacao_etapa_check" CHECK ("digitalizacao"."etapa" in ('preparando', 'ocr', 'ia', 'conferindo')),
	CONSTRAINT "digitalizacao_paginas_check" CHECK ("digitalizacao"."paginas" >= 0 and "digitalizacao"."paginas_lidas" >= 0 and "digitalizacao"."paginas_lidas" <= "digitalizacao"."paginas"),
	CONSTRAINT "digitalizacao_registrada_com_importacao" CHECK ("digitalizacao"."estado" <> 'registrada' or "digitalizacao"."importacao_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "digitalizacao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "os_digitalizacao" (
	"os_id" uuid PRIMARY KEY NOT NULL,
	"digitalizacao_id" uuid NOT NULL,
	"paginas" jsonb NOT NULL,
	"inicio_real" timestamp with time zone,
	"fim_real" timestamp with time zone,
	"numero_pessoas" integer,
	"texto_manuscrito" text,
	"manuscrito_fonte" text DEFAULT 'nenhuma' NOT NULL,
	"registrada_por" uuid NOT NULL,
	"registrada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "os_digitalizacao_fonte_check" CHECK ("os_digitalizacao"."manuscrito_fonte" in ('ia', 'manual', 'nenhuma')),
	CONSTRAINT "os_digitalizacao_fim_apos_inicio" CHECK ("os_digitalizacao"."fim_real" is null or "os_digitalizacao"."inicio_real" is null or "os_digitalizacao"."fim_real" >= "os_digitalizacao"."inicio_real"),
	CONSTRAINT "os_digitalizacao_pessoas_check" CHECK ("os_digitalizacao"."numero_pessoas" is null or "os_digitalizacao"."numero_pessoas" >= 1)
);
--> statement-breakpoint
ALTER TABLE "os_digitalizacao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tarefa" DROP CONSTRAINT "tarefa_tipo_check";--> statement-breakpoint
ALTER TABLE "importacao" DROP CONSTRAINT "importacao_origem_check";--> statement-breakpoint
ALTER TABLE "os" DROP CONSTRAINT "os_origem_check";--> statement-breakpoint
ALTER TABLE "digitalizacao" ADD CONSTRAINT "digitalizacao_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digitalizacao" ADD CONSTRAINT "digitalizacao_importacao_id_importacao_id_fk" FOREIGN KEY ("importacao_id") REFERENCES "public"."importacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os_digitalizacao" ADD CONSTRAINT "os_digitalizacao_os_id_os_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."os"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os_digitalizacao" ADD CONSTRAINT "os_digitalizacao_digitalizacao_id_digitalizacao_id_fk" FOREIGN KEY ("digitalizacao_id") REFERENCES "public"."digitalizacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os_digitalizacao" ADD CONSTRAINT "os_digitalizacao_registrada_por_usuario_id_fk" FOREIGN KEY ("registrada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "digitalizacao_abertas_idx" ON "digitalizacao" USING btree ("criada_em" DESC NULLS LAST) WHERE "digitalizacao"."estado" <> 'registrada';--> statement-breakpoint
CREATE INDEX "os_digitalizacao_lote_idx" ON "os_digitalizacao" USING btree ("digitalizacao_id");--> statement-breakpoint
ALTER TABLE "tarefa" ADD CONSTRAINT "tarefa_tipo_check" CHECK ("tarefa"."tipo" in ('pdf_os', 'email_alerta', 'email_resumo', 'leitura_sap', 'leitura_rh', 'conferencia_rh', 'digitalizacao'));--> statement-breakpoint
ALTER TABLE "importacao" ADD CONSTRAINT "importacao_origem_check" CHECK ("importacao"."origem" in ('api', 'planilha', 'pdf', 'digitalizacao'));--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_origem_check" CHECK ("os"."origem" in ('sap', 'planilha', 'pdf', 'apoio', 'digitalizacao'));