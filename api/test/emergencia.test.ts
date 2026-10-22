import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { CONTATOS_PUBLICOS, enderecoDoMapa, telefoneParaLigar, telefoneValido } from "../../shared/api/emergencia";
import { localInstalacao, os } from "../src/db/schema";
import { executarTarefasPendentes } from "../src/servicos/tarefas";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";
import { POSICAO, ajudaDeExecucao } from "./ajuda-execucao";

const TOKEN_SUPERVISOR = "ExponentPushToken[supervisorsupervisorsupervi]";

/**
 * O botão de emergência (`docs/operacao-de-campo.md`, seção 5.9): quem o aciona avisa na hora o supervisor da equipe e os administradores
 * (sino, push e e-mail obrigatório) com o nome, a OS e a posição; o atendimento é do supervisor ou do admin; os contatos do PAE são do admin.
 */
describe("Botão de emergência", () => {
  let amb: Ambiente;
  let h: ReturnType<typeof ajudaDeExecucao>;
  let equipeId: string;
  let supervisor: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;
  let colega: UsuarioDeTeste;
  let admin: UsuarioDeTeste;
  let outraEquipe: UsuarioDeTeste;
  let supervisorDeOutra: UsuarioDeTeste;
  let localId: string;
  let contadorOs = 5700000;

  before(async () => {
    amb = await criarAmbiente({ relogio: new Date("2026-10-22T15:00:00Z"), duracaoDoTokenSeg: 7 * 86_400 });
    h = ajudaDeExecucao(amb);
    supervisor = await amb.criarUsuario({ perfil: "tecnico", nome: "Sônia Supervisora", email: "sonia@empresa.com.br" });
    equipeId = (await amb.criarEquipe({ supervisorId: supervisor.id })).id;
    await amb.sql("update usuario set equipe_id = $1 where id = $2", [equipeId, supervisor.id]);
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Tiago Técnico" });
    colega = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Carla Colega" });
    admin = await amb.criarUsuario({ perfil: "admin", nome: "Ada Admin", email: "ada@empresa.com.br" });
    const outra = await amb.criarEquipe();
    supervisorDeOutra = await amb.criarUsuario({ perfil: "tecnico", equipeId: outra.id, nome: "Otávio Outra Equipe" });
    await amb.sql("update equipe set supervisor_id = $1 where id = $2", [supervisorDeOutra.id, outra.id]);
    outraEquipe = await amb.criarUsuario({ perfil: "tecnico", equipeId: outra.id });
    [{ id: localId }] = (await amb.db.insert(localInstalacao).values({ codigo: "VILA VELHA/REDE" }).returning({ id: localInstalacao.id })) as [{ id: string }];
    await amb.esperar(200, "POST", "/me/dispositivos", { como: supervisor, json: { token: TOKEN_SUPERVISOR, plataforma: "android" } });
  });
  after(() => amb.fechar());

  async function novaOs(extra: Record<string, unknown> = {}) {
    const [o] = await amb.db
      .insert(os)
      .values({ numeroOrdem: String(++contadorOs), tipo: "corretiva", titulo: "DCV Desobstrução", localInstalacaoId: localId, equipeId, dataInicioProg: "2026-10-22", origem: "sap", ...extra })
      .returning();
    return o!;
  }
  const acionar = (como: UsuarioDeTeste, osId: string | null, payload: Record<string, unknown> = {}, ocorrido?: string, id = randomUUID()) =>
    h.enviar(como, h.evento("emergencia_acionada", { id, ...POSICAO, ...payload }, osId, ocorrido));
  const avisos = (osId: string, tipo = "emergencia") => amb.sql<{ destinatario_id: string; detalhe: string }>("select destinatario_id, detalhe from alerta where os_id = $1 and tipo = $2 order by criado_em, id", [osId, tipo]);

  describe("acionar", () => {
    it("avisa o supervisor da equipe e os administradores, com o nome, a OS e a posição, e ninguém mais", async () => {
      const o = await novaOs();
      const r = await acionar(tecnico, o.id, { observacao: "vazamento na rua, pessoa passando mal" });
      assert.deepEqual(r.rejeitados, [], JSON.stringify(r.rejeitados));
      assert.equal(r.confirmados.length, 1);

      const quem = await avisos(o.id);
      assert.deepEqual(quem.map((a) => a.destinatario_id).sort(), [supervisor.id, admin.id].sort());
      const texto = quem[0]!.detalhe;
      assert.match(texto, /EMERGÊNCIA acionada por Tiago Técnico \(mat\. .+\) na OS \d+ · VILA VELHA\/REDE/);
      assert.ok(texto.includes(enderecoDoMapa(POSICAO.latitude, POSICAO.longitude)));
      assert.match(texto, /Observação: "vazamento na rua, pessoa passando mal"/);
      assert.match(texto, /Ligue para a pessoa e acione o PAE/);

      const [linha] = await amb.sql<{ acionada_por_id: string; latitude: number; atendida_em: string | null }>("select acionada_por_id, latitude, atendida_em from emergencia where os_id = $1", [o.id]);
      assert.equal(linha!.acionada_por_id, tecnico.id);
      assert.equal(linha!.latitude, POSICAO.latitude);
      assert.equal(linha!.atendida_em, null);
    });

    it("sai por e-mail (aviso de segurança, obrigatório) e por push (canal urgente)", async () => {
      const o = await novaOs();
      amb.email.enviados.length = 0;
      amb.push.enviadas.length = 0;
      await acionar(tecnico, o.id);
      await executarTarefasPendentes(amb.deps);

      const paraQuem = amb.email.enviados.filter((m) => m.assunto.includes("EMERGÊNCIA") && m.assunto.includes(o.numeroOrdem!)).map((m) => m.para).sort();
      assert.deepEqual(paraQuem, ["ada@empresa.com.br", "sonia@empresa.com.br"]);
      const push = amb.push.enviadas.filter((m) => m.dados.tipo === "emergencia" && m.dados.os_id === o.id);
      assert.equal(push.length, 1, "só a Sônia tem aparelho");
      assert.equal(push[0]!.canal, "urgente");
      assert.equal(push[0]!.titulo, "EMERGÊNCIA acionada");
    });

    it("a pessoa não pode desligar o e-mail da emergência (categoria obrigatória)", async () => {
      const o = await novaOs();
      await amb.sql("update usuario set emails_desligados = array['os','equipe'] where id = $1", [supervisor.id]);
      amb.email.enviados.length = 0;
      await acionar(tecnico, o.id);
      await executarTarefasPendentes(amb.deps);
      assert.ok(amb.email.enviados.some((m) => m.para === "sonia@empresa.com.br" && m.assunto.includes("EMERGÊNCIA")));
    });

    it("reenviar o mesmo acionamento não avisa de novo, nem com outro id de evento", async () => {
      const o = await novaOs();
      const idDoAcionamento = randomUUID();
      const idDoEvento = randomUUID();
      await acionar(tecnico, o.id, {}, undefined, idDoAcionamento).then(() => undefined);
      const antes = (await avisos(o.id)).length;
      await h.enviar(tecnico, { ...h.evento("emergencia_acionada", { id: idDoAcionamento, ...POSICAO }, o.id), id: idDoEvento });
      assert.equal((await avisos(o.id)).length, antes);
      assert.equal((await amb.sql("select 1 from emergencia where os_id = $1", [o.id])).length, 1);
    });

    it("não é barrado por falta de posição, de execução nem pelo estado da OS", async () => {
      const o = await novaOs({ status: "liberada" });
      const r = await acionar(tecnico, o.id, { latitude: null, longitude: null });
      assert.deepEqual(r.rejeitados, []);
      assert.match((await avisos(o.id))[0]!.detalhe, /Sem posição: o aparelho não conseguiu o GPS/);
      // A posição pela metade é recusada (as duas coordenadas vêm juntas).
      const meia = await acionar(tecnico, o.id, { latitude: -20.3, longitude: null });
      assert.equal(meia.rejeitados[0]?.codigo, "posicao_incompleta");
    });

    it("o acionamento que esperou o sinal diz a que horas foi feito e que chegou depois", async () => {
      const o = await novaOs();
      const antes = new Date(amb.relogio.agora.getTime() - 10 * 60_000).toISOString();
      const r = await acionar(tecnico, o.id, {}, antes);
      assert.deepEqual(r.rejeitados, []);
      assert.match((await avisos(o.id))[0]!.detalhe, /o aparelho estava sem sinal; chegou às/);
      const [e] = await amb.sql<{ acionada_em: string; recebida_em: string }>("select acionada_em, recebida_em from emergencia where os_id = $1", [o.id]);
      assert.ok(new Date(e!.recebida_em).getTime() - new Date(e!.acionada_em).getTime() >= 10 * 60_000 - 1000);
    });

    it("só a OS da equipe da pessoa: a de outra equipe é recusada, e sem OS também", async () => {
      const o = await novaOs();
      assert.equal((await acionar(outraEquipe, o.id)).rejeitados[0]?.codigo, "fora_da_equipe");
      assert.equal((await acionar(tecnico, null)).rejeitados[0]?.codigo, "os_obrigatoria");
      assert.equal((await avisos(o.id)).length, 0);
      // O administrador não executa em campo.
      assert.equal((await amb.req("POST", "/eventos", { como: admin, json: { eventos: [h.evento("emergencia_acionada", { id: randomUUID() }, o.id)] } })).status, 403);
    });
  });

  describe("atender", () => {
    it("o supervisor dá por atendida e quem acionou é avisado; atender de novo não muda nada", async () => {
      const o = await novaOs();
      await acionar(tecnico, o.id);
      const id = (await amb.sql<{ id: string }>("select id from emergencia where os_id = $1", [o.id]))[0]!.id;

      assert.equal((await amb.req("POST", `/emergencias/${id}/atender`, { como: tecnico, json: {} })).status, 403, "quem aciona não a dá por atendida");
      assert.equal((await amb.req("POST", `/emergencias/${id}/atender`, { como: supervisorDeOutra, json: {} })).status, 404);
      const r = await amb.esperar(200, "POST", `/emergencias/${id}/atender`, { como: supervisor, json: { nota: "Brigada no local; pessoa socorrida" } });
      assert.equal(r.ja_atendida, false);
      assert.equal((await amb.esperar(200, "POST", `/emergencias/${id}/atender`, { como: admin, json: {} })).ja_atendida, true);

      const avisosDeAtendimento = await avisos(o.id, "emergencia_atendida");
      assert.deepEqual(avisosDeAtendimento.map((a) => a.destinatario_id), [tecnico.id]);
      assert.match(avisosDeAtendimento[0]!.detalhe, /Sônia Supervisora deu a emergência da OS \d+, acionada às .+, como atendida: "Brigada no local; pessoa socorrida"/);

      const lista = (await amb.esperar(200, "GET", `/os/${o.id}/emergencias`, { como: colega })).emergencias;
      assert.equal(lista.length, 1);
      assert.equal(lista[0].acionada_por.nome, "Tiago Técnico");
      assert.equal(lista[0].atendida_por.nome, "Sônia Supervisora");
      assert.equal(lista[0].nota_do_atendimento, "Brigada no local; pessoa socorrida");
      assert.equal((await amb.req("GET", `/os/${o.id}/emergencias`, { como: outraEquipe })).status, 404);
    });
  });

  describe("os contatos do PAE", () => {
    const contato = (nome: string, telefone: string, descricao?: string) => ({ nome, telefone, descricao: descricao ?? null });

    it("começam vazios (o admin cadastra), e os números públicos aparecem sempre", async () => {
      const lidos = await amb.esperar(200, "GET", "/emergencia/contatos", { como: tecnico });
      assert.deepEqual(lidos.pae, []);
      assert.deepEqual(lidos.publicos, CONTATOS_PUBLICOS);
      assert.deepEqual(lidos.publicos.map((c: { telefone: string }) => c.telefone), ["192", "193"]);
    });

    it("o admin cadastra, o técnico lê, e voltar ao padrão esvazia de novo", async () => {
      const contatos = [contato("Brigada da unidade", "(27) 99999-0000", "Plantão 24 h"), contato("Segurança do Trabalho", "+55 27 3000-0000")];
      assert.equal((await amb.req("PUT", "/configuracoes/sistema/contatos_pae", { como: tecnico, json: { valor: contatos } })).status, 403);
      const salvo = await amb.esperar(200, "PUT", "/configuracoes/sistema/contatos_pae", { como: admin, json: { valor: contatos } });
      assert.equal(salvo.contatos_pae.personalizado, true);
      assert.equal(salvo.contatos_pae.contatos.length, 2);

      const lidos = await amb.esperar(200, "GET", "/emergencia/contatos", { como: colega });
      assert.deepEqual(lidos.pae.map((c: { nome: string; descricao: string | null }) => [c.nome, c.descricao]), [["Brigada da unidade", "Plantão 24 h"], ["Segurança do Trabalho", null]]);
      assert.equal((await amb.esperar(200, "GET", "/configuracoes/sistema", { como: admin })).contatos_pae.contatos.length, 2);

      const vazio = await amb.esperar(200, "DELETE", "/configuracoes/sistema/contatos_pae", { como: admin });
      assert.deepEqual(vazio.contatos_pae.contatos, []);
      assert.deepEqual((await amb.esperar(200, "GET", "/emergencia/contatos", { como: colega })).pae, []);
    });

    it("recusa telefone que não dá para ligar, nome vazio e lista grande demais", async () => {
      const tenta = (valor: unknown) => amb.req("PUT", "/configuracoes/sistema/contatos_pae", { como: admin, json: { valor } });
      assert.equal((await tenta([contato("Brigada", "abc")])).status, 422);
      assert.equal((await tenta([contato("Brigada", "12")])).status, 422);
      assert.equal((await tenta([contato("B", "(27) 99999-0000")])).status, 422);
      assert.equal((await tenta(Array.from({ length: 11 }, (_, i) => contato(`Contato ${i}`, "27999990000")))).status, 422);
      assert.equal((await tenta("nao é lista")).status, 422);
    });

    it("o telefone vira o número de ligar, sem enfeites", () => {
      assert.equal(telefoneParaLigar("(27) 99999-0000"), "27999990000");
      assert.equal(telefoneParaLigar("+55 27 3000-0000"), "+552730000000");
      assert.equal(telefoneParaLigar("192"), "192");
      assert.equal(telefoneValido("192"), true);
      assert.equal(telefoneValido("0800 000 0000"), true);
      assert.equal(telefoneValido("ligue 192"), false);
      assert.equal(telefoneValido("12"), false);
    });
  });
});
