import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PASTA_MIGRACOES } from "../src/db/conexao";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const executar = async (cliente: PGlite, arquivo: string) => {
  for (const comando of readFileSync(join(PASTA_MIGRACOES, arquivo), "utf8").split("--> statement-breakpoint")) await cliente.exec(comando);
};

describe("Migração 0007: perfis só tecnico e admin; supervisor vira equipe.supervisor_id", () => {
  let cliente: PGlite;

  before(async () => {
    cliente = new PGlite();
    for (const a of ["0000_schema.sql", "0001_gatilhos.sql", "0002_os_cancelamento.sql", "0003_email_institucional.sql", "0004_os_origem_apoio.sql", "0005_alerta_falha_importacao.sql", "0006_modelo_apr_arquivado.sql"]) {
      await executar(cliente, a);
    }
    // Estado antigo: equipe 1 sem supervisor (dois supervisores por perfil), equipe 2 com supervisor já definido, equipe 3 sem nenhum.
    await cliente.exec(`
      insert into equipe (id, nome, centro_trabalho) values ('${id(1)}', 'E1', 'E1'), ('${id(2)}', 'E2', 'E2'), ('${id(3)}', 'E3', 'E3');
      insert into usuario (id, nome, matricula, email, perfil, equipe_id) values
        ('${id(10)}', 'Sup A', 'A', 'a@e.com', 'supervisor', '${id(1)}'),
        ('${id(11)}', 'Sup B', 'B', 'b@e.com', 'supervisor', '${id(1)}'),
        ('${id(12)}', 'Sup C', 'C', 'c@e.com', 'supervisor', '${id(2)}'),
        ('${id(13)}', 'Sup sem equipe', 'D', 'd@e.com', 'supervisor', null),
        ('${id(14)}', 'Tec', 'E', 'e@e.com', 'tecnico', '${id(3)}'),
        ('${id(15)}', 'Ana', 'F', 'f@e.com', 'analista', null),
        ('${id(16)}', 'Seg', 'G', 'g@e.com', 'seguranca', null),
        ('${id(17)}', 'Adm', 'H', 'h@e.com', 'admin', null);
      update equipe set supervisor_id = '${id(14)}' where id = '${id(2)}';
    `);
    await executar(cliente, "0007_supreme_white_queen.sql");
  });
  after(() => cliente.close());

  const perfil = async (n: number) => ((await cliente.query<{ perfil: string }>("select perfil from usuario where id = $1", [id(n)])).rows[0]!.perfil);
  const supervisorDe = async (n: number) => ((await cliente.query<{ supervisor_id: string | null }>("select supervisor_id from equipe where id = $1", [id(n)])).rows[0]!.supervisor_id);

  it("supervisor vira supervisor da própria equipe: só o primeiro por id, sem sobrescrever quem já existe", async () => {
    assert.equal(await supervisorDe(1), id(10));
    assert.equal(await supervisorDe(2), id(14));
    assert.equal(await supervisorDe(3), null);
  });

  it("supervisor vira técnico; analista e segurança viram admin; os demais ficam", async () => {
    for (const n of [10, 11, 12, 13, 14]) assert.equal(await perfil(n), "tecnico", String(n));
    for (const n of [15, 16, 17]) assert.equal(await perfil(n), "admin", String(n));
  });

  it("o banco só aceita tecnico e admin depois da migração", async () => {
    for (const p of ["supervisor", "analista", "seguranca"]) {
      await assert.rejects(() => cliente.query("insert into usuario (id, nome, matricula, email, perfil) values ($1, 'X', $2, $3, $4)", [id(30), `X${p}`, `${p}@e.com`, p]), /usuario_perfil_check/, p);
    }
  });
});
