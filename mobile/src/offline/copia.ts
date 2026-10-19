import type { Banco, Consulta } from "./banco";
import type { AprDaCopia, AtividadeDaCopia, EquipeDaCopia, ExecucaoDaCopia, LocalDaCopia, ModeloDaCopia, OsDaCopia, SnapshotDaApi, UsuarioDaCopia } from "./tipos";

/**
 * A cópia local da equipe: o `POST /sync/pull` guardado no banco, linha a linha, como a `api` o mandou. É só leitura para as telas;
 * quem a muda é o sincronizador, que a troca inteira a cada download. A regra que nunca se quebra: **uma OS com evento pendente na
 * fila não some da cópia**, mesmo que o snapshot novo não a traga (ela mudou de status, de equipe, foi cancelada...).
 */

const CHAVE_USUARIO = "copia_usuario_id";
const CHAVE_BAIXADA_EM = "copia_baixada_em";
const CHAVE_CURSOR = "copia_cursor";
const CHAVE_EQUIPE = "copia_equipe";

export const lerMeta = async (c: Consulta, chave: string) => (await c.um<{ valor: string }>("SELECT valor FROM meta WHERE chave = ?", [chave]))?.valor ?? null;
export const gravarMeta = (c: Consulta, chave: string, valor: string) => c.executar("INSERT INTO meta (chave, valor) VALUES (?, ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor", [chave, valor]);

const docs = async <T>(c: Consulta, sql: string, parametros: (string | number | null)[] = []): Promise<T[]> =>
  (await c.todos<{ doc: string }>(sql, parametros)).map((l) => JSON.parse(l.doc) as T);

/** De quem é a cópia e quando foi baixada; `null` se ainda não há cópia. */
export async function situacaoDaCopia(c: Consulta): Promise<{ usuarioId: string; baixadaEm: string } | null> {
  const usuarioId = await lerMeta(c, CHAVE_USUARIO);
  const baixadaEm = await lerMeta(c, CHAVE_BAIXADA_EM);
  return usuarioId && baixadaEm ? { usuarioId, baixadaEm } : null;
}

export async function cursorDaCopia(c: Consulta): Promise<string | null> {
  return lerMeta(c, CHAVE_CURSOR);
}

/**
 * Troca a cópia pelo snapshot novo. `manter` são as OS com evento pendente: se o snapshot não as traz (e a cópia anterior era da mesma
 * pessoa), ficam como estavam, com as APRs, as execuções e o que elas usam (local e modelo).
 */
export async function substituirCopia(banco: Banco, usuarioId: string, snapshot: SnapshotDaApi, manter: ReadonlySet<string>, agora: Date): Promise<void> {
  await banco.transacao(async (tx) => {
    const eraDaMesmaPessoa = (await lerMeta(tx, CHAVE_USUARIO)) === usuarioId;
    const noSnapshot = new Set(snapshot.os.map((o) => o.id));
    const preservar = eraDaMesmaPessoa ? [...manter].filter((id) => !noSnapshot.has(id)) : [];

    const velhasOs = preservar.length ? (await docs<OsDaCopia>(tx, "SELECT doc FROM os")).filter((o) => preservar.includes(o.id)) : [];
    const velhasAprs = velhasOs.length ? (await docs<AprDaCopia>(tx, "SELECT doc FROM aprs")).filter((a) => preservar.includes(a.os_id)) : [];
    const velhasExecucoes = velhasOs.length ? (await docs<ExecucaoDaCopia>(tx, "SELECT doc FROM execucoes")).filter((e) => preservar.includes(e.os_id)) : [];
    const velhosLocais = velhasOs.length ? (await docs<LocalDaCopia>(tx, "SELECT doc FROM locais")).filter((l) => velhasOs.some((o) => o.local_instalacao_id === l.id)) : [];
    const velhosModelos = velhasAprs.length ? (await docs<ModeloDaCopia>(tx, "SELECT doc FROM modelos_apr")).filter((m) => velhasAprs.some((a) => a.modelo_apr_id === m.id)) : [];

    for (const tabela of ["os", "aprs", "execucoes", "locais", "atividades", "modelos_apr", "usuarios"]) await tx.executar(`DELETE FROM ${tabela}`);

    const todasOs = [...snapshot.os, ...velhasOs];
    for (const o of todasOs) await tx.executar("INSERT OR REPLACE INTO os (id, equipe_id, status, doc) VALUES (?, ?, ?, ?)", [o.id, o.equipe_id, o.status, JSON.stringify(o)]);
    for (const a of [...snapshot.aprs, ...velhasAprs]) await tx.executar("INSERT OR REPLACE INTO aprs (id, os_id, doc) VALUES (?, ?, ?)", [a.id, a.os_id, JSON.stringify(a)]);
    for (const e of [...snapshot.execucoes, ...velhasExecucoes]) await tx.executar("INSERT OR REPLACE INTO execucoes (id, os_id, doc) VALUES (?, ?, ?)", [e.id, e.os_id, JSON.stringify(e)]);
    for (const l of [...snapshot.locais, ...velhosLocais]) await tx.executar("INSERT OR REPLACE INTO locais (id, doc) VALUES (?, ?)", [l.id, JSON.stringify(l)]);
    for (const a of snapshot.atividades) await tx.executar("INSERT OR REPLACE INTO atividades (codigo, doc) VALUES (?, ?)", [a.codigo, JSON.stringify(a)]);
    for (const m of [...snapshot.modelos_apr, ...velhosModelos]) await tx.executar("INSERT OR REPLACE INTO modelos_apr (id, codigo, versao, doc) VALUES (?, ?, ?, ?)", [m.id, m.codigo, m.versao, JSON.stringify(m)]);
    for (const u of snapshot.usuarios) await tx.executar("INSERT OR REPLACE INTO usuarios (id, doc) VALUES (?, ?)", [u.id, JSON.stringify(u)]);

    await gravarMeta(tx, CHAVE_USUARIO, usuarioId);
    await gravarMeta(tx, CHAVE_BAIXADA_EM, agora.toISOString());
    await gravarMeta(tx, CHAVE_CURSOR, snapshot.cursor);
    await gravarMeta(tx, CHAVE_EQUIPE, JSON.stringify(snapshot.equipe ?? null));
  });
}

/** Apaga a cópia (outra pessoa entrou neste aparelho). A fila não é tocada: ela é de cada pessoa. */
export async function apagarCopia(banco: Banco): Promise<void> {
  await banco.transacao(async (tx) => {
    for (const tabela of ["os", "aprs", "execucoes", "locais", "atividades", "modelos_apr", "usuarios"]) await tx.executar(`DELETE FROM ${tabela}`);
    await tx.executar("DELETE FROM meta WHERE chave IN (?, ?, ?, ?)", [CHAVE_USUARIO, CHAVE_BAIXADA_EM, CHAVE_CURSOR, CHAVE_EQUIPE]);
  });
}

// --- leitura -------------------------------------------------------------------------------------------------------

export const lerTodasAsOs = (c: Consulta) => docs<OsDaCopia>(c, "SELECT doc FROM os");

export async function lerOs(c: Consulta, id: string): Promise<OsDaCopia | null> {
  return (await docs<OsDaCopia>(c, "SELECT doc FROM os WHERE id = ?", [id]))[0] ?? null;
}

export const lerAprsDaOs = (c: Consulta, osId: string) => docs<AprDaCopia>(c, "SELECT doc FROM aprs WHERE os_id = ?", [osId]);
export const lerExecucoesDaOs = (c: Consulta, osId: string) => docs<ExecucaoDaCopia>(c, "SELECT doc FROM execucoes WHERE os_id = ?", [osId]);
export const lerTodasAsExecucoes = (c: Consulta) => docs<ExecucaoDaCopia>(c, "SELECT doc FROM execucoes");

export async function lerLocal(c: Consulta, id: string): Promise<LocalDaCopia | null> {
  return (await docs<LocalDaCopia>(c, "SELECT doc FROM locais WHERE id = ?", [id]))[0] ?? null;
}

export const lerTodosOsLocais = (c: Consulta) => docs<LocalDaCopia>(c, "SELECT doc FROM locais");

export async function lerAtividade(c: Consulta, codigo: string): Promise<AtividadeDaCopia | null> {
  return (await docs<AtividadeDaCopia>(c, "SELECT doc FROM atividades WHERE codigo = ?", [codigo]))[0] ?? null;
}

export async function lerModelo(c: Consulta, id: string): Promise<ModeloDaCopia | null> {
  return (await docs<ModeloDaCopia>(c, "SELECT doc FROM modelos_apr WHERE id = ?", [id]))[0] ?? null;
}

/** A versão publicada mais recente de cada modelo que não foi excluído, na ordem dos códigos. */
export async function lerModelosPublicados(c: Consulta): Promise<ModeloDaCopia[]> {
  const todos = await docs<ModeloDaCopia>(c, "SELECT doc FROM modelos_apr ORDER BY codigo, versao DESC");
  const maisRecentes = new Map<string, ModeloDaCopia>();
  for (const m of todos) if (!m.arquivado_em && m.publicado_em && !maisRecentes.has(m.codigo)) maisRecentes.set(m.codigo, m);
  return [...maisRecentes.values()];
}

export const lerUsuarios = (c: Consulta) => docs<UsuarioDaCopia>(c, "SELECT doc FROM usuarios");

export async function lerEquipe(c: Consulta): Promise<EquipeDaCopia | null> {
  const bruto = await lerMeta(c, CHAVE_EQUIPE);
  return bruto ? (JSON.parse(bruto) as EquipeDaCopia | null) : null;
}
