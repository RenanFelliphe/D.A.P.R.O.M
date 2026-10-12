-- Usuários que já existem não têm e-mail institucional: recebem um provisório (`<matrícula>@empresa.com.br`) para a
-- coluna poder ser obrigatória. O script `pnpm usuarios:migrar-emails` troca pelo e-mail real e acerta a conta no Supabase Auth.
UPDATE "usuario" SET "email" = lower(btrim("email")) WHERE "email" IS NOT NULL;--> statement-breakpoint
UPDATE "usuario" SET "email" = lower(btrim("matricula")) || '@empresa.com.br' WHERE "email" IS NULL;--> statement-breakpoint
ALTER TABLE "usuario" DROP CONSTRAINT "usuario_supervisor_com_email";--> statement-breakpoint
ALTER TABLE "usuario" ALTER COLUMN "email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_email_unique" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_email_minusculo" CHECK ("usuario"."email" = lower("usuario"."email"));