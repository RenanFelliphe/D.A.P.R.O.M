import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import { ESTADOS_TREINAMENTO, equipe, execucao, execucaoPausa, localInstalacao, os, usuario } from "../db/schema";
import { emMinutos, tempoDaExecucao } from "../dominio/painel-comum";
import { equipeParaApi, nomesDosCriadores, treinamentoParaApi, usuarioParaApi } from "../dominio/usuarios";
import type { Autenticacao, Ambiente } from "../http/autenticacao";
import { invalido } from "../http/erros";
import { responder } from "../http/resposta";
import { lerCorpo, uuid } from "../http/validacao";

export function rotasMe(deps: Deps, { autenticar }: Autenticacao) {
  const r = new Hono<Ambiente>();

  /** Também com a senha inicial: é como a tela "Defina sua senha" sabe quem é o usuário. */
  r.get("/me", autenticar({ permitirSenhaProvisoria: true, permitirPendente: true }), async (c) => {
    const eu = c.get("usuario");
    const [u] = await deps.db.select().from(usuario).where(eq(usuario.id, eu.id));
    const [e] = eu.equipeId ? await deps.db.select().from(equipe).where(eq(equipe.id, eu.equipeId)) : [];
    // As equipes que a pessoa supervisa (qualquer perfil): é o que abre a gestão para quem é técnico.
    const supervisionadas = eu.equipesSupervisionadas.length
      ? await deps.db.select({ id: equipe.id, nome: equipe.nome }).from(equipe).where(inArray(equipe.id, eu.equipesSupervisionadas)).orderBy(equipe.nome)
      : [];
    const criadores = await nomesDosCriadores(deps.db, [u!]);
    return responder(c, { usuario: usuarioParaApi(u!, { criadoPorNome: (u!.criadoPorId && criadores.get(u!.criadoPorId)) || null }), equipe: e ? equipeParaApi(e) : null, equipesSupervisionadas: supervisionadas });
  });

  /**
   * Estado do Campo de treino (a web guarda aqui se a pessoa concluiu, pulou ou vai refazer). Idempotente; `nao_iniciado` serve para "refazer".
   * Também com a senha inicial e com o acesso pendente de liberação, como `GET /me`.
   */
  r.put("/me/treinamento", autenticar({ permitirSenhaProvisoria: true, permitirPendente: true }), async (c) => {
    const eu = c.get("usuario");
    const { estado } = await lerCorpo(c, z.object({ estado: z.enum(ESTADOS_TREINAMENTO) }));
    const [u] = await deps.db
      .update(usuario)
      .set({ treinamentoEstado: estado, treinamentoEm: estado === "nao_iniciado" ? null : deps.agora() })
      .where(eq(usuario.id, eu.id))
      .returning();
    return responder(c, { treinamento: treinamentoParaApi(u!) });
  });

  /**
   * Refazer a assinatura vale para as próximas: as já feitas guardam o caminho da imagem que usaram, e um arquivo
   * nunca é sobrescrito, então elas não mudam.
   */
  r.put("/me/assinatura", autenticar(), async (c) => {
    const eu = c.get("usuario");
    const { arquivo_id } = await lerCorpo(c, z.object({ arquivo_id: uuid }));
    if (!(await deps.armazenamento.existe("assinaturas", arquivo_id))) {
      throw invalido("arquivo_inexistente", "Envie a imagem da assinatura antes (PUT /arquivos/{id})");
    }
    await deps.db.update(usuario).set({ assinaturaPath: arquivo_id, assinaturaEm: deps.agora() }).where(eq(usuario.id, eu.id));
    return responder(c, { assinaturaPath: arquivo_id });
  });

  /** Execuções do usuário ainda em andamento (`resultado` nulo), em qualquer OS: a tela de execução as usa para exigir a suspensão de uma esquecida de outro dia. */
  r.get("/me/execucoes-abertas", autenticar(), async (c) => {
    const eu = c.get("usuario");
    const linhas = await deps.db
      .select({ id: execucao.id, osId: execucao.osId, aprId: execucao.aprId, inicio: execucao.inicio, numeroOrdem: os.numeroOrdem, titulo: os.titulo })
      .from(execucao)
      .innerJoin(os, eq(os.id, execucao.osId))
      .where(and(eq(execucao.executorId, eu.id), isNull(execucao.resultado)))
      .orderBy(execucao.inicio);
    return responder(c, { execucoes: linhas });
  });

  /** Histórico do técnico: as execuções que ele encerrou nos últimos 60 dias, da mais recente à mais antiga. */
  r.get("/me/historico", autenticar(), async (c) => {
    const eu = c.get("usuario");
    const desde = new Date(deps.agora().getTime() - DIAS_DO_HISTORICO * 86_400_000);
    const linhas = await deps.db
      .select({
        id: execucao.id,
        osId: execucao.osId,
        numeroOrdem: os.numeroOrdem,
        titulo: os.titulo,
        localCodigo: localInstalacao.codigo,
        inicio: execucao.inicio,
        fim: execucao.fim,
        pdfPath: os.pdfPath,
      })
      .from(execucao)
      .innerJoin(os, eq(os.id, execucao.osId))
      .innerJoin(localInstalacao, eq(localInstalacao.id, os.localInstalacaoId))
      .where(and(eq(execucao.executorId, eu.id), eq(execucao.resultado, "encerrada"), gte(execucao.fim, desde)))
      .orderBy(desc(execucao.fim), desc(execucao.id));
    const pausas = linhas.length ? await deps.db.select().from(execucaoPausa).where(inArray(execucaoPausa.execucaoId, linhas.map((l) => l.id))) : [];
    const execucoes = linhas.map(({ pdfPath, ...l }) => {
      const tempo = tempoDaExecucao(l, pausas.filter((p) => p.execucaoId === l.id));
      return { ...l, tempoLiquidoMin: tempo ? emMinutos(tempo.liquidoMs) : null, pausaMin: tempo ? emMinutos(tempo.pausaMs) : null, pdfPronto: pdfPath !== null };
    });
    return responder(c, { execucoes });
  });

  return r;
}

const DIAS_DO_HISTORICO = 60;
