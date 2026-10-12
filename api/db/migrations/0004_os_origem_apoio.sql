-- A OS não é mais criada à mão: ela vem do SAP ou da planilha. A única que nasce no sistema é a de apoio, que ganha
-- origem própria (`apoio`, antes gravada como `manual`) e é sempre ligada à OS que destrava (`os_origem_id`).
ALTER TABLE "os" DROP CONSTRAINT "os_origem_check";--> statement-breakpoint
ALTER TABLE "os" DROP CONSTRAINT "os_numero_ordem_obrigatorio";--> statement-breakpoint
UPDATE "os" SET "origem" = 'apoio' WHERE "origem" = 'manual' AND "os_origem_id" IS NOT NULL;--> statement-breakpoint
-- OS manual sem vínculo que ninguém usou (sem APR, execução, evento, alerta, reprogramação nem OS de apoio filha) não
-- guarda registro nenhum e sai. Se alguma já foi usada, a migração para: apagar o registro de campo não é decisão dela.
DELETE FROM "os" o WHERE o."origem" = 'manual'
  AND NOT EXISTS (SELECT 1 FROM "apr" WHERE "apr"."os_id" = o."id")
  AND NOT EXISTS (SELECT 1 FROM "execucao" WHERE "execucao"."os_id" = o."id")
  AND NOT EXISTS (SELECT 1 FROM "evento_campo" WHERE "evento_campo"."os_id" = o."id")
  AND NOT EXISTS (SELECT 1 FROM "alerta" WHERE "alerta"."os_id" = o."id")
  AND NOT EXISTS (SELECT 1 FROM "reprogramacao" WHERE "reprogramacao"."os_id" = o."id")
  AND NOT EXISTS (SELECT 1 FROM "os" f WHERE f."os_origem_id" = o."id");--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "os" WHERE "origem" = 'manual') THEN
    RAISE EXCEPTION 'Há OS manual já usada (com APR, execução, evento, alerta, reprogramação ou OS de apoio ligada a ela). A OS manual deixou de existir: trate essas OS à mão (ex.: cancelar e arquivar) e rode a migração de novo.';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_apoio_ligada" CHECK (("os"."origem" = 'apoio') = ("os"."os_origem_id" is not null));--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_origem_check" CHECK ("os"."origem" in ('sap', 'planilha', 'apoio'));--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_numero_ordem_obrigatorio" CHECK ("os"."numero_ordem" is not null or "os"."origem" = 'apoio');
