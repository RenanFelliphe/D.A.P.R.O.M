CREATE TABLE "ordem_sap_simulada" (
	"numero_ordem" text PRIMARY KEY NOT NULL,
	"numero_nota" text,
	"tipo_ordem" text NOT NULL,
	"tipo_atividade" text,
	"codigo_atividade" text,
	"titulo" text NOT NULL,
	"descricao" text,
	"centro_trabalho" text NOT NULL,
	"local_codigo" text NOT NULL,
	"local_endereco" text,
	"local_plus_code" text,
	"local_cliente" text,
	"equipamento" text,
	"prioridade" text,
	"data_inicio_prog" date NOT NULL,
	"data_fim_prog" date,
	"status_sap" text,
	"solicitante" text,
	"criado_por" text,
	"criada_em" timestamp with time zone,
	"plano_manutencao" text,
	"item_manutencao" text,
	"intervalo_ciclo" jsonb,
	"alterada_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ordem_sap_simulada" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "ordem_sap_simulada_alterada_idx" ON "ordem_sap_simulada" USING btree ("alterada_em");