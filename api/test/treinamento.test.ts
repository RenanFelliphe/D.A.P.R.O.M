import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PASTA_MIGRACOES } from "../src/db/conexao";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

describe("Campo de treino: estado por usuário", () => {
  let amb: Ambiente;
  let tecnico: UsuarioDeTeste;
  let admin: UsuarioDeTeste;

  before(async () => {
    amb = await criarAmbiente();
    tecnico = await amb.criarUsuario({ perfil: "tecnico" });
    admin = await amb.criarUsuario({ perfil: "admin" });
  });
  after(() => amb.fechar());

  it("usuário novo nasce nao_iniciado e GET /me devolve treinamento", async () => {
    const eu = await amb.esperar(200, "GET", "/me", { como: tecnico });
    assert.deepEqual(eu.usuario.treinamento, { estado: "nao_iniciado", em: null });
    assert.deepEqual((await amb.esperar(200, "GET", "/me", { como: admin })).usuario.treinamento, { estado: "nao_iniciado", em: null });
  });

  it("PUT /me/treinamento grava concluido, pulado e nao_iniciado (refazer), de forma idempotente", async () => {
    const agora = amb.relogio.agora.toISOString();
    for (const estado of ["concluido", "pulado", "pulado"]) {
      const r = await amb.esperar(200, "PUT", "/me/treinamento", { como: tecnico, json: { estado } });
      assert.deepEqual(r.treinamento, { estado, em: agora });
      assert.deepEqual((await amb.esperar(200, "GET", "/me", { como: tecnico })).usuario.treinamento, { estado, em: agora });
    }
    const refazer = await amb.esperar(200, "PUT", "/me/treinamento", { como: tecnico, json: { estado: "nao_iniciado" } });
    assert.deepEqual(refazer.treinamento, { estado: "nao_iniciado", em: null });
  });

  it("o estado é de cada usuário", async () => {
    await amb.esperar(200, "PUT", "/me/treinamento", { como: tecnico, json: { estado: "concluido" } });
    assert.equal((await amb.esperar(200, "GET", "/me", { como: admin })).usuario.treinamento.estado, "nao_iniciado");
  });

  it("estado inválido ou ausente é 422", async () => {
    for (const json of [{ estado: "feito" }, {}]) {
      assert.equal((await amb.req("PUT", "/me/treinamento", { como: tecnico, json })).status, 422);
    }
  });

  it("sem token é 401", async () => {
    assert.equal((await amb.req("PUT", "/me/treinamento", { json: { estado: "pulado" } })).status, 401);
  });
});

describe("Migração 0008: usuários existentes ficam pulado", () => {
  it("quem já existia vira pulado com a data; quem entra depois nasce nao_iniciado", async () => {
    const cliente = new PGlite();
    try {
      const executar = async (arquivo: string) => {
        for (const comando of readFileSync(join(PASTA_MIGRACOES, arquivo), "utf8").split("--> statement-breakpoint")) await cliente.exec(comando);
      };
      for (const a of ["0000_schema.sql", "0001_gatilhos.sql", "0002_os_cancelamento.sql", "0003_email_institucional.sql", "0004_os_origem_apoio.sql", "0005_alerta_falha_importacao.sql", "0006_modelo_apr_arquivado.sql", "0007_supreme_white_queen.sql"]) await executar(a);
      await cliente.exec(`insert into usuario (id, nome, matricula, email, perfil) values ('00000000-0000-4000-8000-000000000001', 'Antigo', 'A', 'a@e.com', 'tecnico')`);
      await executar("0008_treinamento_estado.sql");
      await cliente.exec(`insert into usuario (id, nome, matricula, email, perfil) values ('00000000-0000-4000-8000-000000000002', 'Novo', 'B', 'b@e.com', 'tecnico')`);
      const { rows } = await cliente.query<{ matricula: string; treinamento_estado: string; tem_data: boolean }>("select matricula, treinamento_estado, treinamento_em is not null as tem_data from usuario order by matricula");
      assert.deepEqual(rows, [
        { matricula: "A", treinamento_estado: "pulado", tem_data: true },
        { matricula: "B", treinamento_estado: "nao_iniciado", tem_data: false },
      ]);
    } finally {
      await cliente.close();
    }
  });
});
