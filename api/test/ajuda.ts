/**
 * Ambiente dos testes da API: um Postgres embutido (PGlite) com as migrações aplicadas, a aplicação inteira montada
 * com autenticação, armazenamento e e-mail em memória, e atalhos para criar usuários e fazer requisições.
 * Uso: `const amb = await criarAmbiente(); const eu = await amb.criarUsuario({perfil: "admin"}); await amb.req("GET", "/me", { como: eu })`.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { criarApp } from "../src/app";
import type { Config } from "../src/config";
import { PASTA_MIGRACOES, type Db } from "../src/db/conexao";
import { equipe, usuario, type Perfil } from "../src/db/schema";
import { carregarDadosIniciais } from "../src/db/seed/carregar";
import { carregarOrdensDeExemplo } from "../src/db/seed/ordens-sap";
import type { Deps } from "../src/deps";
import { ArmazenamentoEmMemoria } from "../src/servicos/armazenamento";
import { AuthEmMemoria } from "../src/servicos/auth";
import { EmailEmMemoria } from "../src/servicos/email";
import { definicaoDaFuncao, exigeDados, type FuncaoDeIA } from "../../shared/ia/funcoes";
import { controlarIA } from "../src/dominio/ia-funcoes";
import { ProvedorIAEmMemoria } from "../src/servicos/ia";
import { ClimaEmMemoria } from "../src/servicos/clima";
import { OcrEmMemoria } from "../src/servicos/ocr-memoria";
import { RegistroIndisponivel, type ClienteRh, type FuncionarioRh } from "../src/servicos/rh";
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
  rhSimulado: true,
  rhApiUrl: "http://rh.local",
  rhApiToken: "token-rh",
  rhAvisoToken: "token-aviso-rh",
  rhAvisoUrl: "http://api.local/rh/avisos",
  rhLeituraHora: 3,
  smtpUrl: "",
  emailRemetente: "synqos@teste",
  emailResumoHora: 7,
  climaApiUrl: "https://api.open-meteo.com/v1/forecast",
  climaApiChave: "",
  painelUrl: "http://painel.local",
  // Sem chave real: os testes programam o `ProvedorIAEmMemoria` (amb.ia) quando precisam simular a IA ligada.
  ia: { provedor: "anthropic", apiKey: "", ligada: false, modelos: { chatbot: "modelo-chatbot-teste", minigames: "modelo-minigames-teste", recomendacao: "modelo-recomendacao-teste", digitalizacao: "modelo-digitalizacao-teste" } },
  vitoria: { limitePorConversa: 20, limitePorContaDia: 40, limiteGlobalDia: 1000, maxTokensResposta: 1024 },
  treinamentoIa: { limiteTreinamentos: 3, limiteRodadas: 4, maxTokens: 16000 },
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

/** Registro de funcionários em memória: o que o teste coloca em `funcionarios` (pela matrícula) é o que o SYNQ OS enxerga. */
export class RhEmMemoria implements ClienteRh {
  funcionarios = new Map<string, FuncionarioRh>();
  falhar = false;
  /** Quantas consultas por matrícula foram feitas (o `POST /usuarios` consulta de novo, sem confiar na prévia). */
  consultas = 0;
  async obterFuncionario(matricula: string) {
    if (this.falhar) throw new RegistroIndisponivel("RH fora do ar");
    this.consultas++;
    return this.funcionarios.get(matricula) ?? null;
  }
  async listarFuncionarios(o: { pagina: number; tamanho: number }) {
    if (this.falhar) throw new RegistroIndisponivel("RH fora do ar");
    const todos = [...this.funcionarios.values()].sort((a, b) => a.matricula.localeCompare(b.matricula));
    const inicio = (o.pagina - 1) * o.tamanho;
    return { funcionarios: todos.slice(inicio, inicio + o.tamanho), ...(inicio + o.tamanho < todos.length ? { proxima_pagina: o.pagina + 1 } : {}) };
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

export async function criarAmbiente(opcoes: { relogio?: Date; comCarga?: boolean; /** Quanto o token de acesso dura (padrão 1 h); os testes que avançam o relógio por dias precisam de mais. */ duracaoDoTokenSeg?: number } = {}) {
  const cliente = new PGlite();
  const db = drizzle(cliente, { casing: "snake_case" }) as unknown as Db;
  await migrate(drizzle(cliente, { casing: "snake_case" }), { migrationsFolder: PASTA_MIGRACOES });
  const relogio = { agora: opcoes.relogio ?? new Date() };
  if (opcoes.comCarga) {
    await carregarDadosIniciais(db);
    // As ordens de exemplo do SAP simulado (as fixtures são de antes de 2026-10-12).
    await carregarOrdensDeExemplo(db, relogio.agora);
  }
  const auth = new AuthEmMemoria(SEGREDO_JWT, () => relogio.agora, opcoes.duracaoDoTokenSeg);
  const armazenamento = new ArmazenamentoEmMemoria();
  const email = new EmailEmMemoria();
  const sap = new SapEmMemoria();
  const rh = new RhEmMemoria();
  const ia = new ProvedorIAEmMemoria();
  const ocr = new OcrEmMemoria();
  const clima = new ClimaEmMemoria();
  // Como em produção, a IA passa pelo controle: `amb.ia` é a de memória que o teste programa, e `deps.ia` a que confere se a função está ligada.
  // Uma cópia da configuração por ambiente: as configurações do sistema (`aplicarConfiguracoes`) escrevem nela.
  const config = { ...configDeTeste, vitoria: { ...configDeTeste.vitoria }, treinamentoIa: { ...configDeTeste.treinamentoIa } };
  const deps: Deps = { db, config, auth, armazenamento, email, sap, rh, ia: controlarIA(db, ia), ocr, clima, agora: () => relogio.agora };
  // O aviso que o simulador do RH manda ao SYNQ OS: fica anotado em `avisosRh` e, com `rhSimulador.encaminhar`, chega de verdade em `POST /rh/avisos`.
  const avisosRh: string[][] = [];
  const rhSimulador = { encaminhar: false };
  const app = criarApp(deps, {
    enviarAvisoRh: async (matriculas) => {
      avisosRh.push(matriculas);
      if (!rhSimulador.encaminhar) return;
      await app.request("http://api.local/rh/avisos", {
        method: "POST",
        headers: { Authorization: `Bearer ${configDeTeste.rhAvisoToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ matriculas }),
      });
    },
  });

  let contador = 0;

  /** Põe um funcionário no registro em memória (por padrão ativo, do setor `SERV_ESP`, com o e-mail `<matrícula>@empresa.com.br`, o mesmo que `criarUsuario` usa). */
  function registrarFuncionario(dados: Partial<FuncionarioRh> & { matricula: string }): FuncionarioRh {
    const f: FuncionarioRh = {
      nome: `Funcionário ${dados.matricula}`,
      email: `${dados.matricula.toLowerCase()}@empresa.com.br`,
      cargo: "Técnico em Gás",
      centro_trabalho: "SERV_ESP",
      setor: "Serviços Especiais",
      registro_profissional: null,
      situacao: "ativo",
      ...dados,
    };
    rh.funcionarios.set(f.matricula, f);
    return f;
  }

  async function criarEquipe(dados: { nome?: string; centroTrabalho?: string; supervisorId?: string | null } = {}) {
    contador++;
    const [e] = await db
      .insert(equipe)
      .values({ nome: dados.nome ?? `Equipe ${contador}`, centroTrabalho: dados.centroTrabalho ?? `CT_${contador}`, supervisorId: dados.supervisorId ?? null })
      .returning();
    return e!;
  }

  /** Cria o usuário no banco e na autenticação em memória, já com a senha trocada, e devolve o token de acesso. */
  async function criarUsuario(dados: { perfil: Perfil; equipeId?: string | null; nome?: string; matricula?: string; email?: string; senhaProvisoria?: boolean; ativo?: boolean; comAssinatura?: boolean; /** Torna a pessoa supervisora da própria equipe (`equipe.supervisor_id`); supervisor não é perfil. */ supervisor?: boolean }): Promise<UsuarioDeTeste> {
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
    if (dados.supervisor && dados.equipeId) await db.update(equipe).set({ supervisorId: conta.id }).where(eq(equipe.id, dados.equipeId));
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
  /** Cadastra a assinatura do perfil de quem ainda não tem (grava a imagem e chama `PUT /me/assinatura`): o que a tela de cadastro faz depois da liberação. */
  async function cadastrarAssinatura(usuario: UsuarioDeTeste) {
    const arquivo = randomUUID();
    await armazenamento.gravar("assinaturas", arquivo, new Uint8Array([1, 2, 3]), "image/png");
    await esperar(200, "PUT", "/me/assinatura", { como: usuario, json: { arquivo_id: arquivo } });
    return arquivo;
  }

  async function esperar(status: number, metodo: string, caminho: string, o: OpcoesReq = {}) {
    const r = await req(metodo, caminho, o);
    assert.equal(r.status, status, `${metodo} ${caminho} → ${r.status} (esperado ${status}): ${JSON.stringify(r.corpo)}`);
    return r.corpo;
  }

  /**
   * Liga uma função de IA como o admin faz na página da Vitória, pela rota de verdade (`PUT /vitoria/ia/{funcao}`, com a assinatura do
   * perfil). Nas funções que só funcionam com dados (recomendacao e digitalizacao) já autoriza a leitura; no chatbot e nos minigames
   * só autoriza com `comDados: true`. Sem `como`, cria um admin só para isso.
   */
  async function ligarIa(funcao: FuncaoDeIA, opcoes: { comDados?: boolean; como?: UsuarioDeTeste } = {}) {
    const admin = opcoes.como ?? (await criarUsuario({ perfil: "admin", nome: "Admin da IA" }));
    await esperar(200, "PUT", `/vitoria/ia/${funcao}`, {
      como: admin,
      json: { ligada: true, com_dados: opcoes.comDados ?? exigeDados(funcao), versao_do_texto: definicaoDaFuncao(funcao).versaoDoTexto },
    });
    return admin;
  }

  const sql = async <T = Record<string, unknown>>(texto: string, params: unknown[] = []) => (await cliente.query<T>(texto, params)).rows;
  /** A imagem da assinatura que está no perfil agora: é a que cada ato assinado copia para si. */
  const assinaturaDe = async (usuario: UsuarioDeTeste) => (await sql<{ assinatura_path: string | null }>("select assinatura_path from usuario where id = $1", [usuario.id]))[0]!.assinatura_path;

  return { db, deps, app, relogio, auth, armazenamento, email, sap, rh, ia, ocr, clima, registrarFuncionario, avisosRh, rhSimulador, cliente, criarEquipe, criarUsuario, req, esperar, cadastrarAssinatura, assinaturaDe, ligarIa, sql, fechar: () => cliente.close() };
}

export type Ambiente = Awaited<ReturnType<typeof criarAmbiente>>;

export const arquivoDeImagem = (conteudo = "imagem", tipo = "image/png") => new File([conteudo], "x.png", { type: tipo });
