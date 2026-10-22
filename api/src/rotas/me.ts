import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { CATEGORIAS_DE_EMAIL, ehCategoriaObrigatoria, ROTULO_DA_CATEGORIA } from "../../../shared/notificacoes/avisos";
import type { Db } from "../db/conexao";
import type { Deps } from "../deps";
import { ESTADOS_TREINAMENTO, ausencia, equipe, execucao, execucaoPausa, execucaoPedido, localInstalacao, os, usuario } from "../db/schema";
import { fecharPedidosVencidos } from "../dominio/pedidos-execucao";
import { aprsParaAssinar } from "../dominio/apr-assinaturas";
import { ausenciaDaPessoaParaApi, ausenciaVigenteDe } from "../dominio/ausencia";
import { representacoesEmVigor, rotuloDoMotivo } from "../dominio/representacao";
import { resumoParaMe } from "../dominio/gamificacao-leituras";
import { ganhosDe } from "../dominio/lancamentos";
import { emMinutos, tempoDaExecucao } from "../dominio/painel-comum";
import { pontuarAssinatura, pontuarTreinamento } from "../dominio/pontuacao";
import { equipeParaApi, nomesDosCriadores, treinamentoParaApi, usuarioParaApi } from "../dominio/usuarios";
import type { Autenticacao, Ambiente } from "../http/autenticacao";
import { invalido, proibido } from "../http/erros";
import { responder } from "../http/resposta";
import { lerCorpo, uuid } from "../http/validacao";
import { diaDe } from "../dominio/tempo";

export function rotasMe(deps: Deps, { autenticar }: Autenticacao) {
  const r = new Hono<Ambiente>();

  /** Também com a senha inicial: é como a tela "Defina sua senha" sabe quem é o usuário. */
  r.get("/me", autenticar({ permitirSenhaProvisoria: true, permitirPendente: true, permitirSemAssinatura: true }), async (c) => {
    const eu = c.get("usuario");
    const [u] = await deps.db.select().from(usuario).where(eq(usuario.id, eu.id));
    const [e] = eu.equipeId ? await deps.db.select().from(equipe).where(eq(equipe.id, eu.equipeId)) : [];
    // As equipes que a pessoa supervisa (qualquer perfil): é o que abre a gestão para quem é técnico.
    const supervisionadas = eu.equipesSupervisionadas.length
      ? await deps.db.select({ id: equipe.id, nome: equipe.nome }).from(equipe).where(inArray(equipe.id, eu.equipesSupervisionadas)).orderBy(equipe.nome)
      : [];
    // As equipes em que a pessoa está no comando agora, como representante do supervisor (a faixa "Você responde pela equipe X").
    const representadas = eu.equipesRepresentadas.length
      ? await deps.db
          .select({ id: equipe.id, nome: equipe.nome, supervisorNome: usuario.nome, desde: equipe.representacaoDesde, motivo: equipe.representacaoMotivo })
          .from(equipe)
          // A equipe sem supervisor também é representada: o nome do supervisor vem nulo.
          .leftJoin(usuario, eq(usuario.id, equipe.supervisorId))
          .where(inArray(equipe.id, eu.equipesRepresentadas))
          .orderBy(equipe.nome)
      : [];
    const emVigor = await representacoesEmVigor(deps.db, deps.agora(), { representanteId: eu.id });
    const criadores = await nomesDosCriadores(deps.db, [u!]);
    // A ausência que está valendo (a faixa "Você está ausente até DD/MM" e a tela de retorno): os dados dela e o que está em andamento.
    const vigente = await ausenciaVigenteDe(deps.db, eu.id, diaDe(deps.agora()));
    const [linhaDaAusencia] = vigente ? await deps.db.select().from(ausencia).where(eq(ausencia.id, vigente.id)) : [];
    return responder(c, {
      usuario: { ...usuarioParaApi(u!, { criadoPorNome: (u!.criadoPorId && criadores.get(u!.criadoPorId)) || null, ausencia: vigente ?? undefined }), rankingAnonimo: u!.rankingAnonimo },
      ausencia: vigente && linhaDaAusencia
        ? { ...ausenciaDaPessoaParaApi(vigente), motivo: linhaDaAusencia.motivo, origem: linhaDaAusencia.origem, fimPedidoData: linhaDaAusencia.fimPedidoData, fimPedidoEm: linhaDaAusencia.fimPedidoEm }
        : null,
      equipe: e ? equipeParaApi(e) : null,
      equipesSupervisionadas: supervisionadas,
      /** As equipes que a pessoa representa agora (o supervisor está ausente ou parado, ou a equipe está sem supervisor); cada uma já entra em `equipesSupervisionadas`. */
      equipesRepresentadas: representadas.map((e) => {
        const motivo = emVigor.find((v) => v.equipeId === e.id)?.motivo ?? e.motivo ?? null;
        return {
          id: e.id,
          nome: e.nome,
          supervisorNome: motivo === "sem_supervisor" ? null : e.supervisorNome,
          desde: e.desde,
          motivo,
          rotulo: rotuloDoMotivo(motivo ?? "ausencia"),
        };
      }),
      /** As categorias de e-mail desligadas no perfil e se o servidor de e-mail está configurado (sem ele, os avisos ficam só no sino). */
      emails: { desligados: u!.emailsDesligados, servidorConfigurado: deps.email.configurado },
      /** Se os atos assinados passam pelo provedor de assinatura com validade jurídica, e se ele é o simulado (sem validade). */
      assinaturaJuridica: { ligada: deps.config.assinaturaJuridica.ligada, simulada: deps.config.assinaturaJuridica.provedor === "simulado" },
      /** A patente e os pontos da temporada para a barra superior; nulo para quem não joga (o admin). */
      gamificacao: await resumoParaMe(deps, eu),
    });
  });

  /**
   * Estado do Campo de treino (a web guarda aqui se a pessoa concluiu, pulou ou vai refazer). Idempotente; `nao_iniciado` serve para "refazer".
   * Também com a senha inicial e com o acesso pendente de liberação, como `GET /me`.
   */
  r.put("/me/treinamento", autenticar({ permitirSenhaProvisoria: true, permitirPendente: true }), async (c) => {
    const eu = c.get("usuario");
    const { estado } = await lerCorpo(c, z.object({ estado: z.enum(ESTADOS_TREINAMENTO) }));
    const agora = deps.agora();
    // Concluir o treino pontua o técnico (uma vez por conta), na mesma transação que grava o estado.
    const { u, ganhos } = await deps.db.transaction(async (transacao) => {
      const tx = transacao as unknown as Db;
      const [linha] = await tx
        .update(usuario)
        .set({ treinamentoEstado: estado, treinamentoEm: estado === "nao_iniciado" ? null : agora })
        .where(eq(usuario.id, eu.id))
        .returning();
      return { u: linha!, ganhos: estado === "concluido" && linha!.perfil === "tecnico" ? await pontuarTreinamento({ tx, agora }, eu.id, agora) : [] };
    });
    return responder(c, { treinamento: treinamentoParaApi(u), ...ganhosDe(ganhos, eu.id) });
  });

  /**
   * Refazer a assinatura vale para as próximas: as já feitas guardam o caminho da imagem que usaram, e um arquivo
   * nunca é sobrescrito, então elas não mudam.
   */
  r.put("/me/assinatura", autenticar({ permitirSemAssinatura: true }), async (c) => {
    const eu = c.get("usuario");
    const { arquivo_id } = await lerCorpo(c, z.object({ arquivo_id: uuid }));
    if (!(await deps.armazenamento.existe("assinaturas", arquivo_id))) {
      throw invalido("arquivo_inexistente", "Envie a imagem da assinatura antes (PUT /arquivos/{id})");
    }
    const agora = deps.agora();
    // Cadastrar a assinatura pontua o técnico uma vez por conta (refazer não pontua de novo).
    const ganhos = await deps.db.transaction(async (transacao) => {
      const tx = transacao as unknown as Db;
      await tx.update(usuario).set({ assinaturaPath: arquivo_id, assinaturaEm: agora }).where(eq(usuario.id, eu.id));
      return eu.perfil === "tecnico" ? pontuarAssinatura({ tx, agora }, eu.id, agora) : [];
    });
    return responder(c, { assinaturaPath: arquivo_id, ...ganhosDe(ganhos, eu.id) });
  });

  /** Quem não quer aparecer pelo nome no ranking da gamificação: os outros veem "Participante anônimo", e os pontos continuam valendo. */
  r.put("/me/ranking-anonimo", autenticar(), async (c) => {
    const eu = c.get("usuario");
    if (eu.perfil !== "tecnico") throw proibido("O administrador não joga e não aparece no ranking");
    const { anonimo } = await lerCorpo(c, z.object({ anonimo: z.boolean() }));
    await deps.db.update(usuario).set({ rankingAnonimo: anonimo }).where(eq(usuario.id, eu.id));
    return responder(c, { rankingAnonimo: anonimo });
  });

  /**
   * As categorias de e-mail que a pessoa não quer receber (`shared/notificacoes/avisos.ts`). As obrigatórias (segurança e conta)
   * não desligam (`422 categoria_obrigatoria`). O aviso continua no sino. Também para quem aguarda a liberação e para o ausente:
   * é uma preferência da própria pessoa, como a senha.
   */
  r.put("/me/emails", autenticar({ permitirPendente: true, permitirAusente: true }), async (c) => {
    const eu = c.get("usuario");
    const { desligados } = await lerCorpo(c, z.object({ desligados: z.array(z.enum(CATEGORIAS_DE_EMAIL)).max(CATEGORIAS_DE_EMAIL.length) }));
    const obrigatoria = desligados.find((d) => ehCategoriaObrigatoria(d));
    if (obrigatoria) throw invalido("categoria_obrigatoria", `Os e-mails de "${ROTULO_DA_CATEGORIA[obrigatoria]}" são obrigatórios e não podem ser desligados`);
    const unicos = CATEGORIAS_DE_EMAIL.filter((c) => desligados.includes(c));
    await deps.db.update(usuario).set({ emailsDesligados: unicos }).where(eq(usuario.id, eu.id));
    return responder(c, { desligados: unicos });
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

  /**
   * Os pedidos que participantes fizeram a quem pergunta, o responsável pela execução (encerrar a OS ou suspender por um motivo comum):
   * ele tem 2 minutos para aceitar ou recusar, e a tela mostra a faixa "[nome] pediu para encerrar — 1:42" com o que vem daqui. Fecha
   * antes os que já venceram (aprovados sozinhos). `restante_ms` é o que falta no relógio da `api`.
   */
  r.get("/me/pedidos-abertos", autenticar(), async (c) => {
    const eu = c.get("usuario");
    const agora = deps.agora();
    await fecharPedidosVencidos(deps.db, agora);
    const linhas = await deps.db
      .select({
        id: execucaoPedido.id,
        execucaoId: execucaoPedido.execucaoId,
        osId: execucao.osId,
        numeroOrdem: os.numeroOrdem,
        titulo: os.titulo,
        tipo: execucaoPedido.tipo,
        solicitanteId: execucaoPedido.solicitanteId,
        solicitanteNome: usuario.nome,
        motivo: execucaoPedido.motivo,
        complemento: execucaoPedido.complemento,
        criadoEm: execucaoPedido.criadoEm,
        expiraEm: execucaoPedido.expiraEm,
      })
      .from(execucaoPedido)
      .innerJoin(execucao, eq(execucao.id, execucaoPedido.execucaoId))
      .innerJoin(os, eq(os.id, execucao.osId))
      .innerJoin(usuario, eq(usuario.id, execucaoPedido.solicitanteId))
      .where(and(eq(execucao.executorId, eu.id), eq(execucaoPedido.estado, "aberto")))
      .orderBy(execucaoPedido.criadoEm);
    return responder(c, {
      pedidos: linhas.map(({ solicitanteId, solicitanteNome, ...l }) => ({ ...l, solicitante: { id: solicitanteId, nome: solicitanteNome }, restanteMs: Math.max(0, l.expiraEm.getTime() - agora.getTime()) })),
    });
  });

  /**
   * As APRs aprovadas de hoje que esperam a assinatura de quem pergunta: cada participante assina na própria conta, e a execução só
   * começa quando todos assinaram. A tela do técnico mostra a faixa "APR aguardando a sua assinatura" com o que vem daqui.
   */
  r.get("/me/aprs-para-assinar", autenticar(), async (c) => {
    return responder(c, { aprs: await aprsParaAssinar(deps.db, c.get("usuario").id, deps.agora()) });
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
