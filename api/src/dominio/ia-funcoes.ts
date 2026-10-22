import { eq, inArray } from "drizzle-orm";
import { DEFINICOES_DE_IA, definicaoDaFuncao, exigeDados, FUNCOES_DE_IA, LIGADA_AO_INSTALAR, type FuncaoDeIA } from "../../../shared/ia/funcoes";
import type { Db } from "../db/conexao";
import { iaFuncao, usuario } from "../db/schema";
import type { Deps } from "../deps";
import { conflito, invalido } from "../http/erros";
import { ProvedorIAControlado, type ProvedorIA } from "../servicos/ia";
import type { UsuarioAutenticado } from "../http/autenticacao";
import { assinaturaDoAto } from "./assinatura";
import type { ExigirAssinaturaJuridica } from "./assinatura-juridica";
import { registrarAuditoria } from "./auditoria";

/*
 * O controle da IA (`docs/ia-e-vitoria.md`, seção 3): cada função de IA liga e desliga sozinha, e a leitura de dados reais é
 * uma autorização assinada pelo admin. O estado fica em `ia_funcao`; sem linha vale o padrão ao instalar. Quem decide se uma
 * chamada sai é o módulo de IA (`ProvedorIAControlado`): nenhuma função consegue chamar o fornecedor desligada.
 */

/** O que está gravado, já sem as contas: vazio para a função que o admin nunca tocou. */
interface Gravado {
  ligada: boolean;
  comDados: boolean;
  versaoDoTexto: number | null;
  autorizadoPor: string | null;
  autorizadoEm: Date | null;
}

export interface EstadoDaFuncao {
  funcao: FuncaoDeIA;
  /** A função pode chamar a IA agora (ligada e, quando só funciona com dados, com a leitura autorizada na versão atual do texto). */
  ligada: boolean;
  /** A IA recebe dado real nesta função agora. */
  comDados: boolean;
  /** O admin autorizou a leitura, mas o texto do que ela lê mudou depois: precisa assinar de novo. */
  textoDesatualizado: boolean;
  autorizadoPor: { id: string; nome: string } | null;
  autorizadoEm: Date | null;
}

function efetivo(funcao: FuncaoDeIA, g: Gravado | undefined): Omit<EstadoDaFuncao, "autorizadoPor"> & { autorizadoPor: string | null } {
  const { versaoDoTexto } = definicaoDaFuncao(funcao);
  const base: Gravado = g ?? { ligada: LIGADA_AO_INSTALAR[funcao], comDados: false, versaoDoTexto: null, autorizadoPor: null, autorizadoEm: null };
  const vigente = base.comDados && base.versaoDoTexto === versaoDoTexto;
  const desatualizado = base.comDados && !vigente;
  // A função que só funciona com dados vale o que a assinatura vale; a outra liga e desliga à parte.
  const ligada = exigeDados(funcao) ? base.ligada && vigente : base.ligada;
  return { funcao, ligada, comDados: ligada && vigente, textoDesatualizado: desatualizado, autorizadoPor: base.autorizadoPor, autorizadoEm: base.autorizadoEm };
}

async function lerGravados(db: Db): Promise<Map<FuncaoDeIA, Gravado & { assinaturaPath: string | null }>> {
  const linhas = await db.select().from(iaFuncao);
  return new Map(linhas.map((l) => [l.funcao, l]));
}

/** O estado das quatro funções, com o nome de quem autorizou a leitura dos dados. */
export async function estadoDasFuncoes(db: Db): Promise<EstadoDaFuncao[]> {
  const gravados = await lerGravados(db);
  const ids = [...new Set([...gravados.values()].map((g) => g.autorizadoPor).filter((id): id is string => id !== null))];
  const pessoas = ids.length > 0 ? await db.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(inArray(usuario.id, ids)) : [];
  const nomes = new Map(pessoas.map((p) => [p.id, p.nome]));
  return FUNCOES_DE_IA.map((f) => {
    const e = efetivo(f, gravados.get(f));
    return { ...e, autorizadoPor: e.autorizadoPor ? { id: e.autorizadoPor, nome: nomes.get(e.autorizadoPor) ?? "Pessoa removida" } : null };
  });
}

async function estadoDe(db: Db, funcao: FuncaoDeIA) {
  const [g] = await db.select().from(iaFuncao).where(eq(iaFuncao.funcao, funcao));
  return efetivo(funcao, g);
}

/** A função está ligada (e, quando só funciona com dados, autorizada). Não olha a chave do fornecedor: para isso, `iaDisponivel`. */
export async function funcaoLigada(db: Db, funcao: FuncaoDeIA): Promise<boolean> {
  return (await estadoDe(db, funcao)).ligada;
}

/** A IA pode ler dado real nesta função agora: ligada, com a leitura autorizada e o texto assinado ainda vale. */
export async function leituraDeDadosLigada(db: Db, funcao: FuncaoDeIA): Promise<boolean> {
  return (await estadoDe(db, funcao)).comDados;
}

/** Há chave configurada no fornecedor **e** o admin deixou a função ligada: o único teste que quem chama a IA deve fazer antes de oferecer ou tentar a função. */
export async function iaDisponivel(deps: Pick<Deps, "db" | "ia">, funcao: FuncaoDeIA): Promise<boolean> {
  return deps.ia.disponivel() && (await funcaoLigada(deps.db, funcao));
}

/** Por que a função não chama a IA: sem chave no fornecedor, desligada pelo admin, ou nada (`disponivel`). A chave pesa primeiro: sem ela não há o que ligar. */
export async function situacaoDaFuncao(deps: Pick<Deps, "db" | "ia">, funcao: FuncaoDeIA): Promise<"disponivel" | "sem_chave" | "desligada"> {
  if (!deps.ia.disponivel()) return "sem_chave";
  return (await funcaoLigada(deps.db, funcao)) ? "disponivel" : "desligada";
}

// ---- Alterar -----------------------------------------------------------------------------------------------------------

export interface PedidoDeAlteracao {
  ligada: boolean;
  /** Só nas funções que funcionam sem dados: liga ou desliga a leitura de dados reais; ausente deixa como está. */
  comDados?: boolean;
  /** A versão do texto de "o que ela lê" que a pessoa viu ao assinar (`versaoDoTexto`); exigida quando passa a ler dados. */
  versaoDoTexto?: number;
  /** Quando o pedido assina (passa a ler dados), consome a assinatura com validade jurídica da rota. */
  exigirAssinaturaJuridica?: ExigirAssinaturaJuridica;
}

/**
 * Liga, desliga ou autoriza a leitura de dados de uma função. Passar a ler dados reais (ligar uma função que só funciona com
 * eles, ou ligar a leitura nas outras) exige a versão do texto que a pessoa viu e usa a assinatura do perfil dela; desligar
 * não exige nada e revoga a autorização. Desligar a função desliga também a leitura de dados.
 */
export async function alterarFuncaoDeIa(deps: Pick<Deps, "db" | "agora">, eu: UsuarioAutenticado, funcao: FuncaoDeIA, pedido: PedidoDeAlteracao): Promise<EstadoDaFuncao> {
  const { db } = deps;
  const def = definicaoDaFuncao(funcao);
  const [gravado] = await db.select().from(iaFuncao).where(eq(iaFuncao.funcao, funcao));
  const antes = efetivo(funcao, gravado);

  const novaLigada = pedido.ligada;
  let novaComDados: boolean;
  if (exigeDados(funcao)) {
    novaComDados = novaLigada;
  } else {
    if (pedido.comDados && !novaLigada) throw invalido("ligue_a_funcao", "Ligue a função antes de liberar a leitura de dados");
    novaComDados = novaLigada && (pedido.comDados ?? antes.comDados);
  }

  // Assina quando passa a ler dados, ou quando o texto que ela assinou ficou velho.
  const precisaAssinar = novaComDados && !antes.comDados;
  const agora = deps.agora();
  let autorizacao: Pick<typeof iaFuncao.$inferInsert, "versaoDoTexto" | "autorizadoPor" | "autorizadoEm" | "assinaturaPath">;
  if (precisaAssinar) {
    if (pedido.versaoDoTexto !== def.versaoDoTexto) {
      throw conflito("texto_mudou", "O texto do que esta função lê mudou: abra a janela de novo, leia e assine outra vez");
    }
    await pedido.exigirAssinaturaJuridica?.(db);
    autorizacao = { versaoDoTexto: def.versaoDoTexto, autorizadoPor: eu.id, autorizadoEm: agora, assinaturaPath: assinaturaDoAto(eu) };
  } else if (novaComDados) {
    autorizacao = {
      versaoDoTexto: gravado!.versaoDoTexto,
      autorizadoPor: gravado!.autorizadoPor,
      autorizadoEm: gravado!.autorizadoEm,
      assinaturaPath: gravado!.assinaturaPath,
    };
  } else {
    autorizacao = { versaoDoTexto: null, autorizadoPor: null, autorizadoEm: null, assinaturaPath: null };
  }

  const valores = { ligada: novaLigada, comDados: novaComDados, ...autorizacao, atualizadoEm: agora, atualizadoPor: eu.id };
  await db.insert(iaFuncao).values({ funcao, ...valores }).onConflictDoUpdate({ target: iaFuncao.funcao, set: valores });

  const depois = await estadoDe(db, funcao);
  const verbo = precisaAssinar ? "autorizar_dados" : antes.comDados && !depois.comDados ? "revogar_dados" : depois.ligada && !antes.ligada ? "ligar" : "desligar";
  const resumo: Record<string, string> = {
    autorizar_dados: `Autorizou a leitura de dados reais em "${def.titulo}" (assinou a versão ${def.versaoDoTexto} do texto)`,
    revogar_dados: `Revogou a leitura de dados reais em "${def.titulo}"`,
    ligar: `Ligou a função de IA "${def.titulo}"`,
    desligar: `Desligou a função de IA "${def.titulo}"`,
  };
  await registrarAuditoria(db, { id: eu.id, nome: eu.nome }, {
    entidade: "ia_funcao",
    verbo,
    entidadeId: funcao,
    alvo: def.titulo,
    resumo: resumo[verbo]!,
    detalhes: { ligada: { de: antes.ligada, para: depois.ligada }, com_dados: { de: antes.comDados, para: depois.comDados } },
  });
  const [estado] = (await estadoDasFuncoes(db)).filter((e) => e.funcao === funcao);
  return estado!;
}

// ---- A tela do admin ---------------------------------------------------------------------------------------------------

export interface PainelDaIa {
  /** Há chave do fornecedor configurada na `api`: sem ela nenhuma função chama a IA, mesmo ligada. */
  chaveConfigurada: boolean;
  provedor: "anthropic" | "gemini";
  funcoes: (EstadoDaFuncao & { modelo: string })[];
}

export async function painelDaIa(deps: Pick<Deps, "db" | "ia" | "config">): Promise<PainelDaIa> {
  const estados = await estadoDasFuncoes(deps.db);
  return {
    chaveConfigurada: deps.ia.disponivel(),
    provedor: deps.config.ia.provedor,
    funcoes: DEFINICOES_DE_IA.map((d) => ({ ...estados.find((e) => e.funcao === d.id)!, modelo: deps.config.ia.modelos[d.id] })),
  };
}

/** O módulo de IA da `api` com o controle ligado: cada chamada confere a função no banco antes de sair (`ProvedorIAControlado`). */
export const controlarIA = (db: Db, provedor: ProvedorIA): ProvedorIA => new ProvedorIAControlado(provedor, (funcao) => funcaoLigada(db, funcao));
