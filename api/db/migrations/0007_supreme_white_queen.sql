-- Perfis passam a ser só `tecnico` e `admin`. Supervisor deixa de ser perfil e vira quem consta em `equipe.supervisor_id`
-- (todo supervisor é técnico); `analista` e `seguranca` (que nunca usa o sistema) viram `admin`.
ALTER TABLE "usuario" DROP CONSTRAINT "usuario_perfil_check";--> statement-breakpoint

-- (a) O supervisor por perfil vira supervisor da própria equipe, se ela ainda não tem um; com mais de um na mesma equipe,
-- só o primeiro por id.
UPDATE "equipe" e SET "supervisor_id" = s."id"
FROM (
  SELECT DISTINCT ON ("equipe_id") "id", "equipe_id"
  FROM "usuario"
  WHERE "perfil" = 'supervisor' AND "equipe_id" IS NOT NULL
  ORDER BY "equipe_id", "id"
) s
WHERE e."id" = s."equipe_id" AND e."supervisor_id" IS NULL;--> statement-breakpoint

-- (b) e (c)
UPDATE "usuario" SET "perfil" = 'tecnico' WHERE "perfil" = 'supervisor';--> statement-breakpoint
UPDATE "usuario" SET "perfil" = 'admin' WHERE "perfil" IN ('analista', 'seguranca');--> statement-breakpoint

ALTER TABLE "usuario" ADD CONSTRAINT "usuario_perfil_check" CHECK ("usuario"."perfil" in ('tecnico', 'admin'));
