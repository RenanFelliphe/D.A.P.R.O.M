/* eslint-disable @typescript-eslint/no-explicit-any -- script de teste: as respostas da API fictícia são lidas como vêm */
// Percorre o Campo de treino (a API fictícia, sem servidor e sem navegador) do mesmo modo que as telas de campo:
// lista as OS, abre a OS guiada, faz a APR aprovada, inicia e encerra a execução (com foto e PDF); depois abre a OS do
// bloqueio, responde uma pergunta do jeito que reprova e confere o impedimento. Por fim, o catálogo de serviço. O modelo que o técnico recebe não diz o que é eliminatório:
// só `POST /aprs/avaliar` revela os itens reprovados. Usa as funções puras da tela (`shared/api/apr.ts`) para montar o evento.
//
//   cd api && node --import tsx ../web/scripts/verificar-treino.mts
import assert from "node:assert/strict";
import { adicionarFoto, doModeloCompleto, montarAvaliacao, montarPayload, novoRascunho, observar, perguntasDe, responder, type ModeloCompleto, type RascunhoApr } from "../../shared/api/apr";
import { arquivoDoTreino, responderTreino } from "../src/treino/api-ficticia";
import { reiniciarTreino } from "../src/treino/armazem";
import { COLEGAS_TREINO, COLEGA_SEM_ASSINATURA, MODELO_BLOQUEIO, MODELO_GUIADO, OS_BLOQUEIO, OS_GUIADA, idTreino } from "../src/treino/ids";
import type { Usuario } from "../../shared/api/tipos";

const eu: Usuario = {
  id: "11111111-2222-4333-8444-555555555555",
  nome: "Renan Técnico",
  matricula: "T9999",
  email: "renan.tecnico@empresa.com.br",
  cargo: "Técnico de Manutenção",
  registro_profissional: null,
  perfil: "tecnico",
  equipe_id: "00000000-0000-4000-8000-00000000aaaa",
  ativo: true,
  senha_provisoria: false,
  assinatura_path: null,
  assinatura_em: null,
};

async function chamar(metodo: string, caminho: string, corpo?: unknown, consulta?: Record<string, string>) {
  const r = await responderTreino(eu, metodo, caminho, consulta, corpo);
  return r;
}
async function ler<T = any>(metodo: string, caminho: string, corpo?: unknown, consulta?: Record<string, string>): Promise<T> {
  const r = await chamar(metodo, caminho, corpo, consulta);
  assert.ok(r.status >= 200 && r.status < 300, `${metodo} ${caminho} -> ${r.status} ${JSON.stringify(r.corpo)}`);
  return r.corpo as T;
}
const evento = (tipo: string, osId: string | null, payload: Record<string, unknown>, id: string = crypto.randomUUID()) => ({ id, tipo, os_id: osId, payload, ocorrido_em: new Date().toISOString() });
async function enviar(...eventos: ReturnType<typeof evento>[]) {
  return ler<any>("POST", "/eventos", { eventos });
}
async function subirFoto(id: string = crypto.randomUUID()) {
  const arquivo = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])], "foto.jpg", { type: "image/png" });
  await ler("PUT", `/arquivos/${id}`, { arquivo, tipo: "foto" });
  return id;
}
async function subirPdf(id: string = crypto.randomUUID()) {
  const arquivo = new File([new TextEncoder().encode("%PDF-1.4\n% laudo de treino\n%%EOF\n")], "laudo.pdf", { type: "application/pdf" });
  await ler("PUT", `/arquivos/${id}`, { arquivo, tipo: "pdf" });
  return id;
}
async function subirAssinatura() {
  const id = crypto.randomUUID();
  await ler("PUT", `/arquivos/${id}`, { arquivo: new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" }), tipo: "assinatura" });
  return id;
}

/** Responde tudo "sim", salvo o que `diferente` pedir; devolve o rascunho pronto para `montarPayload`. */
function preencher(osId: string, modelo: ModeloCompleto, riscos: string[], participantes: RascunhoApr["participantes"], diferente: Record<string, "nao" | "na"> = {}) {
  let r = novoRascunho({ osId, usuarioId: eu.id, modelo: doModeloCompleto(modelo), participantes, riscos });
  for (const item of perguntasDe(r.modelo, r.riscos)) r = responder(r, item, diferente[item.id] ?? "sim");
  return r;
}

/**
 * `POST /aprs/avaliar` com a APR do rascunho, como a tela faz: devolve o rascunho concluído, com o que a `api` disse
 * (aprovada ou bloqueada). A bloqueada já fica registrada.
 */
async function avaliar(r: RascunhoApr): Promise<RascunhoApr> {
  const concluidaEm = new Date().toISOString();
  const res = await ler<any>("POST", "/aprs/avaliar", montarAvaliacao({ ...r, concluidaEm }));
  return {
    ...r,
    concluidaEm,
    avaliacao: {
      resultado: res.resultado,
      reprovados: res.reprovados.map((x: any) => ({ itemId: x.item_id, texto: x.texto, evidencia: x.evidencia })),
    },
  };
}

let passos = 0;
const ok = (texto: string) => console.log(`ok ${++passos} - ${texto}`);

reiniciarTreino(eu.id);

// ---- Materiais recomendados: só consulta, não há conferência nem bloqueio (depois a OS guiada volta ao começo) -----------
{
  const det = await ler<any>("GET", `/os/${OS_GUIADA}`);
  const lista: any[] = det.servico.materiais;
  assert.ok(lista.some((m) => m.descricao === "Vestimenta antichama"), "a vestimenta antichama continua na lista da OS guiada, como recomendação");
  assert.ok(lista.every((m) => !("obrigatorio" in m)), "nenhum item da lista é obrigatório");
  const modelo = await ler<ModeloCompleto>("GET", `/modelos-apr/${MODELO_GUIADO.codigo}/versoes/publicada`);
  const dupla = [{ usuarioId: eu.id, funcao: "responsavel" as const }, { usuarioId: COLEGAS_TREINO.carlos.id, funcao: "executor" as const }];

  // Sem conferência nenhuma a APR passa; quem ainda manda `materiais` (aparelho antigo) não é recusado nem bloqueado.
  const boa = await avaliar(preencher(OS_GUIADA, modelo, [], dupla));
  assert.equal(boa.avaliacao?.resultado, "aprovada");
  assert.deepEqual(boa.avaliacao?.reprovados, []);
  const antigo = { ...(montarAvaliacao({ ...preencher(OS_GUIADA, modelo, [], dupla), concluidaEm: new Date().toISOString() }) as any), materiais: [{ material_id: crypto.randomUUID(), levou: false }] };
  const r = await chamar("POST", "/aprs/avaliar", antigo);
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  assert.equal((r.corpo as any).resultado, "aprovada");
  assert.equal((await ler<any>("GET", `/os/${OS_GUIADA}`)).aprs.length, 0, "a aprovada só é registrada pelo apr_concluida");
  ok("materiais recomendados: sem conferência e sem bloqueio por material");

  reiniciarTreino(eu.id);
}

// ---- /me e a lista de OS -----------------------------------------------------------------------------------------
const me = await ler<any>("GET", "/me");
assert.equal(me.usuario.id, eu.id);
assert.equal(me.equipe.nome, "Equipe Treino");
assert.deepEqual(me.equipes_supervisionadas, []);
assert.ok(me.usuario.assinatura_path, "o técnico em treino já tem assinatura");
ok("GET /me: usuário real na Equipe Treino, sem supervisão");

const lista = await ler<any>("GET", "/os", undefined, { tamanho: "200" });
assert.ok(lista.os.length >= 7 && lista.os.length <= 9, `7 a 9 OS (veio ${lista.os.length})`);
for (const s of ["liberada", "pendente", "em_execucao", "encerrada", "cancelada"]) assert.ok(lista.contagem_por_status[s] > 0, `há OS ${s}`);
assert.ok(lista.os.some((o: any) => o.local_instalacao.critico), "há OS crítica");
assert.ok(lista.os.some((o: any) => o.tipo === "corretiva") && lista.os.some((o: any) => o.tipo === "preventiva"));
assert.equal(lista.os.find((o: any) => o.id === OS_GUIADA).status, "liberada");
assert.equal(lista.os.find((o: any) => o.id === OS_BLOQUEIO).status, "liberada");
assert.equal((await ler<any>("GET", "/os", undefined, { status: "liberada" })).os.every((o: any) => o.status === "liberada"), true);
assert.equal((await ler<any>("GET", "/os", undefined, { critica: "true" })).os.every((o: any) => o.local_instalacao.critico), true);
assert.ok((await ler<any>("GET", "/os", undefined, { busca: "termografica" })).os.some((o: any) => o.id === OS_GUIADA), "busca sem acento");
ok(`GET /os: ${lista.os.length} OS, ${JSON.stringify(lista.contagem_por_status)}`);

// ---- OS guiada: detalhe, modelo, colegas, APR aprovada ------------------------------------------------------------
const detalhe = await ler<any>("GET", `/os/${OS_GUIADA}`);
assert.equal("modelo_apr_codigo" in detalhe.os, false, "a OS não traz modelo: o técnico escolhe");
assert.equal(detalhe.os.status, "liberada");
const escolha = await ler<any>("GET", `/os/${OS_GUIADA}/modelos-apr`);
assert.equal(escolha.recomendado, MODELO_GUIADO.codigo, "a leitura da OS guiada recomenda o modelo do tutorial");
assert.ok(escolha.modelos.every((m: any) => m.descricao && m.exemplos.length > 0));
assert.ok(escolha.modelos.find((m: any) => m.codigo === MODELO_GUIADO.codigo).encontradas.length > 0);
assert.equal((await ler<any>("GET", `/os/${OS_BLOQUEIO}/modelos-apr`)).recomendado, MODELO_BLOQUEIO.codigo);
const resumos = await ler<any>("GET", "/modelos-apr", undefined, { codigo: MODELO_GUIADO.codigo, publicados: "true" });
assert.equal(resumos.modelos[0].codigo, MODELO_GUIADO.codigo);
const modeloA = await ler<ModeloCompleto>("GET", `/modelos-apr/${MODELO_GUIADO.codigo}/versoes/publicada`);
const colegas = (await ler<any>("GET", "/usuarios", undefined, { equipe_id: detalhe.os.equipe_id, tamanho: "200" })).usuarios;
assert.ok(colegas.some((u: any) => u.id === eu.id) && colegas.some((u: any) => u.id === COLEGAS_TREINO.carlos.id));
ok("GET /os/{id}, /modelos-apr e /usuarios da OS guiada");

// Colega sem assinatura: a validação recusa antes de dizer o resultado.
{
  const r = preencher(OS_GUIADA, modeloA, [], [{ usuarioId: eu.id, funcao: "responsavel" }, { usuarioId: COLEGA_SEM_ASSINATURA.id, funcao: "executor" }]);
  const res = await chamar("POST", "/aprs/avaliar", montarAvaliacao({ ...r, concluidaEm: new Date().toISOString() }));
  assert.equal(res.status, 422);
  assert.equal((res.corpo as any).erro.codigo, "assinatura_ausente");
  ok("participante sem assinatura: a validação recusa (assinatura_ausente)");
}

const rascunho = {
  ...(await avaliar(preencher(OS_GUIADA, modeloA, [modeloA.riscos[0]!.id], [{ usuarioId: eu.id, funcao: "responsavel" }, { usuarioId: COLEGAS_TREINO.carlos.id, funcao: "executor" }]))),
  concluidaEm: new Date().toISOString(),
};
assert.equal(rascunho.avaliacao?.resultado, "aprovada");
const aprovada = await enviar(evento("apr_concluida", OS_GUIADA, montarPayload(rascunho) as any, rascunho.eventoId));
assert.equal(aprovada.rejeitados.length, 0, JSON.stringify(aprovada));
assert.equal(aprovada.aprs[0].resultado, "aprovada");
assert.equal(aprovada.os[0].status, "liberada");
ok("apr_concluida aprovada na OS guiada");

// Reenviar o mesmo evento só confirma.
const repetida = await enviar(evento("apr_concluida", OS_GUIADA, montarPayload(rascunho) as any, rascunho.eventoId));
assert.equal(repetida.confirmados.length, 1);
const aprGuiada = (await ler<any>("GET", `/os/${OS_GUIADA}`)).aprs;
assert.equal(aprGuiada.length, 1);
assert.equal("materiais" in aprGuiada[0], false, "a APR não guarda mais conferência de materiais");
ok("reenvio do mesmo evento é idempotente");

// ---- Execução: iniciar, pausar, encerrar -------------------------------------------------------------------------
const execId = crypto.randomUUID();
const iniciar = await enviar(evento("execucao_iniciada", OS_GUIADA, { id: execId, apr_id: rascunho.aprId, inicio: new Date().toISOString() }));
assert.equal(iniciar.rejeitados.length, 0, JSON.stringify(iniciar));
assert.equal(iniciar.os[0].status, "em_execucao");
assert.equal((await ler<any>("GET", "/me/execucoes-abertas")).execucoes.length, 1);
const outra = await enviar(evento("execucao_iniciada", OS_GUIADA, { id: crypto.randomUUID(), apr_id: rascunho.aprId, inicio: new Date().toISOString() }));
assert.equal(outra.rejeitados[0].codigo, "apr_ja_usada");
ok("execucao_iniciada: OS em execução; segunda tentativa recusada");

const pausaId = crypto.randomUUID();
assert.equal((await enviar(evento("pausa_iniciada", null, { id: pausaId, execucao_id: execId, inicio: new Date().toISOString(), motivo: "almoco" }))).rejeitados.length, 0);
assert.equal((await enviar(evento("pausa_iniciada", null, { id: crypto.randomUUID(), execucao_id: execId, inicio: new Date().toISOString() }))).rejeitados[0].codigo, "pausa_aberta");
assert.equal((await enviar(evento("pausa_encerrada", null, { pausa_id: pausaId, fim: new Date().toISOString() }))).rejeitados.length, 0);
ok("pausa iniciada, recusada em duplicidade e encerrada");

const fotoId = await subirFoto();
const assinatura = await subirAssinatura();
await ler("PUT", "/me/assinatura", { arquivo_id: assinatura });
assert.equal((await ler<any>("GET", "/me")).usuario.assinatura_path, assinatura);
const url = (await ler<any>("GET", `/arquivos/${fotoId}/url`)).url;
assert.equal(url, `/api/treino/arquivos/${fotoId}`);
assert.ok(arquivoDoTreino(eu, fotoId)!.bytes.length > 0);
assert.ok(arquivoDoTreino(eu, me.usuario.assinatura_path)!.bytes.length > 0, "assinatura da massa inicial vira SVG");
ok("fotos e assinatura: envio, URL e leitura");

const pdfId = await subirPdf();
assert.equal((await ler<any>("GET", `/arquivos/${pdfId}/url`)).url, `/api/treino/arquivos/${pdfId}`);
assert.equal(arquivoDoTreino(eu, pdfId)!.tipo, "application/pdf");
const falso = await chamar("PUT", `/arquivos/${crypto.randomUUID()}`, { arquivo: new File([new Uint8Array([137, 80, 78, 71])], "x.pdf", { type: "application/pdf" }), tipo: "pdf" });
assert.equal((falso.corpo as any).erro.codigo, "tipo_de_arquivo");
ok("PDF de evidência: envio, recusa do que não é PDF, URL e leitura");

const encerrar = (extra: Record<string, unknown>) =>
  evento("execucao_encerrada", OS_GUIADA, {
    execucao_id: execId,
    fim: new Date().toISOString(),
    descricao_atividade: "Termografia concluída sem pontos quentes.",
    evidencias: [{ id: crypto.randomUUID(), arquivo_id: fotoId, capturada_em: new Date().toISOString() }],
    assinaturas: [{ usuario_id: eu.id }, { usuario_id: COLEGAS_TREINO.carlos.id }],
    ...extra,
  });
assert.equal((await enviar(encerrar({ evidencias: [] }))).rejeitados[0].codigo, "encerramento_incompleto");
// O PDF acompanha a foto, mas não a substitui.
const soPdf = [{ id: crypto.randomUUID(), arquivo_id: pdfId, tipo: "pdf", nome: "laudo.pdf", capturada_em: new Date().toISOString() }];
assert.equal((await enviar(encerrar({ evidencias: soPdf }))).rejeitados[0].codigo, "encerramento_incompleto");
assert.equal((await enviar(encerrar({ assinaturas: [{ usuario_id: eu.id }] }))).rejeitados[0].codigo, "encerramento_incompleto");
assert.equal((await enviar(encerrar({ evidencias: [{ id: crypto.randomUUID(), arquivo_id: crypto.randomUUID(), capturada_em: new Date().toISOString() }] }))).pendentes[0].codigo, "arquivo_ausente");
const encerrada = await enviar(encerrar({ evidencias: [{ id: crypto.randomUUID(), arquivo_id: fotoId, capturada_em: new Date().toISOString() }, ...soPdf] }));
assert.equal(encerrada.rejeitados.length + encerrada.pendentes.length, 0, JSON.stringify(encerrada));
assert.equal(encerrada.os[0].status, "encerrada");
ok("execucao_encerrada: exige descrição, foto e assinaturas (o PDF é opcional); OS encerrada");

const depois = await ler<any>("GET", `/os/${OS_GUIADA}`);
assert.equal(depois.execucoes[0].resultado, "encerrada");
assert.equal(depois.execucoes[0].pausas.length, 1);
assert.equal(depois.execucoes[0].assinaturas.length, 2);
assert.equal(depois.execucoes[0].fotos.length, 1);
assert.deepEqual(depois.execucoes[0].documentos.map((d: any) => [d.arquivo_path, d.nome]), [[pdfId, "laudo.pdf"]]);
const historico = await ler<any>("GET", "/me/historico");
assert.ok(historico.execucoes.some((x: any) => x.os_id === OS_GUIADA), "histórico do técnico");
const pdf = await chamar("GET", `/os/${OS_GUIADA}/pdf`);
assert.equal(pdf.binario?.tipo, "application/pdf");
assert.equal(new TextDecoder().decode(pdf.binario!.bytes.slice(0, 5)), "%PDF-");
ok("detalhe pós-execução, histórico e PDF");

// ---- OS do bloqueio: pergunta respondida do jeito que reprova -------------------------------------------------------
const modeloB = await ler<ModeloCompleto>("GET", `/modelos-apr/${MODELO_BLOQUEIO.codigo}/versoes/publicada`);
const eliminatorio = modeloB.itens.find((i) => i.id === MODELO_BLOQUEIO.itemEliminatorioId)!;
// O técnico não recebe o que é eliminatório: nem o tipo, nem a resposta que bloqueia, nem a evidência do item.
for (const modelo of [modeloA, modeloB]) {
  for (const item of modelo.itens) {
    assert.deepEqual(Object.keys(item).filter((k) => ["tipo", "resposta_bloqueante", "evidencia"].includes(k)), [], "o modelo do técnico não traz a classificação");
  }
}
ok("o modelo que o técnico recebe não diz quais itens são eliminatórios");

const participantes: RascunhoApr["participantes"] = [{ usuarioId: eu.id, funcao: "responsavel" }, { usuarioId: COLEGAS_TREINO.paulo.id, funcao: "executor" }];
const riscosB = [modeloB.riscos[0]!.id];
// Respostas incompletas não são avaliadas.
const vazia = novoRascunho({ osId: OS_BLOQUEIO, usuarioId: eu.id, modelo: doModeloCompleto(modeloB), participantes, riscos: riscosB });
const semRespostas = { ...montarAvaliacao({ ...preencher(OS_BLOQUEIO, modeloB, riscosB, participantes), concluidaEm: new Date().toISOString() }), respostas: [] };
assert.equal((await chamar("POST", "/aprs/avaliar", semRespostas)).status, 422);
assert.equal(vazia.avaliacao, null);
// A aprovada não é gravada na validação: só com as assinaturas confirmadas.
const aprsAntes = (await ler<any>("GET", `/os/${OS_BLOQUEIO}`)).aprs.length;
assert.equal((await avaliar(preencher(OS_BLOQUEIO, modeloB, riscosB, participantes))).avaliacao?.resultado, "aprovada");
assert.equal((await ler<any>("GET", `/os/${OS_BLOQUEIO}`)).aprs.length, aprsAntes, "a aprovada não é registrada na validação");
// A bloqueada vale na hora: registrada já na validação, com a OS pendente e o alerta ao supervisor.
let bloqueada = await avaliar(preencher(OS_BLOQUEIO, modeloB, riscosB, participantes, { [eliminatorio.id]: "nao" }));
assert.equal(bloqueada.avaliacao?.resultado, "bloqueada");
assert.deepEqual(bloqueada.avaliacao?.reprovados.map((x) => x.itemId), [eliminatorio.id]);
assert.equal(bloqueada.avaliacao?.reprovados[0]!.evidencia, "foto");
const naValidacao = await ler<any>("GET", `/os/${OS_BLOQUEIO}`);
assert.equal(naValidacao.aprs.length, aprsAntes + 1, "a bloqueada fica registrada na validação");
assert.equal(naValidacao.aprs[naValidacao.aprs.length - 1].id, bloqueada.aprId);
assert.equal(naValidacao.os.status, "pendente");
assert.equal(naValidacao.alertas.filter((a: any) => a.tipo === "bloqueio").length, 1);
// Validar de novo a mesma APR devolve o que ficou gravado, sem duplicar.
assert.equal((await ler<any>("POST", "/aprs/avaliar", montarAvaliacao(bloqueada))).resultado, "bloqueada");
assert.equal((await ler<any>("GET", `/os/${OS_BLOQUEIO}`)).aprs.length, aprsAntes + 1);
ok("POST /aprs/avaliar: só depois de responder tudo a `api` diz o que reprovou; a bloqueada já fica registrada");

// A evidência chega depois, no evento da mesma APR. Sem observação e sem foto: recusada.
assert.equal((await enviar(evento("apr_concluida", OS_BLOQUEIO, montarPayload(bloqueada) as any))).rejeitados[0].codigo, "evidencia_faltando");
// Com observação e sem foto: ainda recusada (o item pede foto).
bloqueada = observar(bloqueada, eliminatorio.id, "Talabarte com costura rompida.");
assert.equal((await enviar(evento("apr_concluida", OS_BLOQUEIO, montarPayload(bloqueada) as any))).rejeitados[0].codigo, "evidencia_faltando");
// Com foto ainda não enviada: pendente (o evento espera o arquivo).
bloqueada = adicionarFoto(bloqueada, eliminatorio.id, { id: crypto.randomUUID(), arquivoId: crypto.randomUUID(), capturadaEm: new Date().toISOString() });
assert.equal((await enviar(evento("apr_concluida", OS_BLOQUEIO, montarPayload(bloqueada) as any))).pendentes[0].codigo, "arquivo_ausente");
// Com a foto enviada: a evidência completa a APR bloqueada; a OS segue pendente e o alerta não se repete.
const arquivoDaFoto = await subirFoto();
bloqueada = { ...bloqueada, fotos: { [eliminatorio.id]: [{ ...bloqueada.fotos[eliminatorio.id]![0]!, arquivoId: arquivoDaFoto }] } };
const resBloqueio = await enviar(evento("apr_concluida", OS_BLOQUEIO, montarPayload(bloqueada) as any, bloqueada.eventoId));
assert.equal(resBloqueio.rejeitados.length + resBloqueio.pendentes.length, 0, JSON.stringify(resBloqueio));
assert.equal(resBloqueio.aprs[0].resultado, "bloqueada");
assert.equal(resBloqueio.os[0].status, "pendente");
assert.equal(resBloqueio.alertas.length, 0, "o alerta saiu na validação");
const detalheB = await ler<any>("GET", `/os/${OS_BLOQUEIO}`);
assert.equal(detalheB.os.status, "pendente");
// A APR da massa inicial vem primeiro (mais antiga); a que acabou de ser registrada é a última.
const aprNova = detalheB.aprs[detalheB.aprs.length - 1];
assert.equal(aprNova.itens_reprovados[0].item_id, eliminatorio.id);
assert.equal(aprNova.itens_reprovados[0].fotos.length, 1);
assert.equal(aprNova.itens_reprovados[0].observacao, "Talabarte com costura rompida.", "a observação chegou com a evidência");
for (const apr of detalheB.aprs) {
  for (const r of apr.respostas) assert.equal(["tipo", "evidencia", "resposta_bloqueante", "alerta_marcado"].some((k) => k in r), false, "o detalhe da OS não traz a classificação ao técnico");
  for (const i of apr.itens_reprovados) assert.equal(["tipo", "evidencia"].some((k) => k in i), false);
}
assert.equal(detalheB.alertas[0].tipo, "bloqueio");
ok("pergunta respondida do jeito que reprova: APR bloqueada, OS pendente, alerta ao supervisor");

const semApr = await enviar(evento("execucao_iniciada", OS_BLOQUEIO, { id: crypto.randomUUID(), apr_id: bloqueada.aprId, inicio: new Date().toISOString() }));
assert.equal(semApr.rejeitados[0].codigo, "apr_invalida");
assert.equal(semApr.rejeitados[0].mensagem, "Preencha a APR antes de iniciar");
ok("com APR bloqueada não se inicia a execução");

// ---- Perfil, equipe, busca e erros ---------------------------------------------------------------------------------
const equipe = await ler<any>("GET", `/equipes/${me.equipe.id}`);
assert.ok(equipe.membros.length >= 5 && equipe.total_os >= 7 && equipe.supervisor.nome === COLEGAS_TREINO.marcos.nome);
const perfil = await ler<any>("GET", `/usuarios/${COLEGAS_TREINO.carlos.id}`);
assert.equal(perfil.usuario.nome, COLEGAS_TREINO.carlos.nome);
assert.equal(perfil.usuario.email, undefined);
assert.deepEqual((await ler<any>("GET", "/busca/exata", undefined, { q: "4900101" })).achado, { tipo: "os", id: OS_GUIADA });
assert.equal((await ler<any>("GET", "/busca/exata", undefined, { q: "inexistente" })).achado, null);
assert.equal((await ler<any>("GET", "/equipes", undefined, { global: "true", busca: "treino" })).equipes[0].total_membros, 6);
const inexistente = await chamar("GET", `/os/${idTreino("", 999)}`);
assert.equal(inexistente.status, 404);
assert.deepEqual(inexistente.corpo, { erro: { codigo: "nao_encontrado", mensagem: "OS não encontrada" } });
assert.equal((await chamar("POST", `/os/${OS_GUIADA}/ciencia`)).status, 403);
assert.equal((await chamar("GET", "/nada-disso")).status, 404);
ok("equipe, perfil, busca exata e erros no formato padrão");

// ---- Catálogo de serviço ---------------------------------------------------------------------------------------------
const guiada = await ler<any>("GET", `/os/${OS_GUIADA}`);
assert.ok(guiada.servico && guiada.servico.materiais.length > 0, "a OS guiada traz o serviço do catálogo com a lista");
assert.ok(guiada.servico.materiais.some((m: any) => m.categoria === "epi"));
const semLista = await ler<any>("GET", "/catalogo/servicos", undefined, { sem_materiais: "true" });
assert.deepEqual(semLista.servicos.map((s: any) => s.codigo), ["COR-PODA"]);
const epis = await ler<any>("GET", "/catalogo/materiais", undefined, { categoria: "epi" });
assert.ok(epis.total > 0 && epis.materiais.every((m: any) => m.categoria === "epi" && m.servicos_total > 0));
const usaLuva = await ler<any>("GET", "/catalogo/servicos", undefined, { material_id: epis.materiais.find((m: any) => m.descricao.startsWith("Luva")).id });
assert.ok(usaLuva.total >= 3);
assert.equal((await chamar("POST", "/catalogo/materiais", { descricao: "Novo", unidade: "un" })).status, 403);
assert.equal((await chamar("PUT", `/catalogo/servicos/${guiada.servico.codigo}`, { materiais: [] })).status, 403);
ok("catálogo de serviço: o serviço da OS com a lista, filtros e só leitura no treino");

// ---- Reinício ------------------------------------------------------------------------------------------------------
reiniciarTreino(eu.id);
const nova = await ler<any>("GET", "/os", undefined, { tamanho: "200" });
assert.equal(nova.os.find((o: any) => o.id === OS_GUIADA).status, "liberada");
assert.equal(nova.os.find((o: any) => o.id === OS_BLOQUEIO).status, "liberada");
assert.equal((await ler<any>("GET", `/os/${OS_GUIADA}`)).aprs.length, 0);
ok("reiniciarTreino volta ao estado inicial");

// ---- Dashboards (sobre a massa inicial) -----------------------------------------------------------------------------
// O que a `api` devolve ao técnico que não supervisiona: só a equipe, nada por pessoa e sem a classificação dos itens da APR.
{
  const geral = await ler<any>("GET", "/indicadores/geral");
  assert.equal(geral.periodo, "30d", "sem `periodo`, 30 dias");
  assert.equal(geral.encerradas.total, 2);
  assert.deepEqual(geral.aprs, { total: 4, bloqueadas: 1, anterior: 0, bloqueadas_anterior: 0 });
  assert.equal(geral.carteira.em_execucao, 1);
  assert.equal(geral.carteira.pendentes, 1);
  assert.equal(geral.tempo.execucoes, 2);
  assert.deepEqual(geral.pendencias, { a_exportar: null, sem_ciencia: null, execucoes_esquecidas: 0 });

  const os = await ler<any>("GET", "/indicadores/os", undefined, { periodo: "7d" });
  assert.equal(os.serie.length, 7);
  assert.equal(os.tempo.os_com_mais_pausa.length, 1);
  assert.equal(os.tempo.os_com_mais_pausa[0].executor, null, "o técnico não vê quem executou");
  assert.equal(os.reprogramacoes, 0);
  assert.ok(os.locais.length >= 1);

  const equipes = await ler<any>("GET", "/indicadores/equipes", undefined, { periodo: "90d" });
  assert.equal(equipes.agrupamento, "semana");
  assert.equal(equipes.equipes.length, 1);
  assert.equal(equipes.equipes[0].supervisor_nome, COLEGAS_TREINO.marcos.nome);
  assert.equal(equipes.equipes[0].aprs, 4);
  assert.deepEqual([equipes.tecnicos, equipes.totais.tecnicos_com_execucao, equipes.cadastro], [[], null, null]);

  const meus = await ler<any>("GET", "/indicadores/meus", undefined, { periodo: "12m" });
  assert.equal(meus.serie.length, 12);
  assert.equal(meus.encerradas.total, 1);
  assert.equal(meus.aprs.total, 1);
  assert.deepEqual(meus.tempo.por_motivo, [{ motivo: "almoco", pausas: 1, minutos: 60 }]);

  const mes = new Date().toISOString().slice(0, 7);
  const aprs = await ler<any>("GET", "/aprs/resumo", undefined, { periodo: mes });
  assert.equal(aprs.de, `${mes}-01`);
  assert.deepEqual([aprs.itens_que_bloqueiam, aprs.alertas_registrados, aprs.totais.alertas], [null, null, null]);
  assert.equal(aprs.por_modelo.reduce((n: number, m: any) => n + m.aprs, 0), aprs.totais.aprs);

  assert.equal((await chamar("GET", "/indicadores/geral", undefined, { periodo: "ontem" })).status, 422);
  assert.equal((await chamar("GET", "/indicadores/os", undefined, { equipe_id: idTreino("e", 99) })).status, 403);
}
ok("dashboards geral, OS, equipe, APR e Meus resultados respondem sobre a massa do treino");

console.log(`\n${passos} verificações passaram.`);
