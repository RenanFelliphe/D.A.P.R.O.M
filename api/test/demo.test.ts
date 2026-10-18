import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { noMesmoDia, popularDemo, type ResultadoDemo } from "../src/db/seed/demo";
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

  it("a gamificação tem extrato, ranking, patentes e conquistas depois da demonstração", async () => {
    const [linha] = await amb.sql<{ n: number }>("select count(*)::int n from lancamento_pontos");
    assert.ok(linha!.n >= 20, `lançamentos: ${linha!.n}`);
    const regras = await amb.sql<{ regra: string }>("select distinct regra from lancamento_pontos");
    for (const r of ["apr_completa", "execucao_concluida", "responsavel_apr", "ciencia_no_prazo", "assinatura_cadastrada"]) assert.ok(regras.some((x) => x.regra === r), `sem lançamentos de ${r}`);
    assert.ok((await amb.sql("select 1 from conquista_usuario")).length >= 1);
    const [tecnico] = await amb.sql<{ email: string }>("select email from usuario where perfil = 'tecnico' and assinatura_path is not null limit 1");
    assert.ok(tecnico);
  });

  it("cobre todos os estados do fluxo", async () => {
    const status = await amb.sql<{ status: string; n: number }>("select status, count(*)::int n from os group by status");
    const por = Object.fromEntries(status.map((s) => [s.status, s.n])) as Record<string, number>;
    // Depois da execução a OS passa por `encerrando` (o responsável ainda não assinou) e `aguardando_supervisor` até a assinatura final.
    for (const s of ["liberada", "pendente", "em_execucao", "encerrando", "aguardando_supervisor", "encerrada", "cancelada"]) assert.ok(por[s]! > 0, `sem OS ${s}: ${JSON.stringify(por)}`);
    assert.ok(por.encerrada! >= 3 && por.aguardando_supervisor! >= 3 && por.liberada! >= 10);
    assert.ok(por.encerrando! + por.aguardando_supervisor! + por.encerrada! >= 7, "as sete OS executadas até o fim, em cada etapa da assinatura");

    const resultados = await amb.sql<{ resultado: string | null; n: number }>("select resultado, count(*)::int n from execucao group by resultado");
    const r = Object.fromEntries(resultados.map((x) => [String(x.resultado), x.n])) as Record<string, number>;
    assert.ok(r.encerrada! >= 6 && r.suspensa! >= 1 && r.interrompida! >= 1 && r["null"]! >= 3, JSON.stringify(r));
    // Só a execução da OS `encerrando` tem o tempo parado e o encerramento sem a assinatura do responsável; as demais encerradas estão assinadas.
    const [semAssinar] = await amb.sql<{ n: number; encerrando: number }>(
      "select count(*)::int n, count(*) filter (where o.status = 'encerrando')::int encerrando from execucao e join os o on o.id = e.os_id where e.resultado = 'encerrada' and e.encerramento_assinado_em is null",
    );
    assert.equal(semAssinar!.n, 1);
    assert.equal(semAssinar!.encerrando, 1);
    const [assinadas] = await amb.sql<{ n: number }>("select count(*)::int n from execucao e join os o on o.id = e.os_id where e.resultado = 'encerrada' and e.encerramento_assinado_em is not null and o.status in ('aguardando_supervisor', 'encerrada')");
    assert.ok(assinadas!.n >= 6, `encerramentos assinados: ${assinadas!.n}`);

    const aprs = await amb.sql<{ resultado: string; n: number }>("select resultado, count(*)::int n from apr group by resultado");
    assert.ok(aprs.some((a) => a.resultado === "bloqueada") && aprs.some((a) => a.resultado === "aprovada"));
    // Toda APR tem ao menos 2 participantes, e há uma aprovada esperando a assinatura de um técnico (ainda sem execução).
    const poucos = await amb.sql("select apr_id from apr_participante group by apr_id having count(*) < 2");
    assert.equal(poucos.length, 0, "APR com menos de 2 participantes");
    const esperando = await amb.sql<{ id: string }>(
      "select a.id from apr a join apr_participante p on p.apr_id = a.id where a.resultado = 'aprovada' and not exists (select 1 from execucao e where e.apr_id = a.id) group by a.id having count(*) filter (where p.assinada_em is null) > 0",
    );
    assert.equal(esperando.length, 1, "uma APR aguardando a assinatura");
    // As aprovadas que viraram execução foram assinadas por todos.
    const naoAssinadas = await amb.sql("select 1 from execucao e join apr_participante p on p.apr_id = e.apr_id where p.assinada_em is null and p.recusou_em is null");
    assert.equal(naoAssinadas.length, 0, "execução iniciada com APR sem todas as assinaturas");

    const tipos = await amb.sql<{ tipo: string }>("select distinct tipo from alerta");
    assert.ok(["bloqueio", "apoio_encerrado", "apr_para_assinar", "os_para_assinar"].every((t) => tipos.some((x) => x.tipo === t)), JSON.stringify(tipos));
    const lidos = await amb.sql<{ lido: boolean; n: number }>("select lido_em is not null as lido, count(*)::int n from alerta group by 1");
    assert.equal(lidos.length, 2, "há alertas lidos e não lidos");
  });

  it("tem OS de apoio, reprogramada, cancelada, com e sem ciência, e uma execução aberta há mais de 12 h", async () => {
    const [apoio] = await amb.sql("select 1 from os where os_origem_id is not null");
    assert.ok(apoio);
    assert.ok((await amb.sql("select 1 from reprogramacao")).length >= 1);
    assert.ok((await amb.sql("select 1 from os where status = 'cancelada' and cancelada_por is not null")).length >= 1);
    // A ciência é a assinatura final do supervisor: com ela a OS está `encerrada`; sem ela, `aguardando_supervisor` (ou `encerrando`, antes da assinatura do responsável).
    const ciencia = await amb.sql<{ status: string; com: boolean; n: number }>(
      "select status, ciencia_em is not null com, count(*)::int n from os where status in ('encerrada', 'aguardando_supervisor', 'encerrando') group by 1, 2",
    );
    const por = Object.fromEntries(ciencia.map((x) => [`${x.status}:${x.com}`, x.n])) as Record<string, number>;
    assert.ok(por["encerrada:true"]! >= 3, JSON.stringify(por));
    assert.ok(por["aguardando_supervisor:false"]! >= 3, JSON.stringify(por));
    assert.ok(por["encerrando:false"]! >= 1, JSON.stringify(por));
    assert.equal(por["encerrada:false"], undefined, "encerrada sem ciência não existe mais");
    assert.equal(por["aguardando_supervisor:true"], undefined);
    // Pausas e suspensões da demonstração têm o motivo obrigatório.
    assert.equal((await amb.sql("select 1 from execucao_pausa where motivo is null")).length, 0);
    assert.equal((await amb.sql("select 1 from execucao where resultado = 'suspensa' and suspensao_motivo is null")).length, 0);
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
    // O PDF só nasce com a assinatura final do supervisor: as OS que ainda esperam por ela não têm PDF.
    const antes = await amb.sql<{ numero_ordem: string }>("select numero_ordem from os where status in ('encerrando', 'aguardando_supervisor') and pdf_path is not null");
    assert.equal(antes.length, 0, `OS sem a assinatura final já com PDF: ${JSON.stringify(antes)}`);
  });

  it("o supervisor e o técnico enxergam os dados pela api", async () => {
    const eu = await amb.criarUsuario({ perfil: "admin" });
    const quadro = await amb.esperar(200, "GET", "/os", { como: eu, consulta: { tamanho: 100 } });
    assert.ok(quadro.os.length >= 24);
    const contagem = quadro.contagem_por_status as Record<string, number>;
    // Liberada, pendente, em execução, encerrando, aguardando o supervisor, encerrada e cancelada (só a devolvida ao SAP fica vazia).
    assert.equal(Object.values(contagem).filter((n) => n > 0).length, 7, JSON.stringify(contagem));
    assert.ok(contagem.encerrando! >= 1 && contagem.aguardando_supervisor! >= 3, JSON.stringify(contagem));
    const aguardando = await amb.esperar(200, "GET", "/os", { como: eu, consulta: { status: "aguardando_supervisor", tamanho: 100 } });
    assert.ok(aguardando.os.length >= 3 && aguardando.os.every((o: { status: string }) => o.status === "aguardando_supervisor"));
  });

  it("tem uma ausência em curso, uma agendada, uma vencida e um pedido aguardando o supervisor", async () => {
    const eu = await amb.criarUsuario({ perfil: "admin" });
    const r = await amb.esperar(200, "GET", "/ausencias", { como: eu, consulta: { tamanho: 100 } });
    const situacoes = r.ausencias.map((a: { situacao: string }) => a.situacao).sort();
    assert.deepEqual(situacoes, ["agendada", "em_curso", "pedida", "vencida"]);
    // O início das que já começaram foi aplicado, e o supervisor foi avisado da vencida.
    const aplicadas = await amb.sql<{ n: number }>("select count(*)::int n from ausencia where estado = 'confirmada' and inicio <= current_date + 1 and inicio_aplicado_em is not null");
    assert.equal(aplicadas[0]!.n, 2);
    const tipos = (await amb.sql<{ tipo: string }>("select distinct tipo from alerta where ausencia_id is not null")).map((t) => t.tipo).sort();
    assert.deepEqual(tipos, ["ausencia_pedida", "ausencia_registrada", "ausencia_vencida"]);
  });

  it("o ciclo das preventivas tem planos em cada situação e os alertas de ciclo", async () => {
    const eu = await amb.criarUsuario({ perfil: "admin" });
    const r = await amb.esperar(200, "GET", "/preventivas", { como: eu });
    for (const s of ["vencido", "proximo", "em_dia", "aguardando_execucao", "sem_intervalo"]) assert.ok(r.contagem[s] > 0, `sem plano ${s}: ${JSON.stringify(r.contagem)}`);
    const retificador = r.planos.find((p: { plano_manutencao: string }) => p.plano_manutencao === "10573");
    assert.equal(retificador.total_ciclos, 2);
    const tipos = (await amb.sql<{ tipo: string }>("select distinct tipo from alerta where plano_preventiva_id is not null")).map((t) => t.tipo).sort();
    assert.deepEqual(tipos, ["preventiva_proxima", "preventiva_vencida"]);
  });

  it("os planos de preventiva têm checklist de inspeção e as execuções dele o trazem preenchido, uma com item não marcado e o alerta", async () => {
    const planos = await amb.sql<{ plano_manutencao: string; perguntas: number }>(
      "select p.plano_manutencao, count(q.id)::int perguntas from plano_preventiva p join plano_preventiva_pergunta q on q.plano_id = p.id group by p.id, p.plano_manutencao order by 1",
    );
    assert.ok(planos.some((p) => p.plano_manutencao === "10573" && p.perguntas === 6), "o retificador tem o checklist do exemplo da OS 4019821");
    assert.ok(planos.length >= 2);
    const execucoes = await amb.sql<{ dados_inspecao: { itens: { marcado: boolean | null }[] } }>("select dados_inspecao from execucao e join os o on o.id = e.os_id where e.resultado = 'encerrada' and o.plano_manutencao = any($1)", [planos.map((p) => p.plano_manutencao)]);
    assert.ok(execucoes.length >= 3);
    assert.ok(execucoes.every((e) => e.dados_inspecao.itens.every((i) => i.marcado !== null)));
    assert.ok(execucoes.some((e) => e.dados_inspecao.itens.some((i) => i.marcado === false)));
    const avisos = await amb.sql<{ detalhe: string }>("select detalhe from alerta where tipo = 'inspecao_com_pendencia'");
    assert.ok(avisos.length >= 1);
    assert.match(avisos[0]!.detalhe, /gaxeta/);
  });

  it("rodar de novo não duplica nada", async () => {
    const antes = (await amb.sql<{ n: number }>("select count(*)::int n from os"))[0]!.n;
    const de_novo = await popularDemo(amb.deps);
    assert.equal(de_novo.jaPopulado, true);
    assert.equal((await amb.sql<{ n: number }>("select count(*)::int n from os"))[0]!.n, antes);
  });
});

describe("Dados de demonstração logo depois da meia-noite", () => {
  const diaEmBrasilia = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10);

  it("os cenários de agora ficam num dia só, a qualquer hora, sem passar de agora e com os mesmos intervalos", () => {
    const meiaNoite = Date.UTC(2026, 9, 14, 3); // 14/10/2026, 00:00 em Brasília
    for (let minuto = 0; minuto < 24 * 60; minuto++) {
      const agora = new Date(meiaNoite + minuto * 60_000);
      for (const passos of [[95, 80], [130, 115, 55]]) {
        const instantes = noMesmoDia(agora, passos);
        assert.equal(new Set(instantes.map(diaEmBrasilia)).size, 1, `${agora.toISOString()}: ${passos.join(", ")}`);
        assert.ok(instantes.every((t) => t <= agora), `${agora.toISOString()}: depois de agora`);
        for (let i = 1; i < passos.length; i++) assert.equal(instantes[i]!.getTime() - instantes[i - 1]!.getTime(), (passos[i - 1]! - passos[i]!) * 60_000);
      }
    }
  });

  // 01:25 e 01:58: a APR do cenário "em andamento" e a do "em pausa" cairiam no dia anterior ao do início da execução.
  for (const hora of ["04:25", "04:58"]) {
    it(`a carga completa roda às ${hora} UTC (${Number(hora.slice(0, 2)) - 3}h${hora.slice(3)} em Brasília)`, async () => {
      const amb = await criarAmbiente({ comCarga: true, relogio: new Date(`2026-10-14T${hora}:00Z`) });
      try {
        const r = await popularDemo(amb.deps);
        assert.equal(r.jaPopulado, false);
        const abertas = await amb.sql<{ apr: string; inicio: string }>(
          "select to_char(a.concluida_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') apr, to_char(e.inicio at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') inicio from execucao e join apr a on a.id = e.apr_id",
        );
        assert.ok(abertas.length >= 11 && abertas.every((x) => x.apr === x.inicio), JSON.stringify(abertas));
      } finally {
        await amb.fechar();
      }
    });
  }
});
