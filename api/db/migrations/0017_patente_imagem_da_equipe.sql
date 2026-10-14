-- Cada patente passa a ter duas imagens: a das pessoas (`imagem_path`, que já existia) e a das equipes. As duas só são iguais
-- se o admin enviar a mesma imagem nos dois campos. A coluna nasce nula para preencher as linhas que já existem e só então
-- vira obrigatória; o script é idempotente (o servidor de desenvolvimento reaplica ao reiniciar).
ALTER TABLE "patente" ADD COLUMN IF NOT EXISTS "imagem_equipe_path" text;--> statement-breakpoint
-- As 5 patentes da carga inicial ganham o brasão próprio das equipes (a subida da api grava os arquivos que faltarem).
UPDATE "patente" SET "imagem_equipe_path" = CASE "id" WHEN 'a0000000-0000-4000-8000-000000000001' THEN 'a2000000-0000-4000-8000-000000000001' WHEN 'a0000000-0000-4000-8000-000000000002' THEN 'a2000000-0000-4000-8000-000000000002' WHEN 'a0000000-0000-4000-8000-000000000003' THEN 'a2000000-0000-4000-8000-000000000003' WHEN 'a0000000-0000-4000-8000-000000000004' THEN 'a2000000-0000-4000-8000-000000000004' WHEN 'a0000000-0000-4000-8000-000000000005' THEN 'a2000000-0000-4000-8000-000000000005' END WHERE "id" IN ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000005') AND "imagem_equipe_path" IS NULL;--> statement-breakpoint
-- As outras (criadas pelo admin antes desta migração) começam apontando para a mesma imagem das pessoas: o admin troca pela
-- das equipes em "Patentes".
UPDATE "patente" SET "imagem_equipe_path" = "imagem_path" WHERE "imagem_equipe_path" IS NULL;--> statement-breakpoint
ALTER TABLE "patente" ALTER COLUMN "imagem_equipe_path" SET NOT NULL;
