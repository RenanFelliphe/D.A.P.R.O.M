-- A trilha de auditoria só cresce: alterar ou apagar uma linha é recusado.
CREATE FUNCTION bloquear_alteracao_da_auditoria() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'A trilha de auditoria não aceita alterar nem apagar registros'
    USING ERRCODE = 'check_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER auditoria_so_cresce
  BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_da_auditoria();
