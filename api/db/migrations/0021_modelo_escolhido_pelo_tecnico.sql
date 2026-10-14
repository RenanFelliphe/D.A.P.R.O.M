CREATE TABLE "orientacao_modelo_apr" (
	"codigo" text PRIMARY KEY NOT NULL,
	"descricao" text DEFAULT '' NOT NULL,
	"exemplos" text[] DEFAULT '{}'::text[] NOT NULL,
	"palavras_chave" text[] DEFAULT '{}'::text[] NOT NULL,
	"atualizada_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orientacao_modelo_apr" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP INDEX "atividade_sem_modelo_idx";--> statement-breakpoint
ALTER TABLE "atividade" DROP COLUMN "modelo_apr_codigo";