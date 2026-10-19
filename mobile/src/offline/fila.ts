import type { Consulta } from "./banco";
import type { ArquivoDaFila, EventoDaFila, EventoRecusado } from "./tipos";

/**
 * A fila local: o que o técnico fez e ainda não chegou à `api`. Os eventos saem em ordem de `ocorrido_em` (o `seq` desempata); os
 * arquivos sobem antes. Tudo é de uma pessoa (`usuarioId`).
 */

interface LinhaDeEvento {
  seq: number;
  id: string;
  usuario_id: string;
  tipo: string;
  os_id: string | null;
  payload: string;
  ocorrido_em: string;
  criado_em: string;
  tentativas: number;
  ultimo_erro: string | null;
}

const doEvento = (l: LinhaDeEvento): EventoDaFila => ({
  seq: l.seq,
  id: l.id,
  usuarioId: l.usuario_id,
  tipo: l.tipo,
  osId: l.os_id,
  payload: JSON.parse(l.payload) as Record<string, unknown>,
  ocorridoEm: l.ocorrido_em,
  criadoEm: l.criado_em,
  tentativas: l.tentativas,
  ultimoErro: l.ultimo_erro,
});

export interface NovoEvento {
  id: string;
  usuarioId: string;
  tipo: string;
  osId: string | null;
  payload: Record<string, unknown>;
  ocorridoEm: string;
  criadoEm: string;
}

/**
 * Guarda o evento. O mesmo `id` de novo (o rascunho da APR reenvia o mesmo evento, agora com a evidência) troca o conteúdo e mantém o
 * lugar na fila.
 */
export async function guardarEvento(c: Consulta, e: NovoEvento): Promise<void> {
  await c.executar(
    `INSERT INTO fila_eventos (id, usuario_id, tipo, os_id, payload, ocorrido_em, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET payload = excluded.payload, os_id = excluded.os_id, ultimo_erro = NULL`,
    [e.id, e.usuarioId, e.tipo, e.osId, JSON.stringify(e.payload), e.ocorridoEm, e.criadoEm],
  );
}

/** Os eventos pendentes da pessoa, na ordem em que a `api` os aplica. */
export async function eventosPendentes(c: Consulta, usuarioId: string): Promise<EventoDaFila[]> {
  const linhas = await c.todos<LinhaDeEvento>("SELECT * FROM fila_eventos WHERE usuario_id = ? ORDER BY ocorrido_em, seq", [usuarioId]);
  return linhas.map(doEvento);
}

export async function removerEvento(c: Consulta, id: string): Promise<void> {
  await c.executar("DELETE FROM fila_eventos WHERE id = ?", [id]);
}

/** O evento não pôde ser aplicado ainda (ou o envio falhou): conta a tentativa e guarda o motivo. */
export async function registrarTentativaDoEvento(c: Consulta, id: string, erro: string): Promise<void> {
  await c.executar("UPDATE fila_eventos SET tentativas = tentativas + 1, ultimo_erro = ? WHERE id = ?", [erro, id]);
}

/** Tira o evento da fila e o guarda entre os recusados, com o motivo. */
export async function recusarEvento(c: Consulta, e: EventoDaFila, codigo: string, mensagem: string, agora: Date): Promise<void> {
  await c.executar(
    `INSERT OR REPLACE INTO eventos_recusados (id, usuario_id, tipo, os_id, payload, ocorrido_em, codigo, mensagem, recusado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [e.id, e.usuarioId, e.tipo, e.osId, JSON.stringify(e.payload), e.ocorridoEm, codigo, mensagem, agora.toISOString()],
  );
  await removerEvento(c, e.id);
}

export async function eventosRecusados(c: Consulta, usuarioId: string): Promise<EventoRecusado[]> {
  const linhas = await c.todos<{ id: string; usuario_id: string; tipo: string; os_id: string | null; payload: string; ocorrido_em: string; codigo: string; mensagem: string; recusado_em: string }>(
    "SELECT * FROM eventos_recusados WHERE usuario_id = ? ORDER BY recusado_em DESC",
    [usuarioId],
  );
  return linhas.map((l) => ({ id: l.id, usuarioId: l.usuario_id, tipo: l.tipo, osId: l.os_id, payload: JSON.parse(l.payload) as Record<string, unknown>, ocorridoEm: l.ocorrido_em, codigo: l.codigo, mensagem: l.mensagem, recusadoEm: l.recusado_em }));
}

// ---------------------------------------------------------------------------------------------------------------

interface LinhaDeArquivo {
  seq: number;
  id: string;
  usuario_id: string;
  tipo: string;
  uri: string;
  nome: string;
  tipo_mime: string;
  criado_em: string;
  tentativas: number;
  ultimo_erro: string | null;
}

const doArquivo = (l: LinhaDeArquivo): ArquivoDaFila => ({
  seq: l.seq,
  id: l.id,
  usuarioId: l.usuario_id,
  tipo: l.tipo as ArquivoDaFila["tipo"],
  uri: l.uri,
  nome: l.nome,
  tipoMime: l.tipo_mime,
  criadoEm: l.criado_em,
  tentativas: l.tentativas,
  ultimoErro: l.ultimo_erro,
});

export type NovoArquivo = Pick<ArquivoDaFila, "id" | "usuarioId" | "tipo" | "uri" | "nome" | "tipoMime" | "criadoEm">;

/** Guarda o arquivo para subir. O mesmo `id` de novo (a pessoa tentou outra vez) não duplica. */
export async function guardarArquivo(c: Consulta, a: NovoArquivo): Promise<void> {
  await c.executar(
    `INSERT INTO fila_arquivos (id, usuario_id, tipo, uri, nome, tipo_mime, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET uri = excluded.uri, nome = excluded.nome, tipo_mime = excluded.tipo_mime, ultimo_erro = NULL`,
    [a.id, a.usuarioId, a.tipo, a.uri, a.nome, a.tipoMime, a.criadoEm],
  );
}

export async function arquivosPendentes(c: Consulta, usuarioId: string): Promise<ArquivoDaFila[]> {
  return (await c.todos<LinhaDeArquivo>("SELECT * FROM fila_arquivos WHERE usuario_id = ? ORDER BY seq", [usuarioId])).map(doArquivo);
}

export async function removerArquivo(c: Consulta, id: string): Promise<void> {
  await c.executar("DELETE FROM fila_arquivos WHERE id = ?", [id]);
}

export async function registrarTentativaDoArquivo(c: Consulta, id: string, erro: string): Promise<void> {
  await c.executar("UPDATE fila_arquivos SET tentativas = tentativas + 1, ultimo_erro = ? WHERE id = ?", [erro, id]);
}

/** Quantos registros esperam para subir (eventos e arquivos). É o "N registros pendentes" que a pessoa vê. */
export async function contarPendentes(c: Consulta, usuarioId: string): Promise<{ eventos: number; arquivos: number }> {
  const e = await c.um<{ n: number }>("SELECT COUNT(*) AS n FROM fila_eventos WHERE usuario_id = ?", [usuarioId]);
  const a = await c.um<{ n: number }>("SELECT COUNT(*) AS n FROM fila_arquivos WHERE usuario_id = ?", [usuarioId]);
  return { eventos: e?.n ?? 0, arquivos: a?.n ?? 0 };
}
