-- Gatilhos: regras que o schema do Drizzle não descreve. Cada comando é separado por `statement-breakpoint`.

-- Atualiza `atualizada_em` a cada alteração da linha (cursor do snapshot do modo offline).
CREATE FUNCTION definir_atualizada_em() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizada_em := now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER os_atualizada_em
  BEFORE UPDATE ON os
  FOR EACH ROW EXECUTE FUNCTION definir_atualizada_em();
--> statement-breakpoint

-- Um modelo publicado não aceita escrita: editar cria uma versão nova (Decisão-chave 6).
CREATE FUNCTION bloquear_modelo_publicado() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.publicado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Modelo % versão % já está publicado e não pode ser alterado', OLD.codigo, OLD.versao
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER modelo_apr_publicado_imutavel
  BEFORE UPDATE OR DELETE ON modelo_apr
  FOR EACH ROW EXECUTE FUNCTION bloquear_modelo_publicado();
--> statement-breakpoint

CREATE FUNCTION bloquear_item_de_modelo_publicado() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  alvo uuid := CASE WHEN TG_OP = 'INSERT' THEN NEW.modelo_apr_id ELSE OLD.modelo_apr_id END;
  publicado timestamptz;
BEGIN
  SELECT publicado_em INTO publicado FROM modelo_apr WHERE id = alvo;
  IF publicado IS NOT NULL THEN
    RAISE EXCEPTION 'Itens e riscos de um modelo publicado não podem ser alterados'
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER item_modelo_apr_publicado_imutavel
  BEFORE INSERT OR UPDATE OR DELETE ON item_modelo_apr
  FOR EACH ROW EXECUTE FUNCTION bloquear_item_de_modelo_publicado();
--> statement-breakpoint

-- Os riscos também são parte do modelo: a mesma regra dos itens (a função só usa `modelo_apr_id`).
CREATE TRIGGER risco_modelo_apr_publicado_imutavel
  BEFORE INSERT OR UPDATE OR DELETE ON risco_modelo_apr
  FOR EACH ROW EXECUTE FUNCTION bloquear_item_de_modelo_publicado();
