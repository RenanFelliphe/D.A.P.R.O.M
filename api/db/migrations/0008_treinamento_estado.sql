ALTER TABLE "usuario" ADD COLUMN "treinamento_estado" text DEFAULT 'nao_iniciado' NOT NULL;--> statement-breakpoint
ALTER TABLE "usuario" ADD COLUMN "treinamento_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_treinamento_estado_check" CHECK ("usuario"."treinamento_estado" in ('nao_iniciado', 'concluido', 'pulado'));--> statement-breakpoint

-- Quem já usa o sistema não precisa da boas-vindas do Campo de treino: os usuários existentes ficam como `pulado`.
-- Os novos nascem `nao_iniciado` (default da coluna).
UPDATE "usuario" SET "treinamento_estado" = 'pulado', "treinamento_em" = now();
