import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PRAZO_DO_CONVITE_MIN, frasePendenteDosConvites, pendenciaDosConvites, type ConviteFeito } from "../../shared/api/apr-convite";
import { localInstalacao, os } from "../src/db/schema";
import { executarTarefasPendentes } from "../src/servicos/tarefas";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";
import { ajudaDeExecucao } from "./ajuda-execucao";

const TOKEN_CARLA = "ExponentPushToken[carlacarlacarlacarlacarla]";

/**
 * Convite de participação na APR (`docs/operacao-de-campo.md`, seção 4.9): o responsável convida cada participante antes de a APR existir;
 * cada um aceita ou recusa em até 15 minutos; o responsável só segue com a APR quando todos os convidados aceitaram. Quem não foi
 * convidado não é cobrado (o presencial e o offline seguem valendo).
 */
describe("Convite de participação na APR", () => {
  let amb: Ambiente;
  let h: ReturnType<typeof ajudaDeExecucao>;
  let equipeId: string;
  let tecnico: UsuarioDeTeste; // o responsável da APR: quem convida
  let carla: UsuarioDeTeste;
  let bruno: UsuarioDeTeste;
  let teresa: UsuarioDeTeste;
  let outroResponsavel: UsuarioDeTeste;
  let deOutraEquipe: UsuarioDeTeste;
  let modeloId: string;
  let itens: { id: string; secao: string; respostaBloqueante: string | null }[];
  let localId: string;
  let contadorOs = 5600000;

  const andar = (ms: number) => {
    amb.relogio.agora = new Date(amb.relogio.agora.getTime() + ms);
  };

  before(async () => {
    amb = await criarAmbiente({ comCarga: true, relogio: new Date("2026-10-22T15:00:00Z"), duracaoDoTokenSeg: 7 * 86_400 });
    h = ajudaDeExecucao(amb);
    equipeId = (await amb.criarEquipe()).id;
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Tiago Técnico" });
    carla = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Carla Colega" });
    bruno = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Bruno Braga" });
    teresa = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Teresa Terceira" });
    outroResponsavel = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Otávio Outro" });
    deOutraEquipe = await amb.criarUsuario({ perfil: "tecnico", equipeId: (await amb.criarEquipe()).id, nome: "Flávia de Fora" });
    const modelo = (await amb.sql<{ id: string }>("select id from modelo_apr where codigo = 'APR 01' order by versao desc limit 1"))[0]!;
    modeloId = modelo.id;
    itens = (await amb.sql<{ id: string; secao: string; resposta_bloqueante: string | null }>("select id, secao, resposta_bloqueante from item_modelo_apr where modelo_apr_id = $1", [modeloId])).map((i) => ({
      id: i.id,
      secao: i.secao,
      respostaBloqueante: i.resposta_bloqueante,
    }));
    [{ id: localId }] = (await amb.db.insert(localInstalacao).values({ codigo: "VILA VELHA/REDE" }).returning({ id: localInstalacao.id })) as [{ id: string }];
    await amb.esperar(200, "POST", "/me/dispositivos", { como: carla, json: { token: TOKEN_CARLA, plataforma: "android" } });
  });
  after(() => amb.fechar());

  async function novaOs() {
    const [o] = await amb.db
      .insert(os)
      .values({ numeroOrdem: String(++contadorOs), tipo: "corretiva", titulo: "DCV Desobstrução", localInstalacaoId: localId, equipeId, dataInicioProg: "2026-10-22", origem: "sap" })
      .returning();
    return o!;
  }
  const corpoDaApr = (osId: string, quem: UsuarioDeTeste[]) => ({
    id: randomUUID(),
    os_id: osId,
    modelo_apr_id: modeloId,
    participantes: quem.map((u, i) => ({ usuario_id: u.id, funcao: i === 0 ? "responsavel" : "executor" })),
    riscos: [],
    respostas: itens.filter((i) => i.secao === "verificacao").map((i) => ({ item_id: i.id, resposta: i.respostaBloqueante === "sim" ? "nao" : "sim" })),
    observacao_geral: null,
    concluida_em: h.agora(),
  });
  const convidar = (como: UsuarioDeTeste, osId: string, quem: UsuarioDeTeste[]) => amb.req("POST", `/os/${osId}/apr-convites`, { como, json: { usuarios: quem.map((u) => u.id) } });
  /** O que a pessoa recebeu, na OS dada (as pessoas dos testes são as mesmas, então cada teste olha só a sua OS). */
  const meus = async (como: UsuarioDeTeste, osId: string) => ((await amb.esperar(200, "GET", "/me/apr-convites", { como })).convites as { id: string; situacao: string; os: { id: string } }[]).filter((c) => c.os.id === osId);
  const feitos = async (como: UsuarioDeTeste, osId: string) => (await amb.esperar(200, "GET", `/os/${osId}/apr-convites`, { como })).convites as { id: string; situacao: string; motivo: string | null; convidado: { id: string; nome: string } }[];
  const situacaoDe = async (como: UsuarioDeTeste, osId: string, quem: UsuarioDeTeste) => (await feitos(como, osId)).find((c) => c.convidado.id === quem.id)?.situacao;
  const avisos = (osId: string, tipo: string) => amb.sql<{ destinatario_id: string; detalhe: string; lido_em: string | null }>("select destinatario_id, detalhe, lido_em from alerta where os_id = $1 and tipo = $2 order by criado_em, id", [osId, tipo]);
  const avaliar = (como: UsuarioDeTeste, osId: string, quem: UsuarioDeTeste[]) => amb.req("POST", "/aprs/avaliar", { como, json: corpoDaApr(osId, quem) });

  describe("convidar", () => {
    it("cada convidado recebe o convite na hora (sino e push), e o responsável vê o estado de cada um", async () => {
      const o = await novaOs();
      const r = await convidar(tecnico, o.id, [carla, bruno]);
      assert.equal(r.status, 201, JSON.stringify(r.corpo));
      assert.deepEqual(r.corpo.convites.map((c: { situacao: string }) => c.situacao), ["aguardando", "aguardando"]);

      const doCarla = await avisos(o.id, "apr_convite");
      assert.deepEqual(doCarla.map((a) => a.destinatario_id).sort(), [carla.id, bruno.id].sort());
      assert.match(doCarla[0]!.detalhe, new RegExp(`Tiago Técnico convidou você para participar da APR da OS ${o.numeroOrdem}.*${PRAZO_DO_CONVITE_MIN} minutos`));

      amb.push.enviadas.length = 0;
      await executarTarefasPendentes(amb.deps);
      assert.equal(amb.push.enviadas.length, 1, "só a Carla tem aparelho");
      assert.equal(amb.push.enviadas[0]!.titulo, "Convite para participar de uma APR");
      assert.equal(amb.push.enviadas[0]!.canal, "urgente");
      assert.equal(amb.push.enviadas[0]!.validadeS, 900);

      const recebidos = await meus(carla, o.id);
      assert.equal(recebidos.length, 1);
      assert.equal(recebidos[0]!.situacao, "aguardando");
      assert.equal(recebidos[0]!.os.id, o.id);
      assert.deepEqual((await feitos(tecnico, o.id)).map((c) => c.convidado.nome), ["Bruno Braga", "Carla Colega"]);
    });

    it("repetir não duplica o convite que ainda vale nem avisa de novo", async () => {
      const o = await novaOs();
      await convidar(tecnico, o.id, [carla]);
      const antes = (await avisos(o.id, "apr_convite")).length;
      assert.equal((await convidar(tecnico, o.id, [carla])).status, 201);
      assert.equal((await feitos(tecnico, o.id)).length, 1);
      assert.equal((await avisos(o.id, "apr_convite")).length, antes);
    });

    it("recusa quem não pode entrar na APR: o próprio, de outra equipe, ausente, desligado ou sem assinatura", async () => {
      const o = await novaOs();
      assert.equal((await convidar(tecnico, o.id, [tecnico])).corpo.erro.codigo, "convidado_invalido");
      assert.equal((await convidar(tecnico, o.id, [deOutraEquipe])).corpo.erro.codigo, "convidado_fora_da_equipe");
      const semAssinatura = await amb.criarUsuario({ perfil: "tecnico", equipeId, comAssinatura: false });
      assert.equal((await convidar(tecnico, o.id, [semAssinatura])).corpo.erro.codigo, "convidado_sem_assinatura");
      const desligado = await amb.criarUsuario({ perfil: "tecnico", equipeId, ativo: false });
      assert.equal((await convidar(tecnico, o.id, [desligado])).corpo.erro.codigo, "convidado_inativo");
      const ausente = await amb.criarUsuario({ perfil: "tecnico", equipeId });
      await amb.sql("insert into ausencia (usuario_id, equipe_id, supervisor_id, motivo, inicio, retorno, estado, origem) values ($1, $2, $3, 'ferias', '2026-10-20', '2026-11-05', 'confirmada', 'supervisor')", [ausente.id, equipeId, tecnico.id]);
      assert.equal((await convidar(tecnico, o.id, [ausente])).corpo.erro.codigo, "convidado_ausente");
      assert.equal((await feitos(tecnico, o.id)).length, 0, "nada foi criado");
    });

    it("só o técnico da equipe da OS convida, e só enquanto a OS aceita APR", async () => {
      const o = await novaOs();
      assert.equal((await convidar(deOutraEquipe, o.id, [carla])).status, 404);
      const admin = await amb.criarUsuario({ perfil: "admin" });
      assert.equal((await convidar(admin, o.id, [carla])).status, 403);
      await amb.sql("update os set status = 'em_execucao' where id = $1", [o.id]);
      assert.equal((await convidar(tecnico, o.id, [carla])).corpo.erro.codigo, "os_sem_apr");
    });

    it("o convite em aberto de outro responsável é recusado, com o nome de quem convidou", async () => {
      const o = await novaOs();
      await convidar(tecnico, o.id, [carla]);
      const r = await convidar(outroResponsavel, o.id, [carla]);
      assert.equal(r.status, 409);
      assert.equal(r.corpo.erro.codigo, "convite_em_aberto");
      assert.match(r.corpo.erro.mensagem, /Tiago Técnico/);
    });
  });

  describe("responder", () => {
    it("aceitar avisa o responsável e tira o convite do não lido de quem aceitou", async () => {
      const o = await novaOs();
      await convidar(tecnico, o.id, [carla]);
      const [convite] = await meus(carla, o.id);
      await amb.esperar(200, "POST", `/apr-convites/${convite!.id}/aceitar`, { como: carla });
      assert.equal(await situacaoDe(tecnico, o.id, carla), "aceito");
      assert.deepEqual((await avisos(o.id, "apr_convite_aceito")).map((a) => a.destinatario_id), [tecnico.id]);
      assert.ok((await avisos(o.id, "apr_convite"))[0]!.lido_em, "o aviso do convite saiu do não lido");
      // Aceitar de novo é seguro, e a Carla segue vendo o convite aceito até a APR ser registrada.
      await amb.esperar(200, "POST", `/apr-convites/${convite!.id}/aceitar`, { como: carla });
      assert.equal((await avisos(o.id, "apr_convite_aceito")).length, 1);
      assert.equal((await meus(carla, o.id))[0]!.situacao, "aceito");
    });

    it("recusar exige um motivo curto, que o responsável lê", async () => {
      const o = await novaOs();
      await convidar(tecnico, o.id, [bruno]);
      const [convite] = await meus(bruno, o.id);
      assert.equal((await amb.req("POST", `/apr-convites/${convite!.id}/recusar`, { como: bruno, json: { motivo: "   " } })).corpo.erro.codigo, "motivo_obrigatorio");
      assert.equal((await amb.req("POST", `/apr-convites/${convite!.id}/recusar`, { como: bruno, json: { motivo: "x".repeat(200) } })).status, 422);
      await amb.esperar(200, "POST", `/apr-convites/${convite!.id}/recusar`, { como: bruno, json: { motivo: "Estou em outro serviço" } });
      const [c] = await feitos(tecnico, o.id);
      assert.equal(c!.situacao, "recusado");
      assert.equal(c!.motivo, "Estou em outro serviço");
      assert.match((await avisos(o.id, "apr_convite_recusado"))[0]!.detalhe, /Bruno Braga não pode participar.*Estou em outro serviço/);
      assert.equal((await meus(bruno, o.id)).length, 0, "o recusado some do que a pessoa recebeu");
      // Depois de recusar, não dá para aceitar o mesmo convite.
      assert.equal((await amb.req("POST", `/apr-convites/${convite!.id}/aceitar`, { como: bruno })).corpo.erro.codigo, "convite_encerrado");
    });

    it("só o convidado responde, e o prazo de 15 minutos vale", async () => {
      const o = await novaOs();
      await convidar(tecnico, o.id, [carla]);
      const [convite] = await meus(carla, o.id);
      assert.equal((await amb.req("POST", `/apr-convites/${convite!.id}/aceitar`, { como: bruno })).status, 404);
      assert.equal((await amb.req("POST", `/apr-convites/${convite!.id}/aceitar`, { como: tecnico })).status, 404);
      andar((PRAZO_DO_CONVITE_MIN + 1) * 60_000);
      assert.equal(await situacaoDe(tecnico, o.id, carla), "sem_resposta");
      assert.equal((await meus(carla, o.id)).length, 0, "o vencido some do que a pessoa recebeu");
      assert.equal((await amb.req("POST", `/apr-convites/${convite!.id}/aceitar`, { como: carla })).corpo.erro.codigo, "convite_expirado");
    });

    it("o responsável convida de novo quem não respondeu no prazo (o convite renova) e quem recusou", async () => {
      const o = await novaOs();
      await convidar(tecnico, o.id, [carla, bruno]);
      const convitesBruno = await meus(bruno, o.id);
      await amb.esperar(200, "POST", `/apr-convites/${convitesBruno[0]!.id}/recusar`, { como: bruno, json: { motivo: "Sem EPI" } });
      andar((PRAZO_DO_CONVITE_MIN + 1) * 60_000);
      assert.equal(await situacaoDe(tecnico, o.id, carla), "sem_resposta");
      assert.equal(await situacaoDe(tecnico, o.id, bruno), "recusado");
      await amb.esperar(201, "POST", `/os/${o.id}/apr-convites`, { como: tecnico, json: { usuarios: [carla.id, bruno.id] } });
      assert.equal(await situacaoDe(tecnico, o.id, carla), "aguardando");
      assert.equal(await situacaoDe(tecnico, o.id, bruno), "aguardando");
      assert.equal((await meus(carla, o.id)).length, 1);
    });

    it("desfazer o convite avisa a pessoa e o tira do que ela recebeu", async () => {
      const o = await novaOs();
      await convidar(tecnico, o.id, [carla]);
      const [convite] = await meus(carla, o.id);
      assert.equal((await amb.req("DELETE", `/apr-convites/${convite!.id}`, { como: carla })).status, 404);
      await amb.esperar(200, "DELETE", `/apr-convites/${convite!.id}`, { como: tecnico });
      await amb.esperar(200, "DELETE", `/apr-convites/${convite!.id}`, { como: tecnico });
      assert.equal((await feitos(tecnico, o.id)).length, 0);
      assert.equal((await meus(carla, o.id)).length, 0);
      assert.equal((await avisos(o.id, "apr_convite_cancelado")).length, 1);
      assert.ok((await avisos(o.id, "apr_convite"))[0]!.lido_em);
      assert.equal((await amb.req("POST", `/apr-convites/${convite!.id}/aceitar`, { como: carla })).corpo.erro.codigo, "convite_encerrado");
      // E dá para convidar de novo.
      await amb.esperar(201, "POST", `/os/${o.id}/apr-convites`, { como: tecnico, json: { usuarios: [carla.id] } });
    });
  });

  describe("a APR só segue com quem aceitou", () => {
    it("o convidado que não aceitou (esperando, recusou ou sem resposta) impede a validação da APR; quem não foi convidado não", async () => {
      const o = await novaOs();
      await convidar(tecnico, o.id, [carla, bruno]);

      let r = await avaliar(tecnico, o.id, [tecnico, carla, bruno]);
      assert.equal(r.status, 422);
      assert.equal(r.corpo.erro.codigo, "convite_pendente");

      const [deCarla] = await meus(carla, o.id);
      await amb.esperar(200, "POST", `/apr-convites/${deCarla!.id}/aceitar`, { como: carla });
      const [deBruno] = await meus(bruno, o.id);
      await amb.esperar(200, "POST", `/apr-convites/${deBruno!.id}/recusar`, { como: bruno, json: { motivo: "Folga" } });

      r = await avaliar(tecnico, o.id, [tecnico, carla, bruno]);
      assert.equal(r.corpo.erro.codigo, "convite_recusado");
      assert.match(r.corpo.erro.mensagem, /Bruno Braga recusou o convite/);

      // O responsável troca o Bruno pela Teresa, sem convite (o presencial): a Carla aceitou e a Teresa não foi convidada.
      r = await avaliar(tecnico, o.id, [tecnico, carla, teresa]);
      assert.equal(r.status, 200, JSON.stringify(r.corpo));
      assert.equal(r.corpo.resultado, "aprovada");
    });

    it("o convite que passou do prazo impede, até o responsável convidar de novo ou tirar a pessoa", async () => {
      const o = await novaOs();
      await convidar(tecnico, o.id, [carla]);
      andar((PRAZO_DO_CONVITE_MIN + 1) * 60_000);
      const r = await avaliar(tecnico, o.id, [tecnico, carla]);
      assert.equal(r.corpo.erro.codigo, "convite_sem_resposta");
      assert.equal((await avaliar(tecnico, o.id, [tecnico, teresa])).status, 200, "tirando a Carla da lista, segue");
    });

    it("a APR registrada usa os convites aceitos e desfaz os que sobraram", async () => {
      const o = await novaOs();
      await convidar(tecnico, o.id, [carla, bruno]);
      const [deCarla] = await meus(carla, o.id);
      await amb.esperar(200, "POST", `/apr-convites/${deCarla!.id}/aceitar`, { como: carla });
      // O Bruno ficou de fora da lista (o responsável o tirou) e ainda não tinha respondido.
      const p = corpoDaApr(o.id, [tecnico, carla]);
      const resposta = await h.enviar(tecnico, h.evento("apr_concluida", p, o.id));
      assert.deepEqual(resposta.rejeitados, [], JSON.stringify(resposta.rejeitados));

      const linhas = await amb.sql<{ usuario_id: string; estado: string; apr_id: string | null }>("select usuario_id, estado, apr_id from apr_convite where os_id = $1", [o.id]);
      assert.equal(linhas.find((l) => l.usuario_id === carla.id)!.estado, "usado");
      assert.equal(linhas.find((l) => l.usuario_id === carla.id)!.apr_id, p.id);
      assert.equal(linhas.find((l) => l.usuario_id === bruno.id)!.estado, "cancelado");
      assert.ok((await avisos(o.id, "apr_convite")).every((a) => a.lido_em), "ninguém fica com um convite que já não existe");
      assert.equal((await meus(bruno, o.id)).length, 0);
      assert.equal((await meus(carla, o.id)).length, 0, "a Carla agora assina a APR (apr_para_assinar), não responde mais convite");
      assert.equal((await avisos(o.id, "apr_para_assinar")).length, 1);
    });

    it("o registro pelo evento também recusa o convidado que não aceitou, mas a fila offline não é cobrada", async () => {
      const o = await novaOs();
      await convidar(tecnico, o.id, [carla]);
      const online = await h.enviar(tecnico, h.evento("apr_concluida", corpoDaApr(o.id, [tecnico, carla]), o.id));
      assert.equal(online.rejeitados[0]?.codigo, "convite_pendente");
      // O mesmo evento, mas feito 5 minutos antes (veio da fila offline: o aparelho não podia convidar nem saber do convite).
      const antes = new Date(amb.relogio.agora.getTime() - 5 * 60_000).toISOString();
      const offline = await h.enviar(tecnico, h.evento("apr_concluida", { ...corpoDaApr(o.id, [tecnico, carla]), concluida_em: antes }, o.id, antes));
      assert.deepEqual(offline.rejeitados, [], JSON.stringify(offline.rejeitados));
    });
  });

  describe("o resumo para a tela", () => {
    const convite = (nome: string, situacao: ConviteFeito["situacao"], motivo: string | null = null): ConviteFeito => ({
      id: nome,
      os_id: "os",
      convidado: { id: nome, nome: `${nome} Silva`, matricula: nome },
      situacao,
      motivo,
      criado_em: "2026-10-22T15:00:00Z",
      expira_em: "2026-10-22T15:15:00Z",
      respondido_em: null,
    });

    it("só conta quem está marcado como participante e foi convidado", () => {
      const convites = [convite("ana", "aceito"), convite("bia", "aguardando"), convite("caio", "recusado", "Folga"), convite("duda", "sem_resposta")];
      assert.equal(pendenciaDosConvites(convites, ["ana"]).livre, true);
      assert.equal(pendenciaDosConvites(convites, ["ana", "eva"]).livre, true, "quem não foi convidado não é cobrado");
      const p = pendenciaDosConvites(convites, ["ana", "bia", "caio", "duda"]);
      assert.deepEqual(p.aguardando, ["bia Silva"]);
      assert.deepEqual(p.recusaram, [{ nome: "caio Silva", motivo: "Folga" }]);
      assert.deepEqual(p.sem_resposta, ["duda Silva"]);
      assert.equal(p.livre, false);
    });

    it("a frase diz o que falta, em português", () => {
      const convites = [convite("ana", "aguardando"), convite("bia", "aguardando"), convite("caio", "recusado")];
      assert.equal(
        frasePendenteDosConvites(pendenciaDosConvites(convites, ["ana", "bia", "caio"])),
        "Ana e bia ainda não responderam ao convite; caio não pode participar: troque a pessoa.",
      );
      assert.equal(frasePendenteDosConvites(pendenciaDosConvites([], ["ana"])), null);
    });
  });
});
