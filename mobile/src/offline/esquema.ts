import type { Banco } from "./banco";

/**
 * O esquema do banco local e as suas migrações: a versão fica em `PRAGMA user_version`, e cada migração roda uma vez, em ordem, numa
 * transação. **Nunca edite uma migração já publicada num aparelho**: acrescente uma nova ao fim da lista.
 *
 * A cópia da equipe guarda cada linha do `POST /sync/pull` como o JSON que a `api` mandou (`doc`), com só as colunas de que as
 * consultas precisam. A fila (`fila_eventos`, `fila_arquivos`) e os registros recusados são sempre de uma pessoa (`usuario_id`):
 * quem usa o aparelho depois não mexe no que ficou da anterior.
 */
export const MIGRACOES: string[] = [
  `
  CREATE TABLE meta (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  );

  CREATE TABLE os (
    id TEXT PRIMARY KEY,
    equipe_id TEXT NOT NULL,
    status TEXT NOT NULL,
    doc TEXT NOT NULL
  );
  CREATE TABLE aprs (
    id TEXT PRIMARY KEY,
    os_id TEXT NOT NULL,
    doc TEXT NOT NULL
  );
  CREATE INDEX aprs_os_idx ON aprs (os_id);
  CREATE TABLE execucoes (
    id TEXT PRIMARY KEY,
    os_id TEXT NOT NULL,
    doc TEXT NOT NULL
  );
  CREATE INDEX execucoes_os_idx ON execucoes (os_id);
  CREATE TABLE locais (
    id TEXT PRIMARY KEY,
    doc TEXT NOT NULL
  );
  CREATE TABLE atividades (
    codigo TEXT PRIMARY KEY,
    doc TEXT NOT NULL
  );
  CREATE TABLE modelos_apr (
    id TEXT PRIMARY KEY,
    codigo TEXT NOT NULL,
    versao INTEGER NOT NULL,
    doc TEXT NOT NULL
  );
  CREATE INDEX modelos_apr_codigo_idx ON modelos_apr (codigo, versao);
  CREATE TABLE usuarios (
    id TEXT PRIMARY KEY,
    doc TEXT NOT NULL
  );

  CREATE TABLE fila_eventos (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    usuario_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    os_id TEXT,
    payload TEXT NOT NULL,
    ocorrido_em TEXT NOT NULL,
    criado_em TEXT NOT NULL,
    tentativas INTEGER NOT NULL DEFAULT 0,
    ultimo_erro TEXT
  );
  CREATE INDEX fila_eventos_usuario_idx ON fila_eventos (usuario_id, ocorrido_em, seq);

  CREATE TABLE fila_arquivos (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    usuario_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    uri TEXT NOT NULL,
    nome TEXT NOT NULL,
    tipo_mime TEXT NOT NULL,
    criado_em TEXT NOT NULL,
    tentativas INTEGER NOT NULL DEFAULT 0,
    ultimo_erro TEXT
  );
  CREATE INDEX fila_arquivos_usuario_idx ON fila_arquivos (usuario_id, seq);

  CREATE TABLE eventos_recusados (
    id TEXT PRIMARY KEY,
    usuario_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    os_id TEXT,
    payload TEXT NOT NULL,
    ocorrido_em TEXT NOT NULL,
    codigo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    recusado_em TEXT NOT NULL
  );
  CREATE INDEX eventos_recusados_usuario_idx ON eventos_recusados (usuario_id, recusado_em);
  `,
];

/** Aplica o que falta do esquema. Devolve a versão em que o banco ficou. */
export async function migrar(banco: Banco, migracoes: string[] = MIGRACOES): Promise<number> {
  const atual = (await banco.um<{ user_version: number }>("PRAGMA user_version"))?.user_version ?? 0;
  for (let versao = atual; versao < migracoes.length; versao++) {
    await banco.transacao(async (tx) => {
      for (const instrucao of migracoes[versao]!.split(";").map((s) => s.trim()).filter(Boolean)) await tx.executar(instrucao);
      await tx.executar(`PRAGMA user_version = ${versao + 1}`);
    });
  }
  return migracoes.length;
}
