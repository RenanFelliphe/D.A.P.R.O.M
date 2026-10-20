/**
 * Confere o fluxo de campo do app contra uma `api` de verdade (sem aparelho): a APR (modelo, validação, registro, assinaturas de duas
 * contas), a execução (iniciar, pausar, continuar, encerrar em dois passos), o cancelamento por engano, a interrupção por risco com
 * foto, a APR bloqueada com a evidência e o envio de arquivos. Usa as mesmas funções de `shared/` e o mesmo cliente das telas. Pensado
 * para a `api` local em memória:
 *
 *   cd api && PORT=3399 pnpm dev:local          (em outro terminal)
 *   cd mobile && API_URL=http://localhost:3399 pnpm conferir:campo
 *
 * Nunca aponte para a `api` do Supabase compartilhado: o script cria APRs, execuções e arquivos.
 */
import assert from "node:assert/strict";
import { adicionarDocumento, adicionarFoto, montarAvaliacao, montarPayload, novoRascunho, observar, perguntasDe, responder, type Avaliacao, type EscolhaDoModelo, type ModeloCompleto, type RascunhoApr, type Resposta } from "@shared/api/apr";
import { dadosDaInspecao } from "@shared/api/checklist-inspecao";
import { comoEvidencia, pdfComoEvidencia } from "@shared/api/evidencias";
import { PRAZO_DO_PEDIDO_MS, pedidoAberto, type PedidoParaResponder } from "@shared/api/execucao-pedidos";
import { definirSituacao } from "@shared/api/execucao-situacao";
import { calcularTempo, type ExecucaoAberta } from "@shared/api/execucao-tempo";
import { ErroDeEvento } from "@shared/api/eventos";
import { comPosicao } from "@shared/api/localizacao";
import { aprDeHoje, situacaoDaApr, type DetalheDaOs, type ListaDeOs } from "@shared/api/os-app";
import type { RespostaMe } from "@shared/api/tipos";
import { novoUuid } from "@shared/api/uuid";
import { criarClienteApi, type ArmazemDeTokens, type ClienteApi, type Tokens } from "../src/api/cliente";
import { criarEnvio } from "../src/api/eventos";
import { equipeDaApr } from "../src/apr/equipe";
import type { ColegaDaEquipe } from "../src/apr/consultas";
import type { DetalheParaExecutar } from "../src/execucao/consultas";
import { intervaloDaLeitura } from "../src/execucao/intervalo-da-leitura";

const API_URL = process.env.API_URL ?? "http://localhost:3399";
const SENHA = "synqos123";
const ok = (msg: string) => console.log(`ok  ${msg}`);

/** PNG de 1×1 pixel e um PDF mínimo (a `api` confere o cabeçalho). */
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");

function novoCliente() {
  let tokens: Tokens | null = null;
  const armazem: ArmazemDeTokens = { ler: async () => tokens, gravar: async (t) => void (tokens = t), apagar: async () => void (tokens = null) };
  const cliente = criarClienteApi({ urlBase: API_URL, armazem });
  return { cliente, ...criarEnvio(cliente) };
}
type Conta = ReturnType<typeof novoCliente>;

/** No Node, o arquivo entra no multipart como Blob (no aparelho, como `{uri, name, type}`); o formato que a `api` lê é o mesmo. */
async function subir(cliente: ClienteApi, bytes: Uint8Array, tipo: "foto" | "pdf", nome: string, tipoMime: string): Promise<string> {
  const id = novoUuid();
  const formulario = new FormData();
  formulario.append("arquivo", new Blob([bytes as BlobPart], { type: tipoMime }), nome);
  formulario.append("tipo", tipo);
  await cliente.chamar(`/arquivos/${id}`, { metodo: "PUT", formulario });
  return id;
}

async function entrar(email: string): Promise<{ conta: Conta; eu: RespostaMe }> {
  const conta = novoCliente();
  await conta.cliente.entrar(email, SENHA);
  return { conta, eu: await conta.cliente.chamar<RespostaMe>("/me") };
}

const detalheDe = (conta: Conta, osId: string) => conta.cliente.chamar<DetalheParaExecutar & { aprs: { id: string; resultado: string; concluida_em: string; participantes: never[]; respostas: { item_id: string }[]; itens_reprovados: { item_id: string; observacao: string | null; fotos: unknown[]; documentos?: unknown[] }[] }[]; os: { status: string } }>(`/os/${osId}`);

/** Responde o checklist inteiro com `resposta` (o NA, onde o modelo o aceita, leva observação). */
function responderTudo(r: RascunhoApr, resposta: Resposta): RascunhoApr {
  let atual = r;
  for (const item of perguntasDe(r.modelo, r.riscos)) {
    atual = responder(atual, item, resposta);
  }
  return atual;
}

/** Valida na `api` (o que o botão "Concluir e validar" faz) e guarda o resultado no rascunho. */
async function validar(conta: Conta, osId: string, rascunho: RascunhoApr): Promise<RascunhoApr> {
  const concluidaEm = new Date().toISOString();
  const resposta = await conta.cliente.chamar<{ resultado: Avaliacao["resultado"]; reprovados: { item_id: string; texto: string; evidencia: "foto" | "pdf" | "texto" }[] }>("/aprs/avaliar", { corpo: montarAvaliacao({ ...rascunho, concluidaEm }) });
  assert.ok(osId);
  return { ...rascunho, concluidaEm, avaliacao: { resultado: resposta.resultado, reprovados: resposta.reprovados.map((x) => ({ itemId: x.item_id, texto: x.texto, evidencia: x.evidencia })) } };
}

async function main() {
  const tiago = await entrar("tiago.tecnico@empresa.com.br");
  const tais = await entrar("tais.tecnica@empresa.com.br");
  assert.equal(tiago.eu.equipe?.id, tais.eu.equipe?.id, "Tiago e Taís são da mesma equipe");
  const meuId = tiago.eu.usuario.id;
  const lista = await tiago.conta.cliente.chamar<ListaDeOs>("/os", { consulta: { status: "liberada", tamanho: 10 } });
  assert.ok(lista.os.length >= 3, "há ao menos 3 OS liberadas na carga local");
  const [osA, osB, osC] = lista.os;
  ok(`duas contas da mesma equipe (${tiago.eu.usuario.nome} e ${tais.eu.usuario.nome}) e ${lista.total} OS liberadas`);

  // --- a escolha do modelo, o modelo sem o que é eliminatório e a equipe da OS
  const escolha = await tiago.conta.cliente.chamar<EscolhaDoModelo>(`/os/${osA!.id}/modelos-apr`);
  assert.ok(escolha.modelos.length > 0, "há modelos publicados");
  assert.ok(escolha.recomendado === null || escolha.modelos.some((m) => m.codigo === escolha.recomendado));
  assert.ok(escolha.modelos.every((m) => Array.isArray(m.encontradas) && typeof m.descricao === "string"));
  const codigo = escolha.recomendado ?? escolha.modelos[0]!.codigo;
  const modelo = await tiago.conta.cliente.chamar<ModeloCompleto>(`/modelos-apr/${encodeURIComponent(codigo)}/versoes/publicada`);
  assert.ok(modelo.itens.length > 0 && modelo.riscos.length >= 0);
  assert.ok(modelo.itens.every((i) => !("tipo" in i) && !("resposta_bloqueante" in i) && !("evidencia" in i)), "o técnico não recebe o que é eliminatório");
  const { usuarios } = await tiago.conta.cliente.chamar<{ usuarios: ColegaDaEquipe[] }>("/usuarios", { consulta: { equipe_id: tiago.eu.equipe!.id, tamanho: 200 } });
  const equipe = equipeDaApr(usuarios, tiago.eu.usuario);
  assert.equal(equipe[0]!.id, meuId);
  assert.ok(equipe.some((c) => c.id === tais.eu.usuario.id));
  ok(`modelo ${codigo} v${modelo.versao} (${modelo.itens.length} itens, sem o tipo de cada um) e equipe de ${equipe.length} pessoas`);

  const comecar = (osId: string) =>
    novoRascunho({
      osId,
      usuarioId: meuId,
      modelo,
      participantes: [
        { usuarioId: meuId, funcao: "responsavel" },
        { usuarioId: tais.eu.usuario.id, funcao: "executor" },
      ],
      riscos: [],
    });

  /**
   * Acha as respostas que passam (o técnico não sabe quais itens são eliminatórios, mas este script pode tentar): começa com "Sim" em
   * tudo e inverte só os itens que a `api` reprovou, até aprovar. Cada tentativa que reprova já fica registrada como bloqueada (como no
   * app), então cada uma usa uma APR nova. Devolve o id da APR aprovada e registrada.
   */
  async function aprovarApr(osId: string): Promise<string> {
    const respostas = new Map<string, Resposta>(perguntasDe(modelo, []).map((i) => [i.id, "sim"]));
    for (let tentativa = 0; tentativa < 4; tentativa++) {
      let r = comecar(osId);
      for (const item of perguntasDe(r.modelo, r.riscos)) r = responder(r, item, respostas.get(item.id)!);
      r = await validar(tiago.conta, osId, r);
      if (r.avaliacao?.resultado === "aprovada") {
        const resposta = await tiago.conta.enviarEvento({ id: r.eventoId, tipo: "apr_concluida", os_id: osId, payload: montarPayload(r) });
        assert.equal(resposta.aprs.find((a) => a.id === r.aprId)?.resultado, "aprovada");
        return r.aprId;
      }
      for (const x of r.avaliacao!.reprovados) respostas.set(x.itemId, respostas.get(x.itemId) === "sim" ? "nao" : "sim");
    }
    assert.fail("o modelo escolhido não tem combinação de respostas que passe");
  }

  async function assinarComTodos(osId: string, aprId: string) {
    for (const quem of [tiago, tais]) {
      await quem.conta.enviarEvento({ tipo: "apr_assinada", os_id: osId, payload: { apr_id: aprId, assinada_em: new Date().toISOString() } });
    }
    return detalheDe(tiago.conta, osId);
  }

  const situacaoDe = async (conta: Conta, usuarioId: string, osId: string) => {
    const [detalhe, abertas] = await Promise.all([detalheDe(conta, osId), conta.cliente.chamar<{ execucoes: ExecucaoAberta[] }>("/me/execucoes-abertas")]);
    return { detalhe, situacao: definirSituacao({ osStatus: detalhe.os.status, usuarioId, execucoes: detalhe.execucoes, aprs: detalhe.aprs as never, abertas: abertas.execucoes, agora: new Date(), reservadaPara: detalhe.os.responsavel ?? null }) };
  };

  // =============================================== OS A: a APR aprovada, a execução e o encerramento em dois passos
  const aprA = await aprovarApr(osA!.id);
  ok("APR validada pela api (aprovada) e registrada com apr_concluida, sem assinaturas");

  let detalheA = await detalheDe(tiago.conta, osA!.id);
  const registrada = aprDeHoje(detalheA.aprs as never, detalheA.execucoes as never, meuId);
  assert.equal(registrada?.id, aprA);
  assert.deepEqual(situacaoDaApr(registrada!).faltam.map((p) => p.usuario_id).sort(), [meuId, tais.eu.usuario.id].sort());
  assert.equal((await situacaoDe(tiago.conta, meuId, osA!.id)).situacao.tipo, "aguardando_assinaturas");
  const paraAssinar = await tais.conta.cliente.chamar<{ aprs: { apr_id: string }[] }>("/me/aprs-para-assinar");
  assert.ok(paraAssinar.aprs.some((a) => a.apr_id === aprA), "a APR aparece na faixa da colega");
  await assert.rejects(tiago.conta.enviarEvento({ tipo: "execucao_iniciada", os_id: osA!.id, payload: { id: novoUuid(), apr_id: aprA, numero_pessoas: 2, inicio: new Date().toISOString() } }), (e: unknown) => e instanceof ErroDeEvento && /assin/i.test(e.message));
  ok("sem as duas assinaturas, iniciar a execução é recusado com a mensagem da api");

  detalheA = await assinarComTodos(osA!.id, aprA);
  const assinada = aprDeHoje(detalheA.aprs as never, detalheA.execucoes as never, meuId)!;
  assert.equal(situacaoDaApr(assinada).pronta, true);
  const pronta = await situacaoDe(tiago.conta, meuId, osA!.id);
  assert.equal(pronta.situacao.tipo, "iniciar");
  ok("as duas assinam, cada uma na própria conta: a execução é liberada (situação 'iniciar')");

  const execucaoId = novoUuid();
  const posicao = { latitude: -23.55052, longitude: -46.633309 };
  const inicio = await tiago.conta.enviarEvento({ tipo: "execucao_iniciada", os_id: osA!.id, payload: { id: execucaoId, apr_id: aprA, numero_pessoas: 2, inicio: new Date().toISOString(), ...comPosicao(posicao) } });
  assert.equal(inicio.os.find((o) => o.id === osA!.id)?.status, "em_execucao");
  let atual = await situacaoDe(tiago.conta, meuId, osA!.id);
  assert.equal(atual.situacao.tipo, "em_andamento");
  assert.equal(atual.detalhe.execucoes.find((e) => e.id === execucaoId)?.localizacao_inicio?.latitude, posicao.latitude);
  ok("execução iniciada com a localização: a OS passa a 'em_execucao' e a situação é 'em_andamento'");
  const acompanhando = await situacaoDe(tais.conta, tais.eu.usuario.id, osA!.id);
  assert.equal(acompanhando.situacao.tipo, "acompanhando");
  assert.equal(acompanhando.situacao.tipo === "acompanhando" && acompanhando.situacao.execucao.executor.id, meuId);
  ok("a colega, participante da APR, acompanha a execução de quem a iniciou (situação 'acompanhando')");

  const pausaId = novoUuid();
  await assert.rejects(tiago.conta.enviarEvento({ tipo: "pausa_iniciada", os_id: osA!.id, payload: { id: novoUuid(), execucao_id: execucaoId, inicio: new Date().toISOString(), motivo: "aguardando" } }), (e: unknown) => e instanceof ErroDeEvento);
  await tiago.conta.enviarEvento({ tipo: "pausa_iniciada", os_id: osA!.id, payload: { id: pausaId, execucao_id: execucaoId, inicio: new Date().toISOString(), motivo: "aguardando", complemento: "peça do almoxarifado", ...comPosicao(posicao) } });
  atual = await situacaoDe(tiago.conta, meuId, osA!.id);
  const emPausa = atual.situacao.tipo === "em_andamento" ? atual.situacao.execucao : null;
  assert.ok(emPausa?.pausas.some((p) => p.id === pausaId && !p.fim && p.motivo === "aguardando" && p.complemento === "peça do almoxarifado"));
  assert.equal(calcularTempo(emPausa!.inicio, emPausa!.pausas, Date.now() + 3600_000).emPausa, true);
  ok("pausa com motivo: 'aguardando' sem o complemento é recusado; com ele, a pausa fica aberta com motivo e complemento");
  const vistaPelaColega = await situacaoDe(tais.conta, tais.eu.usuario.id, osA!.id);
  assert.ok(vistaPelaColega.situacao.tipo === "acompanhando" && vistaPelaColega.situacao.execucao.pausas.some((p) => p.id === pausaId && !p.fim && p.motivo === "aguardando"));
  ok("a colega que acompanha vê a pausa aberta, com o motivo");

  await tiago.conta.enviarEvento({ tipo: "pausa_encerrada", os_id: osA!.id, payload: { pausa_id: pausaId, fim: new Date().toISOString() } });
  atual = await situacaoDe(tiago.conta, meuId, osA!.id);
  assert.ok(atual.situacao.tipo === "em_andamento" && atual.situacao.execucao.pausas.every((p) => p.fim));
  ok("continuar: a pausa se fecha");

  await tiago.conta.enviarEvento({ tipo: "execucao_encerrada", os_id: osA!.id, payload: { execucao_id: execucaoId, fim: new Date().toISOString(), ...comPosicao(posicao) } });
  atual = await situacaoDe(tiago.conta, meuId, osA!.id);
  assert.equal(atual.situacao.tipo, "encerrando");
  assert.equal(atual.detalhe.os.status, "encerrando");
  assert.equal((await situacaoDe(tais.conta, tais.eu.usuario.id, osA!.id)).situacao.tipo, "outra_pessoa");
  ok("encerrar, passo 1: o tempo para e a OS fica 'encerrando' (a colega espera pelo responsável)");

  const fotoId = await subir(tiago.conta.cliente, PNG, "foto", "foto.jpg", "image/jpeg");
  const pdfId = await subir(tiago.conta.cliente, PDF, "pdf", "laudo.pdf", "application/pdf");
  const checklist = atual.detalhe.checklist_inspecao ?? [];
  const encerramento = await tiago.conta.enviarEvento({
    tipo: "encerramento_assinado",
    os_id: osA!.id,
    payload: {
      execucao_id: execucaoId,
      descricao_atividade: "Trocada a bomba e testada a pressão.",
      evidencias: [comoEvidencia({ id: novoUuid(), arquivoId: fotoId, previa: "x", capturadaEm: new Date().toISOString(), ...posicao }), pdfComoEvidencia({ id: novoUuid(), arquivoId: pdfId, nome: "laudo.pdf", capturadaEm: new Date().toISOString() })],
      ...(checklist.length > 0 && { dados_inspecao: dadosDaInspecao(checklist, Object.fromEntries(checklist.map((p, i) => [p.id, { marcado: i % 2 === 0, observacao: i % 2 === 0 ? "" : "Encontrado com folga" }]))) }),
    },
  });
  assert.equal(encerramento.os.find((o) => o.id === osA!.id)?.status, "aguardando_supervisor");
  assert.equal((await situacaoDe(tiago.conta, meuId, osA!.id)).situacao.tipo, "terminada");
  ok(`encerrar, passo 2: foto e PDF subiram (PUT /arquivos) e o encerramento foi assinado${checklist.length ? ` com o checklist de inspeção (${checklist.length} perguntas)` : ""}: a OS aguarda o supervisor`);

  const url = await tiago.conta.cliente.chamar<{ url: string }>(`/arquivos/${fotoId}/url`).catch((e: unknown) => e);
  assert.ok(typeof (url as { url?: string }).url === "string", "a foto enviada tem endereço assinado");
  ok("GET /arquivos/{id}/url devolve o endereço da foto enviada");

  // =============================================== OS B: cancelar por engano e interromper por risco com foto
  const aprB = await aprovarApr(osB!.id);
  await assinarComTodos(osB!.id, aprB);
  const primeira = novoUuid();
  await tiago.conta.enviarEvento({ tipo: "execucao_iniciada", os_id: osB!.id, payload: { id: primeira, apr_id: aprB, numero_pessoas: 2, inicio: new Date().toISOString() } });
  await tiago.conta.enviarEvento({ tipo: "execucao_cancelada", os_id: osB!.id, payload: { execucao_id: primeira } });
  assert.equal((await situacaoDe(tiago.conta, meuId, osB!.id)).situacao.tipo, "iniciar", "cancelar devolve a APR para uso");
  ok("cancelar por engano: a execução some e a mesma APR volta a servir");

  const segunda = novoUuid();
  await tiago.conta.enviarEvento({ tipo: "execucao_iniciada", os_id: osB!.id, payload: { id: segunda, apr_id: aprB, numero_pessoas: 2, inicio: new Date().toISOString() } });
  await assert.rejects(tiago.conta.enviarEvento({ tipo: "execucao_interrompida", os_id: osB!.id, payload: { execucao_id: segunda, fim: new Date().toISOString(), motivo: "Vazamento de gás", evidencias: [] } }), (e: unknown) => e instanceof ErroDeEvento);
  const fotoRisco = await subir(tiago.conta.cliente, PNG, "foto", "risco.jpg", "image/jpeg");
  const interrompida = await tiago.conta.enviarEvento({
    tipo: "execucao_interrompida",
    os_id: osB!.id,
    payload: { execucao_id: segunda, fim: new Date().toISOString(), motivo: "Vazamento de gás", evidencias: [comoEvidencia({ id: novoUuid(), arquivoId: fotoRisco, previa: "x", capturadaEm: new Date().toISOString() })], ...comPosicao(posicao) },
  });
  assert.equal(interrompida.os.find((o) => o.id === osB!.id)?.status, "pendente");
  ok("interromper por risco: sem foto é recusado; com a foto, a OS fica pendente e o supervisor é avisado");

  // =============================================== OS B de novo: execução compartilhada (a colega age, o responsável responde). A interrupção a deixou pendente; uma APR nova a libera.
  const aprD = await aprovarApr(osB!.id);
  await assinarComTodos(osB!.id, aprD);
  const execD = novoUuid();
  const taisId = tais.eu.usuario.id;
  await tiago.conta.enviarEvento({ tipo: "execucao_iniciada", os_id: osB!.id, payload: { id: execD, apr_id: aprD, numero_pessoas: 2, inicio: new Date().toISOString() } });

  const pausaD = novoUuid();
  await tais.conta.enviarEvento({ tipo: "pausa_iniciada", os_id: osB!.id, payload: { id: pausaD, execucao_id: execD, inicio: new Date().toISOString(), motivo: "descanso" } });
  const pausadaPorTais = await situacaoDe(tiago.conta, meuId, osB!.id);
  assert.ok(pausadaPorTais.situacao.tipo === "em_andamento" && pausadaPorTais.situacao.execucao.pausas.some((p) => p.id === pausaD && !p.fim && p.iniciada_por?.id === taisId));
  await tais.conta.enviarEvento({ tipo: "pausa_encerrada", os_id: osB!.id, payload: { pausa_id: pausaD, fim: new Date().toISOString() } });
  ok("a colega pausa e retoma a execução do responsável na hora; a pausa guarda quem a fez");

  await assert.rejects(
    tais.conta.enviarEvento({ tipo: "execucao_encerrada", os_id: osB!.id, payload: { execucao_id: execD, fim: new Date().toISOString() } }),
    (e: unknown) => e instanceof ErroDeEvento && e.codigo === "pedido_necessario",
  );
  const pedirD = async (tipo: "encerrar" | "suspender" = "encerrar") => {
    const id = novoUuid();
    await tais.conta.enviarEvento({ tipo: "pedido_aberto", os_id: osB!.id, payload: { id, execucao_id: execD, tipo, instante: new Date().toISOString(), ...(tipo === "suspender" ? { motivo: "clima" } : {}) } });
    return id;
  };
  const primeiro = await pedirD();
  const faixa = await tiago.conta.cliente.chamar<{ pedidos: PedidoParaResponder[] }>("/me/pedidos-abertos");
  assert.deepEqual(faixa.pedidos.map((p) => [p.id, p.solicitante.nome, p.tipo]), [[primeiro, tais.eu.usuario.nome, "encerrar"]]);
  assert.ok(faixa.pedidos[0]!.restante_ms > 0 && faixa.pedidos[0]!.restante_ms <= PRAZO_DO_PEDIDO_MS);
  const vistaPelaColegaD = await situacaoDe(tais.conta, taisId, osB!.id);
  assert.ok(vistaPelaColegaD.situacao.tipo === "acompanhando" && pedidoAberto(vistaPelaColegaD.situacao.execucao)?.id === primeiro);
  assert.equal(intervaloDaLeitura(vistaPelaColegaD.detalhe.execucoes, taisId), 3_000, "com um pedido aberto, a tela relê mais depressa");
  ok("a colega pede para encerrar: o responsável a vê na faixa (com o tempo que falta) e a colega vê o pedido aberto na execução");

  await tiago.conta.enviarEvento({ tipo: "pedido_decidido", os_id: osB!.id, payload: { pedido_id: primeiro, decisao: "recusar", motivo: "Falta fechar a válvula" } });
  const depoisDaRecusa = await situacaoDe(tais.conta, taisId, osB!.id);
  assert.ok(depoisDaRecusa.situacao.tipo === "acompanhando" && pedidoAberto(depoisDaRecusa.situacao.execucao) === null);
  assert.equal(depoisDaRecusa.detalhe.execucoes.find((e) => e.id === execD)?.pedidos?.[0]?.estado, "recusado");
  ok("o responsável recusa com um motivo: a execução continua e o pedido fica registrado como recusado");

  const segundo = await pedirD();
  await tiago.conta.enviarEvento({ tipo: "pedido_decidido", os_id: osB!.id, payload: { pedido_id: segundo, decisao: "aprovar" } });
  const encerradaPelaColega = await situacaoDe(tais.conta, taisId, osB!.id);
  assert.equal(encerradaPelaColega.situacao.tipo, "encerrando", "quem encerrou preenche e assina o encerramento");
  assert.equal((await situacaoDe(tiago.conta, meuId, osB!.id)).situacao.tipo, "outra_pessoa", "o responsável, que não encerrou, só espera");
  await assert.rejects(
    tiago.conta.enviarEvento({ tipo: "encerramento_assinado", os_id: osB!.id, payload: { execucao_id: execD } }),
    (e: unknown) => e instanceof ErroDeEvento && e.codigo === "encerramento_de_outro",
  );
  const assinadoD = await tais.conta.enviarEvento({ tipo: "encerramento_assinado", os_id: osB!.id, payload: { execucao_id: execD, descricao_atividade: "Encerrada a pedido da equipe" } });
  assert.equal(assinadoD.os.find((o) => o.id === osB!.id)?.status, "aguardando_supervisor");
  ok("o responsável aprova: a colega encerra no instante do pedido, assina o encerramento e a OS segue para o supervisor");

  // =============================================== OS C: a APR bloqueada e a evidência dos reprovados
  let c = responderTudo(comecar(osC!.id), "nao");
  c = await validar(tiago.conta, osC!.id, c);
  if (c.avaliacao?.resultado === "bloqueada") {
    assert.ok(c.avaliacao.reprovados.length > 0);
    assert.ok(c.avaliacao.reprovados.every((x) => ["foto", "pdf", "texto"].includes(x.evidencia)));
    const registrada = await tiago.conta.cliente.chamar<{ aprs: { id: string; resultado: string }[] }>(`/os/${osC!.id}`);
    assert.ok(registrada.aprs.some((a) => a.id === c.aprId && a.resultado === "bloqueada"), "a APR bloqueada já ficou registrada ao validar");
    ok(`APR bloqueada ao validar: ${c.avaliacao.reprovados.length} itens reprovados, com a evidência de cada um (${[...new Set(c.avaliacao.reprovados.map((x) => x.evidencia))].join(", ")}), e a APR já registrada`);

    // O evento sem a evidência é recusado; com observação, foto e PDF, completa o registro.
    for (const item of c.avaliacao.reprovados) {
      c = observar(c, item.itemId, "Item fora de conformidade no local");
      const foto = await subir(tiago.conta.cliente, PNG, "foto", "evidencia.jpg", "image/jpeg");
      c = adicionarFoto(c, item.itemId, { id: novoUuid(), arquivoId: foto, capturadaEm: new Date().toISOString(), miniatura: "file:///x.jpg", ...posicao });
      if (item.evidencia === "pdf") {
        const pdf = await subir(tiago.conta.cliente, PDF, "pdf", "laudo.pdf", "application/pdf");
        c = adicionarDocumento(c, item.itemId, { id: novoUuid(), arquivoId: pdf, nome: "laudo.pdf", capturadaEm: new Date().toISOString() });
      }
    }
    const resposta = await tiago.conta.enviarEvento({ id: c.eventoId, tipo: "apr_concluida", os_id: osC!.id, payload: montarPayload(c) });
    assert.equal(resposta.aprs.find((a) => a.id === c.aprId)?.resultado, "bloqueada");
    const depois = await tiago.conta.cliente.chamar<DetalheDaOs>(`/os/${osC!.id}`);
    assert.ok(depois.os);
    const aprC = depois.aprs.find((a) => a.id === c.aprId)!;
    assert.ok(aprC.itens_reprovados.length > 0 && aprC.itens_reprovados.every((i) => i.fotos.length > 0 && i.observacao));
    assert.equal(depois.os.status, "pendente");
    ok("a evidência (observação, fotos e PDFs) completa a APR bloqueada, e a OS fica pendente");
  } else {
    console.log("--  nenhum item reprovou com 'Não' em tudo neste modelo; o caminho da APR bloqueada não foi exercitado");
  }

  console.log("\nfluxo de campo ok contra a api");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
