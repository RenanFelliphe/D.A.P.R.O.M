import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import { OS_STATUS, OS_TIPOS } from "../db/schema";
import { resumoDasAprs } from "../dominio/apr-resumo";
import { registrarAuditoria, rotuloDaOs } from "../dominio/auditoria";
import { dashboardDeEquipes, dashboardDeOs, dashboardGeral } from "../dominio/dashboards";
import { exportarParaSap, MENSAGEM_SEM_NOVAS, nomeDoArquivo, TIPO_XLSX } from "../dominio/painel-exportacao";
import { mapaDeCalorOs } from "../dominio/mapa-calor";
import { equipeDoIndicador, historicoDoLocal, indicadoresDeTempo, indicadoresMensais } from "../dominio/painel-indicadores";
import { darCiencia, detalharOs, executoresDaOs, listarAprsDaOs, listarOs } from "../dominio/painel-os";
import { criarAviso } from "../dominio/alertas";
import { meusResultados } from "../dominio/meus-resultados";
import { escolhaDoModelo } from "../dominio/recomendacao-apr";
import { esquemaPeriodo } from "../dominio/periodo";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { esquemaPaginacao, meta } from "../http/paginacao";
import { responder } from "../http/resposta";
import { booleanoDaConsulta, lerConsulta, lerId, uuid } from "../http/validacao";

/** `AAAA-MM`, com mês de 01 a 12. */
const mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use o formato AAAA-MM");

/**
 * Painel de gestão: quadro e detalhe da OS, ciência do supervisor, indicadores, histórico por local e a planilha de
 * baixa do SAP. Quem não vê a equipe de uma OS recebe `404` ao abrir o detalhe, como se ela não existisse.
 */
export function rotasPainel(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();

  r.get("/os", autenticar(), async (c) => {
    const filtros = lerConsulta(
      c,
      esquemaPaginacao.extend({
        equipe_id: uuid.optional(),
        tipo: z.enum(OS_TIPOS).optional(),
        critica: booleanoDaConsulta,
        periodo: mes.optional(),
        status: z.enum(OS_STATUS).optional(),
        exportada: booleanoDaConsulta,
        numero_ordem: z.string().trim().min(1).optional(),
        busca: z.string().trim().min(1).optional(),
        ordem: z.enum(["prioridade", "data_limite"]).optional(),
      }),
    );
    const { itens, total, contagemPorStatus } = await listarOs(deps.db, c.get("usuario"), filtros, deps.agora());
    return responder(c, { os: itens, contagemPorStatus, ...meta(filtros, total) });
  });

  r.get("/os/mapa-calor", autenticar(), exigirPerfil("supervisor", "admin"), async (c) => {
    const filtros = lerConsulta(
      c,
      z.object({
        periodo: esquemaPeriodo,
        equipe_id: uuid.optional(),
        status: z.enum(OS_STATUS).optional(),
      }),
    );
    return responder(c, await mapaDeCalorOs(deps.db, c.get("usuario"), filtros, deps.agora()));
  });

  r.get("/os/:id", autenticar(), async (c) => {
    return responder(c, await detalharOs(deps.db, c.get("usuario"), lerId(c), deps.agora()));
  });

  /** Os modelos de APR para o técnico escolher, com a orientação de cada um e o recomendado pela leitura da OS. */
  r.get("/os/:id/modelos-apr", autenticar(), async (c) => {
    return responder(c, await escolhaDoModelo(deps.db, c.get("usuario"), lerId(c)));
  });

  r.get("/os/:id/aprs", autenticar(), async (c) => {
    return responder(c, { aprs: await listarAprsDaOs(deps.db, c.get("usuario"), lerId(c)) });
  });

  /** A assinatura final do supervisor (a "ciência"), depois de ler o relatório da execução: a OS passa de `aguardando_supervisor` a `encerrada`. */
  r.post("/os/:id/ciencia", autenticar(), exigirPerfil("supervisor"), async (c) => {
    const eu = c.get("usuario");
    const id = lerId(c);
    const agora = deps.agora();
    const resultado = await darCiencia(deps.db, eu, id, agora);
    const rotulo = await rotuloDaOs(deps.db, id);
    // Quem executou a OS fica sabendo que o supervisor assinou por último (o trabalho dele foi conferido e o PDF sai, com a assinatura).
    const executores = await executoresDaOs(deps.db, id);
    await criarAviso(
      deps.db,
      executores.filter((x) => x !== eu.id),
      { tipo: "os_ciencia", osId: id, detalhe: `${eu.nome} assinou como supervisor a ${rotulo}, que você executou: a OS está concluída e o PDF está sendo gerado.`, agora },
    );
    await registrarAuditoria(deps.db, eu, { entidade: "os", verbo: "ciencia", entidadeId: id, alvo: rotulo, resumo: `Assinou como supervisor a ${rotulo}` });
    return responder(c, resultado);
  });

  r.get("/indicadores", autenticar(), exigirPerfil("supervisor", "admin"), async (c) => {
    const f = lerConsulta(c, z.object({ mes, equipe_id: uuid.optional() }));
    return responder(c, await indicadoresMensais(deps.db, c.get("usuario"), f, deps.agora()));
  });

  r.get("/indicadores/tempo", autenticar(), exigirPerfil("supervisor", "admin"), async (c) => {
    const f = lerConsulta(c, z.object({ mes, equipe_id: uuid.optional(), usuario_id: uuid.optional() }));
    return responder(c, await indicadoresDeTempo(deps.db, c.get("usuario"), f));
  });

  // ---- Dashboards ---------------------------------------------------------------------------------------------------
  // Todos com o mesmo filtro: `?periodo=7d|30d|90d|12m|AAAA-MM` (30 dias se ausente) e `?equipe_id=`. Todo perfil vê o seu
  // escopo: o admin, todas as equipes; supervisor e técnico, as suas (pedir outra é `403`). Quem não supervisiona só recebe o
  // que é da equipe como um todo, nunca o desempenho de um colega (ver `acompanhaAEquipe`).

  const gestao = exigirPerfil("supervisor", "admin", "tecnico");
  const lerFiltro = (c: Parameters<typeof lerConsulta>[0]) => {
    const f = lerConsulta(c, z.object({ periodo: esquemaPeriodo, equipe_id: uuid.optional() }));
    return { periodo: f.periodo, equipeId: equipeDoIndicador(c.get("usuario"), f.equipe_id) };
  };

  /** Dashboard geral: a carteira de agora, o resumo do período e as pendências. */
  r.get("/indicadores/geral", autenticar(), gestao, async (c) => {
    return responder(c, await dashboardGeral(deps.db, c.get("usuario"), lerFiltro(c), deps.agora()));
  });

  /** Dashboard de OS: carteira, programadas e encerradas, preventivas, tempo, interrupções, reprogramações e locais. */
  r.get("/indicadores/os", autenticar(), gestao, async (c) => {
    return responder(c, await dashboardDeOs(deps.db, c.get("usuario"), lerFiltro(c), deps.agora()));
  });

  /** Meus resultados: o dashboard da própria pessoa (técnico e supervisor). O admin não executa OS e recebe `403`. */
  r.get("/indicadores/meus", autenticar(), exigirPerfil("tecnico"), async (c) => {
    const f = lerConsulta(c, z.object({ periodo: esquemaPeriodo }));
    return responder(c, await meusResultados(deps.db, c.get("usuario"), f, deps.agora()));
  });

  /** Dashboard de equipes e usuários: por equipe e por técnico (esses dois últimos só para quem acompanha a equipe); o estado do cadastro só para o admin. */
  r.get("/indicadores/equipes", autenticar(), gestao, async (c) => {
    const eu = c.get("usuario");
    return responder(c, await dashboardDeEquipes(deps.db, eu, { ...lerFiltro(c), comCadastro: eu.perfil === "admin" }, deps.agora()));
  });

  /**
   * Dashboard de APR: respondidas, aprovadas e bloqueadas por faixa, itens que mais bloqueiam, alertas mais registrados,
   * APRs por modelo e por equipe (a da OS).
   */
  r.get("/aprs/resumo", autenticar(), gestao, async (c) => {
    return responder(c, await resumoDasAprs(deps.db, c.get("usuario"), lerFiltro(c), deps.agora()));
  });

  r.get("/historico", autenticar(), async (c) => {
    const f = lerConsulta(c, esquemaPaginacao.extend({ local_instalacao_id: uuid, equipamento: z.string().trim().min(1).optional() }));
    const { itens, total } = await historicoDoLocal(deps.db, c.get("usuario"), f);
    return responder(c, { execucoes: itens, ...meta(f, total) });
  });

  /**
   * Sem OS nova em `Encerradas` e `Sem ordem SAP` a resposta continua `200` (não `204`, para o cliente sempre receber
   * um arquivo válido) com as abas só de cabeçalho — e `Impedimentos`, que não depende de exportação anterior —,
   * mais o cabeçalho `X-Mensagem` para a tela avisar.
   */
  r.post("/exportacoes/sap", autenticar(), exigirPerfil("admin"), async (c) => {
    const agora = deps.agora();
    const { planilha, novas } = await exportarParaSap(deps.db, deps.config.painelUrl, agora);
    const cabecalhos: Record<string, string> = {
      "Content-Type": TIPO_XLSX,
      "Content-Disposition": `attachment; filename="${nomeDoArquivo(agora)}"`,
    };
    if (novas === 0) cabecalhos["X-Mensagem"] = MENSAGEM_SEM_NOVAS;
    await registrarAuditoria(deps.db, c.get("usuario"), {
      entidade: "exportacao",
      verbo: "sap",
      alvo: nomeDoArquivo(agora),
      resumo: novas === 0 ? "Gerou a planilha de baixa do SAP (nenhuma OS nova)" : `Exportou a planilha de baixa do SAP com ${novas} OS encerradas`,
      detalhes: { os_exportadas: novas },
    });
    return c.body(new Uint8Array(planilha), 200, cabecalhos);
  });

  return r;
}
