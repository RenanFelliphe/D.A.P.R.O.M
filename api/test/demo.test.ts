import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { popularDemo, type ResultadoDemo } from "../src/db/seed/demo";
import { executarTarefasPendentes } from "../src/servicos/tarefas";
import { criarAmbiente, type Ambiente } from "./ajuda";

describe("Dados de demonstração", () => {
  let amb: Ambiente;
  let resultado: ResultadoDemo;

  before(async () => {
    amb = await criarAmbiente({ comCarga: true });
    resultado = await popularDemo(amb.deps);
  });
  after(() => amb.fechar());

  it("popula usuários, equipes, OS, APRs, execuções, alertas e tarefas", async () => {
    assert.equal(resultado.jaPopulado, false);
    assert.ok(resultado.usuariosCriados.length >= 8, "cria os usuários que não existiam");
    assert.ok(resultado.usuariosCriados.every((u) => u.senha.length >= 8));
    const c = resultado.contagem as Record<string, number>;
    assert.ok(c.os! >= 24, `OS: ${c.os}`);
    assert.ok(c.apr! >= 14, `APRs: ${c.apr}`);
    assert.ok(c.execucoes! >= 11, `execuções: ${c.execucoes}`);
    assert.ok(c.alertas! >= 4, `alertas: ${c.alertas}`);
  });

  it("cobre todos os estados do fluxo", async () => {
    const status = await amb.sql<{ status: string; n: number }>("select status, count(*)::int n from os group by status");
    const por = Object.fromEntries(status.map((s) => [s.status, s.n])) as Record<string, number>;
    for (const s of ["liberada", "pendente", "em_execucao", "encerrada", "cancelada"]) assert.ok(por[s]! > 0, `sem OS ${s}: ${JSON.stringify(por)}`);
    assert.ok(por.encerrada! >= 6 && por.liberada! >= 10);

    const resultados = await amb.sql<{ resultado: string | null; n: number }>("select resultado, count(*)::int n from execucao group by resultado");
    const r = Object.fromEntries(resultados.map((x) => [String(x.resultado), x.n])) as Record<string, number>;
    assert.ok(r.encerrada! >= 6 && r.suspensa! >= 1 && r.interrompida! >= 1 && r["null"]! >= 3, JSON.stringify(r));

    const aprs = await amb.sql<{ resultado: string; n: number }>("select resultado, count(*)::int n from apr group by resultado");
    assert.ok(aprs.some((a) => a.resultado === "bloqueada") && aprs.some((a) => a.resultado === "aprovada"));

    const tipos = await amb.sql<{ tipo: string }>("select distinct tipo from alerta");
    assert.ok(["bloqueio", "apoio_encerrado"].every((t) => tipos.some((x) => x.tipo === t)), JSON.stringify(tipos));
    const lidos = await amb.sql<{ lido: boolean; n: number }>("select lido_em is not null as lido, count(*)::int n from alerta group by 1");
    assert.equal(lidos.length, 2, "há alertas lidos e não lidos");
  });

  it("tem OS de apoio, reprogramada, cancelada, com e sem ciência, e uma execução aberta há mais de 12 h", async () => {
    const [apoio] = await amb.sql("select 1 from os where os_origem_id is not null");
    assert.ok(apoio);
    assert.ok((await amb.sql("select 1 from reprogramacao")).length >= 1);
    assert.ok((await amb.sql("select 1 from os where status = 'cancelada' and cancelada_por is not null")).length >= 1);
    const ciencia = await amb.sql<{ com: boolean; n: number }>("select ciencia_em is not null com, count(*)::int n from os where status = 'encerrada' group by 1");
    assert.equal(ciencia.length, 2, "encerradas com e sem ciência");
    const velha = await amb.sql("select 1 from execucao where resultado is null and inicio < now() - interval '12 hours'");
    assert.ok(velha.length >= 1);
    // pausa aberta agora
    assert.ok((await amb.sql("select 1 from execucao_pausa where fim is null")).length >= 1);
  });

  it("as tarefas de PDF geram os PDFs das OS encerradas", async () => {
    amb.relogio.agora = new Date(Date.now() + 120_000); // as tarefas nasceram no relógio real, depois do relógio fixo do ambiente
    await executarTarefasPendentes(amb.deps);
    await executarTarefasPendentes(amb.deps);
    const sem = await amb.sql<{ numero_ordem: string }>("select numero_ordem from os where status = 'encerrada' and pdf_path is null");
    assert.equal(sem.length, 0, `encerradas sem PDF: ${JSON.stringify(sem)}`);
    const falhas = await amb.sql<{ erro: string }>("select erro from tarefa where estado = 'falhou' or erro is not null");
    assert.equal(falhas.length, 0, JSON.stringify(falhas));
  });

  it("o supervisor e o técnico enxergam os dados pela api", async () => {
    const eu = await amb.criarUsuario({ perfil: "admin" });
    const quadro = await amb.esperar(200, "GET", "/os", { como: eu, consulta: { tamanho: 100 } });
    assert.ok(quadro.os.length >= 24);
    assert.ok(Object.values(quadro.contagem_por_status as Record<string, number>).filter((n) => n > 0).length === 5);
  });

  it("rodar de novo não duplica nada", async () => {
    const antes = (await amb.sql<{ n: number }>("select count(*)::int n from os"))[0]!.n;
    const de_novo = await popularDemo(amb.deps);
    assert.equal(de_novo.jaPopulado, true);
    assert.equal((await amb.sql<{ n: number }>("select count(*)::int n from os"))[0]!.n, antes);
  });
});
