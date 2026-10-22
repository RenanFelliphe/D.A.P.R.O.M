import { exigenciaDoClima, registrarClima, type ClimaRegistrado, type ExigenciaDoClima, type PrevisaoDoTempo } from "@shared/api/clima";
import { adicionarFoto, montarAvaliacao, montarPayload, perguntasDe, removerFoto, responder, type FotoDoRascunho, type ItemDoModelo, type RascunhoApr, type Resposta } from "@shared/api/apr";

/**
 * A pergunta de clima da APR no aparelho (`funcionalidades/previsao-do-tempo.md`). A pergunta que o modelo marca com `mostrar_clima` mostra
 * a previsão; se o técnico responde "Sim" e a previsão aponta risco, a tela pede a confirmação (e, no risco extremo, a foto do local). Esta
 * parte é pura: guarda no rascunho a previsão que a pessoa viu e, na hora de enviar, acrescenta ao evento o `clima` e a foto do local. O
 * texto da tela nunca diz o que bloqueia a APR: o técnico não sabe o que é eliminatório.
 */

/** O rascunho da APR com a previsão que o técnico viu na pergunta de clima (a cópia que vai para o relatório do supervisor). */
export type RascunhoComClima = RascunhoApr & { clima?: ClimaRegistrado | null };

/** A pergunta de clima do checklist (a primeira marcada com `mostrar_clima` entre as que a APR faz), se o modelo tem. */
export const perguntaDeClima = (r: RascunhoApr): ItemDoModelo | undefined => perguntasDe(r.modelo, r.riscos).find((i) => i.mostrar_clima);

/** A previsão que o técnico viu, guardada no rascunho (sem ela, `null`). */
export const climaVistoNoRascunho = (r: RascunhoApr): ClimaRegistrado | null => (r as RascunhoComClima).clima ?? null;

/**
 * O que a tela faz quando o técnico toca numa resposta: só "Sim" na pergunta de clima, com previsão que aponta risco, pede algo.
 * Qualquer outra resposta, outra pergunta ou a falta de previsão segue direto.
 */
export function exigenciaDaResposta(item: Pick<ItemDoModelo, "mostrar_clima">, resposta: Resposta, previsao: PrevisaoDoTempo | null | undefined): ExigenciaDoClima {
  if (!item.mostrar_clima || resposta !== "sim") return "nada";
  return exigenciaDoClima(previsao);
}

/** "Confirmar e continuar" só vale com a foto do local no risco extremo; nos demais níveis, sempre vale. */
export const podeConfirmar = (exigencia: ExigenciaDoClima, fotos: number) => exigencia !== "confirmar_com_foto" || fotos > 0;

/** O texto de ajuda do modal, conforme o que ele exige. */
export const instrucaoDoModal = (exigencia: ExigenciaDoClima): string =>
  exigencia === "confirmar_com_foto"
    ? "A previsão é de uma região inteira e pode não valer no seu ponto. Para seguir, tire uma foto do local que mostre o tempo agora (o céu, o chão, o ambiente). O seu supervisor será avisado."
    : "A previsão é de uma região inteira e pode não valer no seu ponto. Se você olhou o tempo no local e segue, confirme.";

const confirmouComFoto = (r: RascunhoApr, itemId: string) => r.respostas[itemId]?.resposta === "sim" && climaVistoNoRascunho(r)?.confirmou_apesar_do_aviso === true;

/**
 * Responde a pergunta de clima: registra a resposta e guarda a previsão que a pessoa viu (`confirmou` só quando ela confirmou o aviso).
 * Trocar "Sim" por outra resposta descarta a confirmação e as fotos do local: elas só valem para a resposta "Sim".
 */
export function responderClima(r: RascunhoApr, item: ItemDoModelo, resposta: Resposta, previsao: PrevisaoDoTempo | null | undefined, confirmou?: boolean): RascunhoComClima {
  let novo: RascunhoApr = responder(r, item, resposta);
  if (resposta !== "sim") for (const f of novo.fotos[item.id] ?? []) novo = removerFoto(novo, item.id, f.id);
  const visto = registrarClima(previsao, resposta === "sim" && confirmou ? true : undefined);
  return { ...novo, clima: visto };
}

/** A foto do local do modal entra no rascunho (sobe pelo mesmo canal das demais; não invalida a validação). */
export const adicionarFotoDoLocal = (r: RascunhoApr, itemId: string, foto: FotoDoRascunho): RascunhoApr => adicionarFoto(r, itemId, foto);

/** Desiste do modal: as fotos tiradas para ele saem do rascunho, a menos que a resposta "Sim" já tenha sido confirmada antes com elas. */
export function descartarFotosDoModal(r: RascunhoApr, itemId: string): RascunhoApr {
  if (confirmouComFoto(r, itemId)) return r;
  let novo = r;
  for (const f of r.fotos[itemId] ?? []) novo = removerFoto(novo, itemId, f.id);
  return novo;
}

/**
 * As evidências da foto do local, no formato do evento: só as da pergunta de clima respondida "Sim" e confirmada (a `api` exige ao menos
 * uma quando a previsão era extremo; as fotos de um item que não reprovou não entram em `montarPayload`).
 */
export function evidenciasDoClima(r: RascunhoApr) {
  const item = perguntaDeClima(r);
  if (!item || !confirmouComFoto(r, item.id)) return [];
  return (r.fotos[item.id] ?? []).map((f) => ({
    id: f.id,
    arquivo_id: f.arquivoId,
    item_id: item.id,
    capturada_em: f.capturadaEm,
    ...(f.latitude !== undefined && f.longitude !== undefined ? { latitude: f.latitude, longitude: f.longitude } : {}),
  }));
}

/** `POST /aprs/avaliar` com a previsão que o técnico viu (só informativa para a `api`). */
export function montarAvaliacaoComClima(r: RascunhoApr) {
  const clima = climaVistoNoRascunho(r);
  return { ...montarAvaliacao(r), ...(clima ? { clima } : {}) };
}

/** O payload de `apr_concluida` com a previsão que o técnico viu e a foto do local; sem previsão, é o payload de sempre. */
export function montarPayloadComClima(r: RascunhoApr) {
  const base = montarPayload(r);
  const clima = climaVistoNoRascunho(r);
  const jaTem = new Set(base.evidencias.map((e) => e.id));
  const fotos = evidenciasDoClima(r).filter((e) => !jaTem.has(e.id));
  return { ...base, evidencias: [...base.evidencias, ...fotos], ...(clima ? { clima } : {}) };
}
