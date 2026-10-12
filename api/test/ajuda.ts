/**
 * Ambiente dos testes da API: um Postgres embutido (PGlite) com as migrações aplicadas, a aplicação inteira montada
 * com autenticação, armazenamento e e-mail em memória, e atalhos para criar usuários e fazer requisições.
 * Uso: `const amb = await criarAmbiente(); const eu = await amb.criarUsuario({perfil: "admin"}); await amb.req("GET", "/me", { como: eu })`.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { criarApp } from "../src/app";
import type { Config } from "../src/config";
import { PASTA_MIGRACOES, type Db } from "../src/db/conexao";
import { equipe, usuario, type Perfil } from "../src/db/schema";
import { carregarDadosIniciais } from "../src/db/seed/carregar";
import type { Deps } from "../src/deps";
import { ArmazenamentoEmMemoria } from "../src/servicos/armazenamento";
import { AuthEmMemoria } from "../src/servicos/auth";
import { EmailEmMemoria } from "../src/servicos/email";
import type { ClienteSap, OrdemSap } from "../src/servicos/sap";

export const SEGREDO_JWT = "segredo-de-teste-com-mais-de-32-caracteres!!";
export const SENHA_PADRAO = "senha-de-teste-1";

export const configDeTeste: Config = {
  porta: 0,
  versao: "teste",
  databaseUrl: "",
  supabaseUrl: "http://supabase.local",
  supabaseServiceRoleKey: "chave",
  supabaseJwtSecret: SEGREDO_JWT,
  sapApiUrl: "http://sap.local",
  sapApiToken: "token-sap",
  sapSimulado: true,
  sapLeituraIntervaloMin: 15,
  smtpUrl: "",
  emailRemetente: "daprom@teste",
  painelUrl: "http://painel.local",
};

/** SAP em memória: o que o teste coloca em `ordens` é o que a leitura enxerga. */
export class SapEmMemoria implements ClienteSap {
  ordens: OrdemSap[] = [];
  falhar = false;
  async listarOrdens(o: { alteradasDesde?: Date; pagina: number; tamanho: number }) {
    if (this.falhar) throw new Error("SAP fora do ar");
    const inicio = (o.pagina - 1) * o.tamanho;
    const ordens = this.ordens.slice(inicio, inicio + o.tamanho);
    return { ordens, ...(inicio + o.tamanho < this.ordens.length ? { proxima_pagina: o.pagina + 1 } : {}) };
  }
  async obterOrdem(numero: string) {
    return this.ordens.find((x) => x.numero_ordem === numero) ?? null;
  }
}

export interface UsuarioDeTeste {
  id: string;
  matricula: string;
  /** O login. */
  email: string;
  senha: string;
  token: string;
  perfil: Perfil;
  equipeId: string | null;
}

export interface OpcoesReq {
  como?: UsuarioDeTeste | null;
  json?: unknown;
  form?: FormData;
  consulta?: Record<string, string | number | boolean | undefined>;
  cabecalhos?: Record<string, string>;
}

export async function criarAmbiente(opcoes: { relogio?: Date; comCarga?: boolean } = {}) {
  const cliente = new PGlite();
  const db = drizzle(cliente, { casing: "snake_case" }) as unknown as Db;
  await migrate(drizzle(cliente, { casing: "snake_case" }), { migrationsFolder: PASTA_MIGRACOES });
  if (opcoes.comCarga) await carregarDadosIniciais(db);

  const relogio = { agora: opcoes.relogio ?? new Date() };
  const auth = new AuthEmMemoria(SEGREDO_JWT, () => relogio.agora);
  const armazenamento = new ArmazenamentoEmMemoria();
  const email = new EmailEmMemoria();
  const sap = new SapEmMemoria();
  const deps: Deps = { db, config: configDeTeste, auth, armazenamento, email, sap, agora: () => relogio.agora };
  const app = criarApp(deps);

  let contador = 0;

  async function criarEquipe(dados: { nome?: string; centroTrabalho?: string; supervisorId?: string | null } = {}) {
    contador++;
    const [e] = await db
      .insert(equipe)
      .values({ nome: dados.nome ?? `Equipe ${contador}`, centroTrabalho: dados.centroTrabalho ?? `CT_${contador}`, supervisorId: dados.supervisorId ?? null })
      .returning();
    return e!;
  }

  /** Cria o usuário no banco e na autenticação em memória, já com a senha trocada, e devolve o token de acesso. */
  async function criarUsuario(dados: { perfil: Perfil; equipeId?: string | null; nome?: string; matricula?: string; email?: string; senhaProvisoria?: boolean; ativo?: boolean; comAssinatura?: boolean }): Promise<UsuarioDeTeste> {
    contador++;
    const matricula = dados.matricula ?? `M${contador}${randomUUID().slice(0, 4)}`;
    const email = dados.email ?? `${matricula.toLowerCase()}@empresa.com.br`;
    const conta = await auth.criarConta(email, SENHA_PADRAO);
    const assinatura = dados.comAssinatura === false ? null : randomUUID();
    if (assinatura) await armazenamento.gravar("assinaturas", assinatura, new Uint8Array([1, 2, 3]), "image/png");
    await db.insert(usuario).values({
      id: conta.id,
      nome: dados.nome ?? `Usuário ${contador}`,
      matricula,
      email,
      perfil: dados.perfil,
      equipeId: dados.equipeId ?? null,
      senhaProvisoria: dados.senhaProvisoria ?? false,
      ativo: dados.ativo ?? true,
      assinaturaPath: assinatura,
      assinaturaEm: assinatura ? relogio.agora : null,
    });
    const sessao = (await auth.entrar(email, SENHA_PADRAO))!;
    return { id: conta.id, matricula, email, senha: SENHA_PADRAO, token: sessao.accessToken, perfil: dados.perfil, equipeId: dados.equipeId ?? null };
  }

  async function req(metodo: string, caminho: string, o: OpcoesReq = {}) {
    const url = new URL(`http://api.local${caminho}`);
    for (const [k, v] of Object.entries(o.consulta ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
    const cabecalhos: Record<string, string> = { ...o.cabecalhos };
    if (o.como) cabecalhos.Authorization = `Bearer ${o.como.token}`;
    let corpo: BodyInit | undefined;
    if (o.json !== undefined) {
      cabecalhos["Content-Type"] = "application/json";
      corpo = JSON.stringify(o.json);
    } else if (o.form) corpo = o.form;
    const resposta = await app.request(url, { method: metodo, headers: cabecalhos, body: corpo });
    const tipo = resposta.headers.get("content-type") ?? "";
    const dados = tipo.includes("json") ? await resposta.json() : await resposta.arrayBuffer();
    return { status: resposta.status, corpo: dados as any, cabecalhos: resposta.headers };
  }

  /** `req` que já confere o status esperado e devolve o corpo. */
  async function esperar(status: number, metodo: string, caminho: string, o: OpcoesReq = {}) {
    const r = await req(metodo, caminho, o);
    assert.equal(r.status, status, `${metodo} ${caminho} → ${r.status} (esperado ${status}): ${JSON.stringify(r.corpo)}`);
    return r.corpo;
  }

  const sql = async <T = Record<string, unknown>>(texto: string, params: unknown[] = []) => (await cliente.query<T>(texto, params)).rows;

  return { db, deps, app, relogio, auth, armazenamento, email, sap, cliente, criarEquipe, criarUsuario, req, esperar, sql, fechar: () => cliente.close() };
}

export type Ambiente = Awaited<ReturnType<typeof criarAmbiente>>;

export const arquivoDeImagem = (conteudo = "imagem", tipo = "image/png") => new File([conteudo], "x.png", { type: tipo });
