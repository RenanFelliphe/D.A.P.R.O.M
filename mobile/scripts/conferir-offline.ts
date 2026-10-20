/**
 * Confere o modo offline do app contra uma `api` de verdade (sem aparelho): baixa a cópia da equipe (`POST /sync/pull`) para um SQLite,
 * confere que a leitura local devolve o mesmo que a `api` (lista, detalhe, escolha do modelo, modelo, equipe), faz sem sinal a APR, a
 * execução e o encerramento (tudo na fila), e sobe tudo quando o sinal volta, vendo o resultado no servidor. Depois confere o evento
 * adiado (a assinatura de outro aparelho), a APR sem sinal que o servidor bloqueia (D1: a execução não se perde e vira alerta) e o
 * reenvio (sem duplicar). Usa o mesmo cliente, as mesmas regras de `shared/` e o mesmo código do `src/offline/` que o app. Pensado para a
 * `api` local em memória:
 *
 *   cd api && PORT=3399 pnpm dev:local          (em outro terminal)
 *   cd mobile && API_URL=http://localhost:3399 pnpm conferir:offline
 *
 * Nunca aponte para a `api` do Supabase compartilhado: o script cria APRs, execuções e arquivos.
 */
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { montarAvaliacao, montarPayload, novoRascunho, perguntasDe, responder, type EscolhaDoModelo, type ModeloCompleto, type RascunhoApr, type Resposta } from "@shared/api/apr";
import { definirSituacao } from "@shared/api/execucao-situacao";
import type { RespostaEventos } from "@shared/api/eventos";
import type { DetalheDaOs, ListaDeOs } from "@shared/api/os-app";
import type { OsStatus, RespostaMe } from "@shared/api/tipos";
import { novoUuid } from "@shared/api/uuid";
import { criarClienteApi, type ArmazemDeTokens, type Tokens } from "../src/api/cliente";
import { criarEnvio } from "../src/api/eventos";
import { criarBanco, type Banco, type Parametro } from "../src/offline/banco";
import { criarEnvioComFila } from "../src/offline/envio";
import { migrar } from "../src/offline/esquema";
import { contarPendentes, eventosPendentes, eventosRecusados } from "../src/offline/fila";
import { criarLeitura } from "../src/offline/leitura";
import { criarSincronizador, type Conexao } from "../src/offline/sincronizar";
import type { SnapshotDaApi } from "../src/offline/tipos";

const API_URL = process.env.API_URL ?? "http://localhost:3399";
const SENHA = "synqos123";
const ok = (msg: string) => console.log(`ok  ${msg}`);

async function novoBanco(): Promise<Banco> {
  const sqlite = new DatabaseSync(":memory:");
  const banco = criarBanco({
    exec: async (sql) => void sqlite.exec(sql),
    run: async (sql, p: Parametro[]) => void sqlite.prepare(sql).run(...p),
    all: async <T>(sql: string, p: Parametro[]) => sqlite.prepare(sql).all(...p) as T[],
  });
  await migrar(banco);
  return banco;
}

/** Um aparelho: o cliente da `api` com a sessão da pessoa, o banco local, a conexão que o script liga e desliga e as peças do modo offline. */
async function aparelho(email: string) {
  let tokens: Tokens | null = null;
  const armazem: ArmazemDeTokens = { ler: async () => tokens, gravar: async (t) => void (tokens = t), apagar: async () => void (tokens = null) };
  const cliente = criarClienteApi({ urlBase: API_URL, armazem });
  await cliente.entrar(email, SENHA);
  const eu = await cliente.chamar<RespostaMe>("/me");
  const banco = await novoBanco();
  let conexao: Conexao = "online";
  const direto = criarEnvio(cliente);
  const pessoa = { id: eu.usuario.id, nome: eu.usuario.nome, matricula: eu.usuario.matricula };
  const sincronizador = criarSincronizador({
    banco,
    usuarioId: () => eu.usuario.id,
    enviarEvento: (e) => cliente.chamar<RespostaEventos & { acesso_revogado?: boolean }>("/eventos", { corpo: { eventos: [e] } }),
    subirArquivo: (a) => direto.enviarArquivo({ uri: a.uri, nome: a.nome, tipoMime: a.tipoMime }, a.tipo, a.id).then(() => undefined),
    baixarSnapshot: (fila) => cliente.chamar<SnapshotDaApi>("/sync/pull", { metodo: "POST", corpo: { fila } }),
    apagarArquivoLocal: () => undefined,
    conexao: () => conexao,
    agora: () => new Date(),
    aoMudar: () => undefined,
  });
  const envio = criarEnvioComFila({
    banco,
    sincronizador,
    usuarioId: () => eu.usuario.id,
    conexao: () => conexao,
    agora: () => new Date(),
    subirAgora: (a, t, id) => direto.enviarArquivo(a, t, id),
    guardarCopiaDoArquivo: async (a) => a,
    apagarArquivoLocal: () => undefined,
    aoMudar: () => undefined,
  });
  return {
    cliente,
    eu,
    banco,
    sincronizador,
    envio,
    leitura: criarLeitura(banco, () => pessoa),
    modoAviao: () => void (conexao = "offline"),
    sinalVoltou: () => void (conexao = "online"),
  };
}
type Aparelho = Awaited<ReturnType<typeof aparelho>>;

const minutosAtras = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

async function main() {
  const tiago = await aparelho("tiago.tecnico@empresa.com.br");
  const tais = await aparelho("tais.tecnica@empresa.com.br");
  const meuId = tiago.eu.usuario.id;
  const taisId = tais.eu.usuario.id;
  assert.equal(tiago.eu.equipe?.id, tais.eu.equipe?.id);

  // ================================================================ 1. a cópia da equipe
  const sincronizacao = await tiago.sincronizador.sincronizar();
  assert.deepEqual([sincronizacao.copiaAtualizada, sincronizacao.semSinal, sincronizacao.erro], [true, false, null]);
  ok("a cópia da equipe foi baixada para o SQLite (POST /sync/pull)");

  // A leitura local tem que dar o mesmo que a `api` dá: a lista de cada status, o detalhe, a escolha do modelo, o modelo e a equipe.
  for (const status of ["liberada", "pendente", "em_execucao"] as OsStatus[]) {
    const daApi = await tiago.cliente.chamar<ListaDeOs>("/os", { consulta: { status, tamanho: 50 } });
    const local = await tiago.leitura.lista({ status, pagina: 1, tamanho: 50 });
    assert.deepEqual(local.os.map((o) => o.id), daApi.os.map((o) => o.id), `a ordem da lista '${status}' é a da api`);
    assert.equal(local.total, daApi.total);
    assert.deepEqual(local.contagem_por_status, daApi.contagem_por_status);
    for (const [i, o] of local.os.entries()) {
      const a = daApi.os[i]!;
      for (const chave of Object.keys(o) as (keyof typeof o)[]) {
        const esperado = chave === "local_instalacao" ? { id: a.local_instalacao.id, codigo: a.local_instalacao.codigo, critico: a.local_instalacao.critico } : (a[chave] ?? null);
        assert.deepEqual(o[chave] ?? null, esperado, `o campo ${chave} da OS ${a.numero_ordem} na lista '${status}'`);
      }
    }
  }
  const busca = await tiago.cliente.chamar<ListaDeOs>("/os", { consulta: { status: "liberada", busca: "retificador", tamanho: 50 } });
  assert.deepEqual((await tiago.leitura.lista({ status: "liberada", busca: "retificador", pagina: 1, tamanho: 50 })).os.map((o) => o.id), busca.os.map((o) => o.id), "a busca acha as mesmas OS");
  ok("a lista local (liberadas, pendentes, em execução, a contagem e a busca) é igual à da api");

  const lista = await tiago.cliente.chamar<ListaDeOs>("/os", { consulta: { status: "liberada", tamanho: 10 } });
  const [osA, osB, osC, osD] = lista.os;
  assert.ok(osD, "há ao menos 4 OS liberadas na carga local");
  const daApi = await tiago.cliente.chamar<DetalheDaOs>(`/os/${osA!.id}`);
  const local = await tiago.leitura.detalhe(osA!.id);
  assert.equal(local.os.titulo, daApi.os.titulo);
  assert.equal(local.os.status, daApi.os.status);
  for (const chave of ["id", "codigo", "critico", "cliente", "endereco"] as const) assert.deepEqual(local.os.local_instalacao[chave] ?? null, daApi.os.local_instalacao[chave] ?? null, `o campo ${chave} do local`);
  assert.deepEqual(local.os.equipe, daApi.os.equipe);
  assert.equal(local.os.pdf_pronto, daApi.os.pdf_pronto);
  assert.deepEqual(local.servico, daApi.servico);
  assert.deepEqual(local.checklist_inspecao ?? [], daApi.checklist_inspecao ?? []);
  ok("o detalhe local (OS, local, equipe, serviço e materiais, checklist de inspeção) é igual ao da api");

  const escolhaApi = await tiago.cliente.chamar<EscolhaDoModelo>(`/os/${osA!.id}/modelos-apr`);
  assert.deepEqual(await tiago.leitura.escolhaDoModelo(osA!.id), escolhaApi);
  const codigo = escolhaApi.recomendado ?? escolhaApi.modelos[0]!.codigo;
  const modelo = await tiago.cliente.chamar<ModeloCompleto>(`/modelos-apr/${encodeURIComponent(codigo)}/versoes/publicada`);
  const modeloLocal = await tiago.leitura.modeloPublicado(codigo);
  assert.deepEqual([modeloLocal.id, modeloLocal.codigo, modeloLocal.versao, modeloLocal.titulo], [modelo.id, modelo.codigo, modelo.versao, modelo.titulo]);
  const doItem = (i: ModeloCompleto["itens"][number]) => ({ id: i.id, secao: i.secao, risco_id: i.risco_id, ordem: i.ordem, texto: i.texto, permite_na: i.permite_na });
  assert.deepEqual(modeloLocal.itens.map(doItem), modelo.itens.map(doItem), "os itens do modelo local são os da api, sem o que é eliminatório");
  assert.deepEqual(modeloLocal.riscos.map((x) => [x.id, x.classificacao, x.nome, x.ordem]), modelo.riscos.map((x) => [x.id, x.classificacao, x.nome, x.ordem]));
  assert.ok(modeloLocal.itens.every((i) => !("tipo" in i) && !("resposta_bloqueante" in i) && !("evidencia" in i)));
  const { usuarios } = await tiago.cliente.chamar<{ usuarios: { id: string; nome: string; assinatura_path: string | null }[] }>("/usuarios", { consulta: { equipe_id: tiago.eu.equipe!.id, tamanho: 200 } });
  const colegas = await tiago.leitura.colegas(tiago.eu.equipe!.id);
  assert.deepEqual(colegas.map((c) => [c.id, c.nome, c.assinatura_path]).sort(), usuarios.map((c) => [c.id, c.nome, c.assinatura_path]).sort());
  ok(`a escolha do modelo (recomendado: ${escolhaApi.recomendado}), o modelo ${codigo} e a equipe locais são iguais aos da api`);

  /** As respostas que passam: o técnico não as conhece, mas o script as acha com a `api` (cada tentativa que reprova registra uma APR bloqueada, que é descartável). */
  const respostasQuePassam = new Map<string, Resposta>(perguntasDe(modelo, []).map((i) => [i.id, "sim"]));
  const comecar = (osId: string, participantes: string[]) =>
    novoRascunho({ osId, usuarioId: meuId, modelo, participantes: participantes.map((p, i) => ({ usuarioId: p, funcao: i === 0 ? "responsavel" : "executor" })), riscos: [] });
  const preencherCom = (osId: string, respostas: Map<string, Resposta>) => {
    let r = comecar(osId, [meuId, taisId]);
    for (const item of perguntasDe(r.modelo, r.riscos)) r = responder(r, item, respostas.get(item.id)!);
    return r;
  };
  const preencher = (osId: string) => preencherCom(osId, respostasQuePassam);
  const avaliar = (r: RascunhoApr) => tiago.cliente.chamar<{ resultado: string; reprovados: { item_id: string }[] }>("/aprs/avaliar", { corpo: montarAvaliacao({ ...r, concluidaEm: new Date().toISOString() }) });
  // Cada tentativa que reprova registra uma APR bloqueada na OS C, que não é usada depois.
  for (let tentativa = 0; ; tentativa++) {
    assert.ok(tentativa < 4, "o modelo tem combinação que passe");
    const resposta = await avaliar(preencher(osC!.id));
    if (resposta.resultado === "aprovada") break;
    for (const x of resposta.reprovados) respostasQuePassam.set(x.item_id, respostasQuePassam.get(x.item_id) === "sim" ? "nao" : "sim");
  }

  // ================================================================ 2. APR, execução e encerramento sem sinal
  tiago.modoAviao();
  const r = preencher(osA!.id);
  const apr = await tiago.envio.enviarEvento({ id: r.eventoId, tipo: "apr_concluida", os_id: osA!.id, payload: { ...montarPayload({ ...r, concluidaEm: new Date().toISOString() }), assinatura_presencial: true } });
  assert.equal(apr.naFila, true);
  let detalhe = await tiago.leitura.detalhe(osA!.id);
  assert.equal(detalhe.aprs[0]!.aguardando_validacao, true);
  assert.deepEqual(detalhe.aprs[0]!.participantes.map((p) => Boolean(p.assinada_em)), [true, true]);
  const situacaoDe = async () => {
    const [d, abertas] = [await tiago.leitura.detalhe(osA!.id), await tiago.leitura.execucoesAbertas()];
    return { d, situacao: definirSituacao({ osStatus: d.os.status, usuarioId: meuId, execucoes: d.execucoes, aprs: d.aprs, abertas, agora: new Date(), reservadaPara: d.os.responsavel ?? null }) };
  };
  assert.equal((await situacaoDe()).situacao.tipo, "iniciar");
  ok("sem sinal: a APR fica na fila, 'aguardando validação', assinada por todos os presentes; a execução já pode começar");

  const execucaoId = novoUuid();
  const posicao = { latitude: -20.31, longitude: -40.29 };
  await tiago.envio.enviarEvento({ tipo: "execucao_iniciada", os_id: osA!.id, payload: { id: execucaoId, apr_id: r.aprId, numero_pessoas: 2, inicio: new Date().toISOString(), ...posicao } });
  assert.equal((await situacaoDe()).situacao.tipo, "em_andamento");
  assert.deepEqual((await tiago.leitura.lista({ status: "em_execucao", pagina: 1, tamanho: 50 })).os.map((o) => o.id).includes(osA!.id), true);
  assert.equal((await tiago.leitura.execucoesAbertas())[0]?.id, execucaoId);
  const pausaId = novoUuid();
  await tiago.envio.enviarEvento({ tipo: "pausa_iniciada", os_id: osA!.id, payload: { id: pausaId, execucao_id: execucaoId, inicio: new Date().toISOString(), motivo: "almoco", ...posicao } });
  assert.equal((await situacaoDe()).d.execucoes[0]!.pausas[0]!.fim, null);
  await tiago.envio.enviarEvento({ tipo: "pausa_encerrada", os_id: osA!.id, payload: { pausa_id: pausaId, fim: new Date().toISOString() } });
  await tiago.envio.enviarEvento({ tipo: "execucao_encerrada", os_id: osA!.id, payload: { execucao_id: execucaoId, fim: new Date().toISOString(), ...posicao } });
  assert.equal((await situacaoDe()).situacao.tipo, "encerrando");
  await tiago.envio.enviarEvento({ tipo: "encerramento_assinado", os_id: osA!.id, payload: { execucao_id: execucaoId, descricao_atividade: "Feito sem sinal.", evidencias: [] } });
  detalhe = await tiago.leitura.detalhe(osA!.id);
  assert.equal(detalhe.os.status, "aguardando_supervisor");
  assert.equal((await tiago.leitura.lista({ status: "aguardando_supervisor", pagina: 1, tamanho: 50 })).os.some((o) => o.id === osA!.id), true);
  assert.equal((await contarPendentes(tiago.banco, meuId)).eventos, 6);
  const aindaNoServidor = await tiago.cliente.chamar<DetalheDaOs>(`/os/${osA!.id}`);
  assert.equal(aindaNoServidor.os.status, "liberada", "o servidor ainda não sabe de nada");
  ok("sem sinal: início, pausa, continuar, encerrar e assinar o encerramento ficam na fila (6 registros) e a tela segue para 'aguardando o supervisor'; o servidor ainda não sabe");

  // ================================================================ 3. o sinal volta
  tiago.sinalVoltou();
  const subida = await tiago.sincronizador.sincronizar();
  assert.deepEqual([subida.confirmados, subida.recusados, subida.restantes, subida.semSinal, subida.erro, subida.copiaAtualizada], [6, 0, 0, false, null, true]);
  assert.deepEqual(await eventosPendentes(tiago.banco, meuId), []);
  const noServidor = await tiago.cliente.chamar<DetalheDaOs & { execucoes: { id: string; encerramento_assinado_em: string | null; resultado: string | null; pausas: { fim: string | null }[] }[] }>(`/os/${osA!.id}`);
  assert.equal(noServidor.os.status, "aguardando_supervisor");
  assert.equal(noServidor.aprs.length, 1);
  assert.equal(noServidor.aprs[0]!.resultado, "aprovada");
  assert.ok(noServidor.aprs[0]!.participantes.every((p) => p.assinatura_presencial && p.assinada_em), "as assinaturas vieram como presenciais");
  assert.equal(noServidor.execucoes.length, 1);
  assert.equal(noServidor.execucoes[0]!.resultado, "encerrada");
  assert.ok(noServidor.execucoes[0]!.encerramento_assinado_em);
  assert.ok(noServidor.execucoes[0]!.pausas.every((p) => p.fim));
  const depoisDaCopia = await tiago.leitura.detalhe(osA!.id);
  assert.equal(depoisDaCopia.os.status, "aguardando_supervisor");
  assert.equal(depoisDaCopia.aprs[0]!.aguardando_validacao, undefined, "agora a APR veio do servidor, validada");
  ok("o sinal voltou: os 6 registros subiram em ordem, a fila esvaziou e o servidor tem a APR (assinaturas presenciais), a execução e o encerramento; a cópia nova bate");

  // O reenvio não duplica: o mesmo evento de novo é confirmado sem efeito.
  const reenvio = await tiago.cliente.chamar<RespostaEventos>("/eventos", { corpo: { eventos: [{ id: apr.id, tipo: "apr_concluida", os_id: osA!.id, payload: { ...montarPayload({ ...r, concluidaEm: new Date().toISOString() }), assinatura_presencial: true }, ocorrido_em: new Date().toISOString() }] } });
  assert.deepEqual(reenvio.confirmados, [apr.id]);
  assert.equal((await tiago.cliente.chamar<DetalheDaOs>(`/os/${osA!.id}`)).aprs.length, 1);
  ok("reenviar o mesmo evento é confirmado e não duplica a APR");

  // ================================================================ 4. o evento adiado: a assinatura de outro aparelho ainda não chegou
  tiago.modoAviao();
  const rB = preencher(osB!.id);
  const aprNormal = { ...montarPayload({ ...rB, concluidaEm: minutosAtras(5) }) };
  await tiago.envio.enviarEvento({ id: rB.eventoId, tipo: "apr_concluida", os_id: osB!.id, payload: aprNormal, ocorrido_em: minutosAtras(5) });
  const execB = novoUuid();
  await tiago.envio.enviarEvento({ tipo: "execucao_iniciada", os_id: osB!.id, payload: { id: execB, apr_id: rB.aprId, inicio: minutosAtras(4) }, ocorrido_em: minutosAtras(4) });
  tiago.sinalVoltou();
  const adiada = await tiago.sincronizador.sincronizar();
  assert.deepEqual([adiada.confirmados, adiada.restantes], [1, 1]);
  const fila = await eventosPendentes(tiago.banco, meuId);
  assert.equal(fila[0]!.tipo, "execucao_iniciada");
  assert.match(fila[0]!.ultimoErro ?? "", /assinaturas/i);
  assert.equal((await tiago.leitura.detalhe(osB!.id)).os.status, "em_execucao", "o aparelho mostra a execução que o técnico fez, mesmo adiada no servidor");
  assert.equal((await eventosRecusados(tiago.banco, meuId)).length, 0, "adiado não é recusado");
  ok("a execução feita sem sinal fica na fila quando falta a assinatura de outro aparelho (a APR chegou sem as assinaturas) e o aparelho continua mostrando-a");
  for (const quem of [tiago, tais]) await quem.cliente.chamar("/eventos", { corpo: { eventos: [{ id: novoUuid(), tipo: "apr_assinada", os_id: osB!.id, payload: { apr_id: rB.aprId }, ocorrido_em: new Date().toISOString() }] } });
  const liberada = await tiago.sincronizador.sincronizar();
  assert.deepEqual([liberada.confirmados, liberada.restantes], [1, 0]);
  assert.equal((await tiago.cliente.chamar<DetalheDaOs>(`/os/${osB!.id}`)).os.status, "em_execucao");
  ok("as duas assinaturas chegaram: na sincronização seguinte a execução adiada sobe");

  // ================================================================ 5. a APR sem sinal que o servidor bloqueia (D1)
  // O que reprova: parte do que passa e inverte um item de cada vez, até a `api` reprovar (o técnico não sabe o que bloqueia; este script pergunta).
  let reprova: Map<string, Resposta> | null = null;
  for (const item of perguntasDe(modelo, [])) {
    const tentativa = new Map(respostasQuePassam).set(item.id, respostasQuePassam.get(item.id) === "sim" ? "nao" : "sim");
    if ((await avaliar(preencherCom(osC!.id, tentativa))).resultado === "bloqueada") {
      reprova = tentativa;
      break;
    }
  }
  assert.ok(reprova, "alguma resposta invertida reprova a APR");
  tiago.modoAviao();
  const respondida = preencherCom(osD.id, reprova);
  await tiago.envio.enviarEvento({ id: respondida.eventoId, tipo: "apr_concluida", os_id: osD.id, payload: { ...montarPayload({ ...respondida, concluidaEm: minutosAtras(3) }), assinatura_presencial: true }, ocorrido_em: minutosAtras(3) });
  const execD = novoUuid();
  await tiago.envio.enviarEvento({ tipo: "execucao_iniciada", os_id: osD.id, payload: { id: execD, apr_id: respondida.aprId, inicio: minutosAtras(2) }, ocorrido_em: minutosAtras(2) });
  tiago.sinalVoltou();
  const d1 = await tiago.sincronizador.sincronizar();
  assert.deepEqual([d1.confirmados, d1.recusados, d1.restantes], [2, 0, 0]);
  const emD = await tiago.cliente.chamar<DetalheDaOs & { alertas: { tipo: string; detalhe: string }[] }>(`/os/${osD.id}`);
  assert.equal(emD.aprs[0]!.resultado, "bloqueada");
  assert.equal(emD.os.status, "em_execucao");
  assert.equal(emD.execucoes.length, 1, "a execução feita sem sinal não se perdeu");
  ok("a APR feita sem sinal que o servidor bloqueou foi registrada como bloqueada e a execução feita com ela foi aplicada (a Decisão-chave 2), sem recusar nada");

  // ================================================================ 6. o que o servidor recusa de vez vai para os registros recusados
  tiago.modoAviao();
  await tiago.envio.enviarEvento({ tipo: "pausa_iniciada", os_id: osA!.id, payload: { id: novoUuid(), execucao_id: execucaoId, inicio: new Date().toISOString(), motivo: "almoco" } });
  tiago.sinalVoltou();
  const recusa = await tiago.sincronizador.sincronizar();
  assert.deepEqual([recusa.confirmados, recusa.recusados, recusa.restantes], [0, 1, 0]);
  const recusados = await eventosRecusados(tiago.banco, meuId);
  assert.equal(recusados.length, 1);
  assert.equal(recusados[0]!.codigo, "execucao_finalizada");
  ok(`a pausa numa execução que já tinha terminado foi recusada de vez e ficou guardada: "${recusados[0]!.mensagem}"`);

  console.log("\nO modo offline funciona de ponta a ponta contra a api local.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
