import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { alerta, apr, aprResposta, evidencia, execucao, tarefa, usuario } from "../src/db/schema";
import { agendarLeituraSap, executarTarefasPendentes, iniciarTarefas, recuperarTarefasPresas } from "../src/servicos/tarefas";
import { manipularEmailAlerta } from "../src/servicos/pdf-os";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";
import { criarAlerta, criarOs, hora } from "./fixture-os";

const AGORA = new Date("2026-10-10T15:00:00Z");
const emMin = (min: number, base: Date = AGORA) => new Date(base.getTime() + min * 60_000);

describe("Executor de tarefas", () => {
  let amb: Ambiente;
  let equipeId: string;
  let supervisor: UsuarioDeTeste;

  before(async () => {
    amb = await criarAmbiente({ relogio: AGORA });
    equipeId = (await amb.criarEquipe()).id;
    supervisor = await amb.criarUsuario({ perfil: "tecnico", equipeId, supervisor: true });
  });
  after(() => amb.fechar());

  const reiniciar = async () => {
    amb.relogio.agora = AGORA;
    await amb.db.delete(tarefa);
  };
  const criar = async (d: { tipo?: string; referenciaId?: string | null; proximaEm?: Date; estado?: string; tentativas?: number }) => {
    const [t] = await amb.db
      .insert(tarefa)
      .values({ tipo: (d.tipo ?? "email_alerta") as "pdf_os", referenciaId: d.referenciaId ?? null, proximaEm: d.proximaEm ?? AGORA, estado: (d.estado ?? "pendente") as "pendente", tentativas: d.tentativas ?? 0 })
      .returning();
    return t!;
  };
  const ler = async (id: string) => (await amb.db.select().from(tarefa).where(eq(tarefa.id, id)))[0]!;
  /** Alerta que não é de bloqueio: o manipulador conclui sem enviar nada. */
  const alertaQueConclui = async () => {
    const o = await criarOs(amb, { equipeId });
    return criarAlerta(amb, { osId: o.osId, destinatarioId: supervisor.id, tipo: "apoio_encerrado" });
  };

  it("sucesso: a tarefa vencida vira concluida", async () => {
    await reiniciar();
    const a = await alertaQueConclui();
    const t = await criar({ referenciaId: a.id });
    assert.equal(await executarTarefasPendentes(amb.deps), 1);
    const depois = await ler(t.id);
    assert.equal(depois.estado, "concluida");
    assert.equal(depois.tentativas, 0);
    assert.equal(depois.erro, null);
    assert.equal(await executarTarefasPendentes(amb.deps), 0, "concluída não volta");
  });

  it("falha: espera crescente de 1, 5, 15 e 15 minutos e, na 5ª falha, fica falhou", async () => {
    await reiniciar();
    const o = await criarOs(amb, { equipeId }); // OS sem execução encerrada: o PDF falha sempre
    const t = await criar({ tipo: "pdf_os", referenciaId: o.osId });

    const esperas = [1, 5, 15, 15];
    for (let i = 0; i < esperas.length; i++) {
      assert.equal(await executarTarefasPendentes(amb.deps), 1, `tentativa ${i + 1}`);
      const f = await ler(t.id);
      assert.equal(f.estado, "pendente");
      assert.equal(f.tentativas, i + 1);
      assert.match(f.erro ?? "", /Execução encerrada/);
      assert.deepEqual(f.proximaEm, emMin(esperas[i]!, amb.relogio.agora));

      // Antes da hora, nada acontece.
      amb.relogio.agora = emMin(esperas[i]! - 1, amb.relogio.agora);
      assert.equal(await executarTarefasPendentes(amb.deps), 0);
      amb.relogio.agora = emMin(1, amb.relogio.agora);
    }
    assert.equal(await executarTarefasPendentes(amb.deps), 1);
    const final = await ler(t.id);
    assert.equal(final.estado, "falhou");
    assert.equal(final.tentativas, 5);
    amb.relogio.agora = emMin(60, amb.relogio.agora);
    assert.equal(await executarTarefasPendentes(amb.deps), 0, "falhou não é tentada de novo");
  });

  it("falha e depois sucesso: a tarefa que melhora na segunda tentativa conclui", async () => {
    await reiniciar();
    const o = await criarOs(amb, { equipeId });
    const t = await criar({ tipo: "pdf_os", referenciaId: o.osId });
    await executarTarefasPendentes(amb.deps);
    assert.equal((await ler(t.id)).tentativas, 1);

    // A OS encerra entre as tentativas.
    const encerrada = await criarOs(amb, { equipeId, encerrada: true });
    await amb.db.update(tarefa).set({ referenciaId: encerrada.osId }).where(eq(tarefa.id, t.id));
    amb.relogio.agora = emMin(1);
    assert.equal(await executarTarefasPendentes(amb.deps), 1);
    const depois = await ler(t.id);
    assert.equal(depois.estado, "concluida");
    assert.equal(depois.tentativas, 1);
    assert.ok(amb.armazenamento.arquivos.has(`pdfs/${encerrada.osId}`));
  });

  it("não pega tarefa futura", async () => {
    await reiniciar();
    const t = await criar({ proximaEm: emMin(1), referenciaId: (await alertaQueConclui()).id });
    assert.equal(await executarTarefasPendentes(amb.deps), 0);
    assert.equal((await ler(t.id)).estado, "pendente");
    amb.relogio.agora = emMin(1);
    assert.equal(await executarTarefasPendentes(amb.deps), 1);
  });

  it("processa na ordem de proxima_em", async () => {
    await reiniciar();
    const enviados = amb.email.enviados.length;
    const ordens: string[] = [];
    // Criadas fora de ordem; vencem em 3, 1 e 2 minutos atrás.
    for (const atras of [1, 3, 2]) {
      const o = await criarOs(amb, { equipeId, numeroOrdem: `ORD-${atras}` });
      const a = await criarAlerta(amb, { osId: o.osId, destinatarioId: supervisor.id });
      await criar({ referenciaId: a.id, proximaEm: emMin(-atras) });
      ordens.push(`ORD-${atras}`);
    }
    assert.equal(await executarTarefasPendentes(amb.deps), 3);
    const assuntos = amb.email.enviados.slice(enviados).map((m) => m.assunto);
    assert.deepEqual(
      assuntos.map((s) => s.match(/ORD-\d/)![0]),
      ["ORD-3", "ORD-2", "ORD-1"],
    );
  });

  it("dois executores ao mesmo tempo não repetem a tarefa", async () => {
    await reiniciar();
    const enviados = amb.email.enviados.length;
    for (let i = 0; i < 4; i++) {
      const o = await criarOs(amb, { equipeId });
      const a = await criarAlerta(amb, { osId: o.osId, destinatarioId: supervisor.id });
      await criar({ referenciaId: a.id });
    }
    const [x, y] = await Promise.all([executarTarefasPendentes(amb.deps), executarTarefasPendentes(amb.deps)]);
    assert.equal(x + y, 4);
    assert.equal(amb.email.enviados.length - enviados, 4);
  });

  it("tipo desconhecido vai direto para falhou", async () => {
    await reiniciar();
    await amb.sql("alter table tarefa drop constraint tarefa_tipo_check");
    const [t] = await amb.sql<{ id: string }>("insert into tarefa (tipo, proxima_em) values ('inexistente', $1) returning id", [AGORA.toISOString()]);
    assert.equal(await executarTarefasPendentes(amb.deps), 1);
    const f = await ler(t!.id);
    assert.equal(f.estado, "falhou");
    assert.match(f.erro ?? "", /desconhecido/);
    await amb.sql("delete from tarefa");
  });

  it("recupera a em_andamento há mais de 10 minutos e deixa a recente quieta", async () => {
    await reiniciar();
    const velha = await criar({ estado: "em_andamento", proximaEm: emMin(-11), tentativas: 2 });
    const recente = await criar({ estado: "em_andamento", proximaEm: emMin(-9) });
    assert.equal(await recuperarTarefasPresas(amb.deps), 1);
    const v = await ler(velha.id);
    assert.equal(v.estado, "pendente");
    assert.equal(v.tentativas, 2);
    assert.deepEqual(v.proximaEm, AGORA);
    assert.equal((await ler(recente.id)).estado, "em_andamento");
  });

  it("agenda leitura_sap sem referência, uma só enquanto houver pendente ou em andamento", async () => {
    await reiniciar();
    assert.equal(await agendarLeituraSap(amb.deps), true);
    assert.equal(await agendarLeituraSap(amb.deps), false);
    const [t] = await amb.db.select().from(tarefa);
    assert.equal(t!.tipo, "leitura_sap");
    assert.equal(t!.referenciaId, null);
    await amb.db.update(tarefa).set({ estado: "em_andamento" });
    assert.equal(await agendarLeituraSap(amb.deps), false);
    await amb.db.update(tarefa).set({ estado: "concluida" });
    assert.equal(await agendarLeituraSap(amb.deps), true);
  });

  it("iniciarTarefas roda o executor logo na partida e devolve a função que o para; sem SAP_API_URL não agenda leitura", async () => {
    await reiniciar();
    const a = await alertaQueConclui();
    const t = await criar({ referenciaId: a.id });
    const parar = iniciarTarefas({ ...amb.deps, config: { ...amb.deps.config, sapApiUrl: "" } });
    try {
      for (let i = 0; i < 100 && (await ler(t.id)).estado !== "concluida"; i++) await new Promise((r) => setTimeout(r, 50));
      assert.equal((await ler(t.id)).estado, "concluida");
      assert.equal((await amb.db.select().from(tarefa).where(eq(tarefa.tipo, "leitura_sap"))).length, 0);
    } finally {
      parar();
    }
  });
});

describe("E-mail de alerta de bloqueio", () => {
  let amb: Ambiente;
  let equipeId: string;
  let supervisor: UsuarioDeTeste;
  let admin: UsuarioDeTeste;

  before(async () => {
    amb = await criarAmbiente({ relogio: new Date("2026-10-10T15:00:00Z") });
    equipeId = (await amb.criarEquipe()).id;
    supervisor = await amb.criarUsuario({ perfil: "tecnico", equipeId, supervisor: true });
    admin = await amb.criarUsuario({ perfil: "admin" });
  });
  after(() => amb.fechar());

  const tarefaDe = (alertaId: string | null) => ({ id: "t", referenciaId: alertaId });

  /** OS com uma tentativa anterior encerrada e uma APR bloqueada depois, com 1 item reprovado e 2 fotos. */
  async function cenarioDeBloqueio() {
    const o = await criarOs(amb, { equipeId, encerrada: true, numeroOrdem: `4023${Math.floor(Math.random() * 1e6)}`, status: "pendente" });
    const aprBloqueada = randomUUID();
    await amb.db.insert(apr).values({ id: aprBloqueada, osId: o.osId, modeloAprId: o.modeloId, preenchidaPor: o.executanteId, resultado: "bloqueada", concluidaEm: hora("2026-10-10T10:00:00Z") });
    await amb.db.insert(aprResposta).values({ aprId: aprBloqueada, itemId: o.itens[0]!, resposta: "nao", observacao: "Sem sinalização no local", respondidaEm: hora("2026-10-10T10:00:00Z") });
    const fotos = [randomUUID(), randomUUID()];
    for (const fotoPath of fotos) {
      await amb.db.insert(evidencia).values({ id: randomUUID(), aprId: aprBloqueada, itemId: o.itens[0]!, fotoPath, capturadaEm: hora("2026-10-10T10:00:00Z") });
    }
    const a = await criarAlerta(amb, { osId: o.osId, destinatarioId: supervisor.id, detalhe: "APR bloqueada", criadoEm: hora("2026-10-10T10:05:00Z") });
    return { o, a, fotos };
  }

  it("envia ao supervisor com OS, local, técnico, itens reprovados, observações, links das fotos e link do painel; marca email_enviado_em", async () => {
    const { o, a, fotos } = await cenarioDeBloqueio();
    await manipularEmailAlerta(amb.deps, tarefaDe(a.id));

    assert.equal(amb.email.enviados.length, 1);
    const m = amb.email.enviados[0]!;
    const [local] = await amb.sql<{ codigo: string }>("select codigo from local_instalacao where id = $1", [o.localId]);
    assert.equal(m.para, `${(await amb.sql<{ email: string }>("select email from usuario where id = $1", [supervisor.id]))[0]!.email}`);
    assert.match(m.assunto, new RegExp(o.numeroOrdem));
    for (const esperado of [
      o.numeroOrdem,
      local!.codigo,
      "Damião Pestana", // quem preencheu a APR bloqueada
      "O local está sinalizado?",
      "Sem sinalização no local",
      ...fotos.map((f) => `https://storage.local/fotos/${f}?expira=${7 * 24 * 3600}`),
      `http://painel.local/app/os/${o.osId}`,
    ]) {
      assert.ok(m.texto.includes(esperado), `faltou "${esperado}" no texto`);
      assert.ok((m.html ?? "").includes(esperado.replace(/&/g, "&amp;")), `faltou "${esperado}" no html`);
    }
    const [depois] = await amb.db.select().from(alerta).where(eq(alerta.id, a.id));
    assert.deepEqual(depois!.emailEnviadoEm, amb.relogio.agora);
  });

  it("reenvio da tarefa não duplica o e-mail", async () => {
    const { a } = await cenarioDeBloqueio();
    const antes = amb.email.enviados.length;
    await manipularEmailAlerta(amb.deps, tarefaDe(a.id));
    await manipularEmailAlerta(amb.deps, tarefaDe(a.id));
    assert.equal(amb.email.enviados.length - antes, 1);
  });

  it("execução interrompida: o e-mail traz o motivo, as fotos da execução e o executor como técnico", async () => {
    const o = await criarOs(amb, { equipeId, encerrada: true, status: "pendente" });
    const novaApr = randomUUID();
    await amb.db.insert(apr).values({ id: novaApr, osId: o.osId, modeloAprId: o.modeloId, preenchidaPor: o.executanteId, resultado: "aprovada", concluidaEm: hora("2026-10-10T10:00:00Z") });
    const execId = randomUUID();
    await amb.db.insert(execucao).values({ id: execId, osId: o.osId, aprId: novaApr, executorId: o.supervisorDaAprId, numeroPessoas: 2, inicio: hora("2026-10-10T10:10:00Z"), fim: hora("2026-10-10T10:20:00Z"), resultado: "interrompida", motivo: "Vazamento de gás detectado" });
    const foto = randomUUID();
    await amb.db.insert(evidencia).values({ id: randomUUID(), execucaoId: execId, fotoPath: foto, capturadaEm: hora("2026-10-10T10:15:00Z") });
    const a = await criarAlerta(amb, { osId: o.osId, destinatarioId: supervisor.id, detalhe: "Execução interrompida por risco", criadoEm: hora("2026-10-10T10:21:00Z") });

    await manipularEmailAlerta(amb.deps, tarefaDe(a.id));
    const m = amb.email.enviados.at(-1)!;
    assert.ok(m.texto.includes("Vazamento de gás detectado"));
    assert.ok(m.texto.includes("Elismário dos Santos"), "o executor é o técnico");
    assert.ok(m.texto.includes(`https://storage.local/fotos/${foto}`));
  });

  it("todo usuário tem e-mail institucional: o admin (destinatário quando a equipe não tem supervisor) também recebe", async () => {
    const o = await criarOs(amb, { equipeId });
    const a = await criarAlerta(amb, { osId: o.osId, destinatarioId: admin.id });
    const antes = amb.email.enviados.length;
    await manipularEmailAlerta(amb.deps, tarefaDe(a.id));
    assert.equal(amb.email.enviados.length, antes + 1);
    assert.equal(amb.email.enviados.at(-1)!.para, admin.email);
    const [depois] = await amb.db.select().from(alerta).where(eq(alerta.id, a.id));
    assert.deepEqual(depois!.emailEnviadoEm, amb.relogio.agora);
  });

  it("os demais avisos também vão por e-mail, no modelo comum, com o link e o rodapé das preferências", async () => {
    const o = await criarOs(amb, { equipeId });
    const a = await criarAlerta(amb, { osId: o.osId, destinatarioId: supervisor.id, tipo: "apoio_encerrado", detalhe: "A OS de apoio 4099 foi encerrada" });
    const antes = amb.email.enviados.length;
    await manipularEmailAlerta(amb.deps, tarefaDe(a.id));
    assert.equal(amb.email.enviados.length, antes + 1);
    const m = amb.email.enviados.at(-1)!;
    assert.match(m.assunto, /^\[SYNQ OS\] Apoio encerrado — OS /);
    for (const esperado of ["A OS de apoio 4099 foi encerrada", `http://painel.local/app/os/${o.osId}`, "http://painel.local/app/perfil#emails"]) {
      assert.ok(m.texto.includes(esperado), `faltou "${esperado}" no texto`);
      assert.ok((m.html ?? "").includes(esperado), `faltou "${esperado}" no html`);
    }
    assert.deepEqual((await amb.db.select().from(alerta).where(eq(alerta.id, a.id)))[0]!.emailEnviadoEm, amb.relogio.agora);
  });

  it("não envia: categoria desligada no perfil (o bloqueio é obrigatório), servidor sem configuração, destinatário inativo; alerta apagado encerra; sem referência falha", async () => {
    const o = await criarOs(amb, { equipeId });
    const antes = amb.email.enviados.length;
    await amb.db.update(usuario).set({ emailsDesligados: ["os"] }).where(eq(usuario.id, supervisor.id));
    try {
      const apoio = await criarAlerta(amb, { osId: o.osId, destinatarioId: supervisor.id, tipo: "apoio_encerrado" });
      await manipularEmailAlerta(amb.deps, tarefaDe(apoio.id));
      assert.equal(amb.email.enviados.length, antes, "a categoria Ordens de serviço está desligada");
      assert.equal((await amb.db.select().from(alerta).where(eq(alerta.id, apoio.id)))[0]!.emailEnviadoEm, null);
      const { a: bloqueio } = await cenarioDeBloqueio();
      await manipularEmailAlerta(amb.deps, tarefaDe(bloqueio.id));
      assert.equal(amb.email.enviados.length, antes + 1, "a segurança não desliga");
    } finally {
      await amb.db.update(usuario).set({ emailsDesligados: [] }).where(eq(usuario.id, supervisor.id));
    }
    // A segurança e a conta não entram na lista de desligadas nem pelo banco.
    await assert.rejects(() => amb.db.update(usuario).set({ emailsDesligados: ["seguranca"] }).where(eq(usuario.id, supervisor.id)));

    amb.email.configurado = false;
    try {
      const semServidor = await criarAlerta(amb, { osId: o.osId, destinatarioId: supervisor.id, tipo: "apoio_encerrado" });
      await manipularEmailAlerta(amb.deps, tarefaDe(semServidor.id));
      assert.equal(amb.email.enviados.length, antes + 1);
      assert.equal((await amb.db.select().from(alerta).where(eq(alerta.id, semServidor.id)))[0]!.emailEnviadoEm, null, "sem servidor, o aviso não fica como enviado");
    } finally {
      amb.email.configurado = true;
    }

    const inativo = await amb.criarUsuario({ perfil: "tecnico", equipeId, ativo: false });
    const paraInativo = await criarAlerta(amb, { osId: o.osId, destinatarioId: inativo.id, tipo: "apoio_encerrado" });
    await manipularEmailAlerta(amb.deps, tarefaDe(paraInativo.id));
    assert.equal(amb.email.enviados.length, antes + 1);

    // O aviso apagado (o cadastro pendente cancelado) encerra a tarefa sem enviar; sem referência é erro.
    await manipularEmailAlerta(amb.deps, tarefaDe(randomUUID()));
    await assert.rejects(() => manipularEmailAlerta(amb.deps, tarefaDe(null)), /referência/);
  });

  it("falha no envio: não marca email_enviado_em e o executor tenta de novo depois de 1 minuto", async () => {
    const { a } = await cenarioDeBloqueio();
    await amb.db.delete(tarefa);
    const [t] = await amb.db.insert(tarefa).values({ tipo: "email_alerta", referenciaId: a.id, proximaEm: amb.relogio.agora }).returning();
    const enviarOriginal = amb.email.enviar.bind(amb.email);
    amb.email.enviar = async () => {
      throw new Error("SMTP fora do ar");
    };
    try {
      assert.equal(await executarTarefasPendentes(amb.deps), 1);
    } finally {
      amb.email.enviar = enviarOriginal;
    }
    let atual = (await amb.db.select().from(tarefa).where(eq(tarefa.id, t!.id)))[0]!;
    assert.equal(atual.estado, "pendente");
    assert.equal(atual.erro, "SMTP fora do ar");
    assert.equal((await amb.db.select().from(alerta).where(eq(alerta.id, a.id)))[0]!.emailEnviadoEm, null);

    const antes = amb.email.enviados.length;
    amb.relogio.agora = emMin(1, amb.relogio.agora);
    assert.equal(await executarTarefasPendentes(amb.deps), 1);
    atual = (await amb.db.select().from(tarefa).where(eq(tarefa.id, t!.id)))[0]!;
    assert.equal(atual.estado, "concluida");
    assert.equal(amb.email.enviados.length - antes, 1);
  });
});
