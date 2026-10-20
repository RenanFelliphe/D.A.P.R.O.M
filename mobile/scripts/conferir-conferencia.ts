/**
 * Confere a conferência da execução (execução compartilhada, etapa 3) contra uma `api` de verdade, sem aparelho: dois aparelhos da mesma
 * equipe (cada um com o seu SQLite, a sua fila e o seu cliente, o mesmo código de `src/offline/` do app) registram a MESMA execução sem
 * sinal, com horários e pausas diferentes, e sobem as filas em momentos diferentes. O primeiro a chegar vira a execução; o segundo vira
 * versão (nada é recusado). Depois que os dois sincronizam (o app manda a `fila` no `POST /sync/pull`), a conferência aparece como
 * "com divergência": o responsável escolhe pelo corpo que o app monta (`corpoDeDecidir`), o outro assina com ressalva, e ela termina
 * concluída. Pensado para a `api` local em memória:
 *
 *   cd api && PORT=3399 pnpm dev:local          (em outro terminal)
 *   cd mobile && API_URL=http://localhost:3399 pnpm conferir:conferencia
 *
 * Nunca aponte para a `api` do Supabase compartilhado: o script cria APRs, execuções e conferências.
 */
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { montarAvaliacao, montarPayload, novoRascunho, perguntasDe, responder, type ModeloCompleto, type RascunhoApr, type Resposta } from "@shared/api/apr";
import type { ConferenciaDaApi, ConferenciaResumo } from "@shared/api/conferencia-execucao";
import { passoDaConferencia } from "@shared/api/conferencia-texto";
import { definirSituacao } from "@shared/api/execucao-situacao";
import type { RespostaEventos } from "@shared/api/eventos";
import type { DetalheDaOs, ListaDeOs } from "@shared/api/os-app";
import type { RespostaMe } from "@shared/api/tipos";
import { novoUuid } from "@shared/api/uuid";
import { criarClienteApi, type ArmazemDeTokens, type Tokens } from "../src/api/cliente";
import { ErroDaApi } from "../src/api/erros";
import { criarEnvio } from "../src/api/eventos";
import { camposParaEscolher, conferenciasQuePedemAcao, corpoDeAssinar, corpoDeDecidir, escolhasIniciais, faixaDeConferencia } from "../src/conferencia/regras";
import { criarBanco, type Banco, type Parametro } from "../src/offline/banco";
import { criarEnvioComFila } from "../src/offline/envio";
import { migrar } from "../src/offline/esquema";
import { contarPendentes, eventosRecusados } from "../src/offline/fila";
import { criarLeitura } from "../src/offline/leitura";
import { criarSincronizador, type Conexao } from "../src/offline/sincronizar";
import type { SnapshotDaApi } from "../src/offline/tipos";
import { decidirAcao } from "../src/os/detalhe/acao";

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
    // O que o app faz de verdade: manda quantos registros ainda esperam na fila, por OS (`app.ts`).
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
const POSICAO = { latitude: -20.31, longitude: -40.29 };

async function main() {
  const tiago = await aparelho("tiago.tecnico@empresa.com.br");
  const tais = await aparelho("tais.tecnica@empresa.com.br");
  const tiagoId = tiago.eu.usuario.id;
  const taisId = tais.eu.usuario.id;
  assert.equal(tiago.eu.equipe?.id, tais.eu.equipe?.id, "Tiago e Taís são da mesma equipe");

  // ================================================================ 1. os dois usam o app: sincronizam com a fila vazia
  for (const quem of [tiago, tais]) {
    const r = await quem.sincronizador.sincronizar();
    assert.deepEqual([r.copiaAtualizada, r.semSinal, r.erro], [true, false, null]);
  }
  ok("os dois aparelhos baixaram a cópia da equipe (POST /sync/pull com a fila vazia): os dois já usam o app");

  // ================================================================ 2. a APR, assinada pelos dois (com sinal)
  const lista = await tiago.cliente.chamar<ListaDeOs>("/os", { consulta: { status: "liberada", tamanho: 10 } });
  const osA = lista.os[0];
  assert.ok(osA, "há OS liberada na carga local");
  const escolha = await tiago.cliente.chamar<{ recomendado: string | null; modelos: { codigo: string }[] }>(`/os/${osA.id}/modelos-apr`);
  const codigo = escolha.recomendado ?? escolha.modelos[0]!.codigo;
  const modelo = await tiago.cliente.chamar<ModeloCompleto>(`/modelos-apr/${encodeURIComponent(codigo)}/versoes/publicada`);
  const preencher = (respostas: Map<string, Resposta>): RascunhoApr => {
    let r = novoRascunho({
      osId: osA.id,
      usuarioId: tiagoId,
      modelo,
      participantes: [
        { usuarioId: tiagoId, funcao: "responsavel" },
        { usuarioId: taisId, funcao: "executor" },
      ],
      riscos: [],
    });
    for (const item of perguntasDe(r.modelo, r.riscos)) r = responder(r, item, respostas.get(item.id)!);
    return r;
  };
  // O técnico não sabe o que é eliminatório; o script pergunta à `api` e inverte o que ela reprova, até aprovar.
  const respostas = new Map<string, Resposta>(perguntasDe(modelo, []).map((i) => [i.id, "sim"]));
  const concluidaEm = minutosAtras(50);
  let aprId: string | null = null;
  for (let tentativa = 0; tentativa < 4 && !aprId; tentativa++) {
    const r = preencher(respostas);
    const avaliacao = await tiago.cliente.chamar<{ resultado: string; reprovados: { item_id: string }[] }>("/aprs/avaliar", { corpo: montarAvaliacao({ ...r, concluidaEm }) });
    if (avaliacao.resultado === "aprovada") {
      await tiago.envio.enviarEvento({ id: r.eventoId, tipo: "apr_concluida", os_id: osA.id, payload: montarPayload({ ...r, concluidaEm }), ocorrido_em: concluidaEm });
      aprId = r.aprId;
    } else {
      for (const x of avaliacao.reprovados) respostas.set(x.item_id, respostas.get(x.item_id) === "sim" ? "nao" : "sim");
    }
  }
  assert.ok(aprId, "o modelo tem combinação de respostas que passe");
  for (const quem of [tiago, tais]) await quem.cliente.chamar("/eventos", { corpo: { eventos: [{ id: novoUuid(), tipo: "apr_assinada", os_id: osA.id, payload: { apr_id: aprId }, ocorrido_em: new Date().toISOString() }] } });
  for (const quem of [tiago, tais]) await quem.sincronizador.sincronizar();
  ok(`APR ${codigo} aprovada e assinada pelos dois, com sinal; as duas cópias já a trazem`);

  // ================================================================ 3. sem sinal, cada aparelho registra a execução do seu jeito
  const situacaoDe = async (quem: Aparelho) => {
    const [d, abertas] = [await quem.leitura.detalhe(osA.id), await quem.leitura.execucoesAbertas()];
    return definirSituacao({ osStatus: d.os.status, usuarioId: quem.eu.usuario.id, execucoes: d.execucoes, aprs: d.aprs, abertas, agora: new Date(), reservadaPara: d.os.responsavel ?? null }).tipo;
  };
  tiago.modoAviao();
  tais.modoAviao();
  assert.equal(await situacaoDe(tiago), "iniciar");
  assert.equal(await situacaoDe(tais), "iniciar", "sem sinal, quem não tem a execução na cópia dele já vê 'Iniciar a execução' (sem tela nova)");

  // A conferência espera quem ainda não sincronizou DEPOIS do fim da execução: o fim da execução (o da Taís, que vai chegar primeiro) tem de ser
  // mais novo que a última sincronização dos dois, como é na vida real (o aparelho registra depois de ter baixado a cópia).
  await new Promise((r) => setTimeout(r, 1500));
  const execTiago = novoUuid();
  const execTais = novoUuid();
  const pausaTiago = novoUuid();
  const pausaTais = novoUuid();
  const registrar = async (quem: Aparelho, execucaoId: string, pausaId: string, minutos: { inicio: number; pausaDe: number; pausaAte: number; fim: number }) => {
    const e = quem.envio.enviarEvento;
    await e({ tipo: "execucao_iniciada", os_id: osA.id, payload: { id: execucaoId, apr_id: aprId, numero_pessoas: 2, inicio: minutosAtras(minutos.inicio), ...POSICAO }, ocorrido_em: minutosAtras(minutos.inicio) });
    await e({ tipo: "pausa_iniciada", os_id: osA.id, payload: { id: pausaId, execucao_id: execucaoId, inicio: minutosAtras(minutos.pausaDe), motivo: "almoco", ...POSICAO }, ocorrido_em: minutosAtras(minutos.pausaDe) });
    await e({ tipo: "pausa_encerrada", os_id: osA.id, payload: { pausa_id: pausaId, fim: minutosAtras(minutos.pausaAte) }, ocorrido_em: minutosAtras(minutos.pausaAte) });
    await e({ tipo: "execucao_encerrada", os_id: osA.id, payload: { execucao_id: execucaoId, fim: minutosAtras(minutos.fim), ...POSICAO }, ocorrido_em: minutosAtras(minutos.fim) });
  };
  // Tiago começa antes (é o responsável de verdade) e termina antes; Taís começa 10 minutos depois e termina 8 minutos depois (agora).
  await registrar(tiago, execTiago, pausaTiago, { inicio: 40, pausaDe: 25, pausaAte: 18, fim: 8 });
  await registrar(tais, execTais, pausaTais, { inicio: 30, pausaDe: 24, pausaAte: 12, fim: 0 });
  assert.equal(await situacaoDe(tiago), "encerrando");
  assert.equal(await situacaoDe(tais), "encerrando");
  assert.equal((await contarPendentes(tiago.banco, tiagoId)).eventos, 4);
  assert.equal((await contarPendentes(tais.banco, taisId)).eventos, 4);
  assert.equal((await tiago.cliente.chamar<DetalheDaOs>(`/os/${osA.id}`)).execucoes.length, 0, "o servidor ainda não sabe de nada");
  ok("sem sinal, os dois aparelhos registraram a mesma execução (início, pausa, continuar, encerrar) com horários diferentes: 4 registros em cada fila");

  // ================================================================ 4. o sinal volta: o primeiro a chegar vira a execução; o outro, versão (nada é recusado)
  tais.sinalVoltou();
  const subidaTais = await tais.sincronizador.sincronizar();
  assert.deepEqual([subidaTais.confirmados, subidaTais.recusados, subidaTais.restantes, subidaTais.erro], [4, 0, 0, null]);
  tiago.sinalVoltou();
  const subidaTiago = await tiago.sincronizador.sincronizar();
  assert.deepEqual([subidaTiago.confirmados, subidaTiago.recusados, subidaTiago.restantes, subidaTiago.erro], [4, 0, 0, null], "o segundo aparelho não é recusado: o início dele vira versão da mesma execução");
  assert.equal((await eventosRecusados(tiago.banco, tiagoId)).length, 0);
  const noServidor = await tiago.cliente.chamar<DetalheDaOs>(`/os/${osA.id}`);
  assert.equal(noServidor.execucoes.length, 1, "uma execução só");
  assert.equal(noServidor.execucoes[0]!.id, execTais);
  assert.equal(noServidor.execucoes[0]!.executor.id, taisId, "quem chegou primeiro à api fica como responsável gravado");
  ok("o aparelho da Taís chegou primeiro e virou a execução; o do Tiago subiu depois (4 de 4 confirmados, nenhum recusado) e virou versão dela");

  await tais.envio.enviarEvento({ tipo: "encerramento_assinado", os_id: osA.id, payload: { execucao_id: execTais, descricao_atividade: "Feito sem sinal pelo aparelho da Taís.", evidencias: [] } });

  // ================================================================ 5. sincronizar de novo (com a fila vazia): a conferência é montada
  for (const quem of [tais, tiago]) {
    const r = await quem.sincronizador.sincronizar();
    assert.deepEqual([r.copiaAtualizada, r.semSinal, r.erro], [true, false, null]);
  }
  const doTiago = (await tiago.cliente.chamar<{ conferencias: ConferenciaResumo[] }>("/me/conferencias")).conferencias.find((c) => c.os.id === osA.id);
  assert.ok(doTiago, "a conferência aparece em GET /me/conferencias");
  assert.equal(doTiago.tipo, "com_divergencia");
  assert.equal(doTiago.estado, "aguardando_responsavel");
  assert.equal(doTiago.minha_acao, "decidir", "o responsável de verdade é quem começou primeiro");
  const daTais = (await tais.cliente.chamar<{ conferencias: ConferenciaResumo[] }>("/me/conferencias")).conferencias.find((c) => c.os.id === osA.id);
  assert.equal(daTais?.minha_acao, "aguardar");
  assert.equal(faixaDeConferencia([doTiago])?.conferencia.id, doTiago.id, "a faixa do app aparece para quem precisa escolher");
  assert.equal(conferenciasQuePedemAcao([daTais!]).length, 0, "e não aparece para quem só espera");
  const osDoTiago = await tiago.cliente.chamar<DetalheDaOs>(`/os/${osA.id}`);
  assert.deepEqual(osDoTiago.conferencias?.map((c) => [c.id, c.estado, c.tipo]), [[doTiago.id, "aguardando_responsavel", "com_divergencia"]]);
  const acao = decidirAcao({ os: osDoTiago.os, usuarioId: tiagoId, aprs: osDoTiago.aprs, execucoes: osDoTiago.execucoes, ausencia: null, conferencias: osDoTiago.conferencias });
  assert.ok(acao.botoes.some((b) => b.acao === "abrir-conferencia" && b.conferenciaId === doTiago.id), "o detalhe da OS oferece abrir a conferência");
  ok("a conferência aparece em /me/conferencias (decidir para o Tiago, aguardar para a Taís), no detalhe da OS e na faixa do app, como 'com divergência'");

  // ================================================================ 6. o responsável escolhe pelo corpo que o app monta
  const c = await tiago.cliente.chamar<ConferenciaDaApi>(`/conferencias/${doTiago.id}`);
  assert.equal(c.responsavel?.id, tiagoId);
  assert.deepEqual(c.campos.filter((x) => x.divergente).map((x) => x.campo), ["inicio", "fim", "pausa:1"]);
  assert.equal(c.campos.find((x) => x.campo === "resultado")?.divergente, false, "os dois encerraram");
  assert.deepEqual(camposParaEscolher(c).map((x) => x.campo), c.eu.pode_decidir.slice().sort((a, b) => c.campos.findIndex((x) => x.campo === a) - c.campos.findIndex((x) => x.campo === b)));
  assert.equal(escolhasIniciais(c).inicio, tiagoId, "o padrão sugerido é o início mais antigo");
  assert.equal(passoDaConferencia(c).titulo, "Escolha a versão certa");
  await assert.rejects(
    tais.cliente.chamar(`/conferencias/${c.id}/decidir`, { metodo: "POST", corpo: { escolhas: [{ campo: "fim", escolha: taisId }] } }),
    (e: unknown) => e instanceof ErroDaApi && e.status === 403,
  );
  const decidida = await tiago.cliente.chamar<ConferenciaDaApi>(`/conferencias/${c.id}/decidir`, { metodo: "POST", corpo: corpoDeDecidir(c, {}) });
  assert.equal(decidida.estado, "aguardando_assinaturas");
  assert.equal(decidida.decisoes.length, 3);
  assert.equal(decidida.eu.pode_decidir.length, 0);
  const depois = await tiago.cliente.chamar<DetalheDaOs>(`/os/${osA.id}`);
  assert.equal(depois.execucoes[0]!.executor.id, tiagoId, "a execução passa a ter o Tiago como responsável e os horários dele");
  ok("o responsável escolheu pelo corpo do app (o padrão sugerido nos três campos); a Taís não pode escolher (403); a execução foi corrigida");

  // ================================================================ 7. o outro assina (com ressalva) e a conferência termina
  const paraAssinar = await tais.cliente.chamar<ConferenciaDaApi>(`/conferencias/${c.id}`);
  assert.equal(paraAssinar.eu.deve_assinar, true);
  assert.equal(passoDaConferencia(paraAssinar).titulo, "Confira e assine");
  assert.equal((await tais.cliente.chamar<{ conferencias: ConferenciaResumo[] }>("/me/conferencias")).conferencias.find((x) => x.id === c.id)?.minha_acao, "assinar");
  const final = await tais.cliente.chamar<ConferenciaDaApi>(`/conferencias/${c.id}/assinar`, { metodo: "POST", corpo: corpoDeAssinar("  Cheguei depois do almoço e não vi a pausa.  ") });
  assert.equal(final.estado, "concluida");
  assert.equal(final.participantes.find((p) => p.usuario.id === taisId)?.assinatura?.ressalva, "Cheguei depois do almoço e não vi a pausa.");
  await assert.rejects(tais.cliente.chamar(`/conferencias/${c.id}/assinar`, { metodo: "POST", corpo: {} }), (e: unknown) => e instanceof ErroDaApi && e.status === 409);
  for (const quem of [tiago, tais]) {
    assert.deepEqual((await quem.cliente.chamar<{ conferencias: ConferenciaResumo[] }>("/me/conferencias")).conferencias.filter((x) => x.os.id === osA.id), [], "terminada, sai de 'Para conferir'");
  }
  const osFinal = await tiago.cliente.chamar<DetalheDaOs>(`/os/${osA.id}`);
  assert.equal(osFinal.conferencias?.[0]?.estado, "concluida");
  ok("a Taís assinou com ressalva (o corpo vem de corpoDeAssinar), a conferência terminou 'concluída', sumiu de 'Para conferir' e o detalhe da OS mostra o novo estado");

  console.log("\nA conferência da execução funciona de ponta a ponta contra a api local (dois aparelhos, sem sinal).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
