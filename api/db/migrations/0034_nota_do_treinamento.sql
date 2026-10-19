ALTER TABLE "treinamento_servico_tentativa" DROP CONSTRAINT "treinamento_servico_tentativa_fases_certas_check";--> statement-breakpoint
ALTER TABLE "treinamento_servico_resposta" ADD COLUMN "acertos" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "treinamento_servico_resposta" ADD COLUMN "possiveis" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "treinamento_servico_resposta" ADD COLUMN "tempo_ms" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "treinamento_servico_resposta" ADD COLUMN "pontos" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "treinamento_servico_resposta" ADD COLUMN "confirmada" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "treinamento_servico_tentativa" ADD COLUMN "tempos" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "treinamento_servico_tentativa" ADD COLUMN "progresso" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "treinamento_servico_tentativa" ADD COLUMN "nota" integer;--> statement-breakpoint
ALTER TABLE "treinamento_servico_resposta" ADD CONSTRAINT "treinamento_servico_resposta_acertos_check" CHECK ("treinamento_servico_resposta"."acertos" between 0 and "treinamento_servico_resposta"."possiveis");--> statement-breakpoint
ALTER TABLE "treinamento_servico_resposta" ADD CONSTRAINT "treinamento_servico_resposta_pontos_check" CHECK ("treinamento_servico_resposta"."pontos" between 0 and 10);--> statement-breakpoint
ALTER TABLE "treinamento_servico_tentativa" ADD CONSTRAINT "treinamento_servico_tentativa_nota_check" CHECK ("treinamento_servico_tentativa"."nota" is null or "treinamento_servico_tentativa"."nota" >= 0);--> statement-breakpoint
ALTER TABLE "treinamento_servico_tentativa" ADD CONSTRAINT "treinamento_servico_tentativa_fases_certas_check" CHECK ("treinamento_servico_tentativa"."fases_certas" >= 0);