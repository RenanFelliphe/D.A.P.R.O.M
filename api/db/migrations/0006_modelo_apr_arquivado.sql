-- Excluir um modelo de APR que já foi publicado o arquiva: ele sai das listas e das APRs novas, mas as versões ficam,
-- porque APRs, PDFs e a APR offline que ainda vai chegar apontam para elas. O rascunho não é arquivado (é apagado).
-- Idempotente: um rascunho anterior desta migração (só com a coluna) chegou a ser aplicado em bancos de desenvolvimento.
ALTER TABLE "modelo_apr" ADD COLUMN IF NOT EXISTS "arquivado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "modelo_apr" DROP CONSTRAINT IF EXISTS "modelo_apr_arquivado_publicado";--> statement-breakpoint
ALTER TABLE "modelo_apr" ADD CONSTRAINT "modelo_apr_arquivado_publicado" CHECK ("modelo_apr"."arquivado_em" is null or "modelo_apr"."publicado_em" is not null);--> statement-breakpoint

-- A versão publicada continua imutável (Decisão-chave 6); arquivar e restaurar, que só mudam `arquivado_em`, é a
-- única escrita que ela aceita.
CREATE OR REPLACE FUNCTION bloquear_modelo_publicado() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.publicado_em IS NOT NULL THEN
    IF TG_OP = 'UPDATE' AND to_jsonb(NEW) - 'arquivado_em' = to_jsonb(OLD) - 'arquivado_em' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Modelo % versão % já está publicado e não pode ser alterado', OLD.codigo, OLD.versao
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
