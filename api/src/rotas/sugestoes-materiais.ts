import { Hono } from "hono";
import type { Deps } from "../deps";
import { registrarAuditoria } from "../dominio/auditoria";
import { ganhosDe } from "../dominio/lancamentos";
import {
  aceitarSugestao,
  detalheDaSugestao,
  enviarSugestao,
  equipesDoServico,
  esquemaAceite,
  esquemaFiltrosDeSugestoes,
  esquemaNovaSugestao,
  esquemaRecusa,
  listarSugestoes,
  recusarSugestao,
  retirarSugestao,
  totalParaAvaliar,
} from "../dominio/sugestao-materiais";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { esquemaPaginacao, meta } from "../http/paginacao";
import { responder } from "../http/resposta";
import { lerConsulta, lerCorpo, lerId } from "../http/validacao";
import { textoObrigatorio } from "../http/validacao";
import { z } from "zod";

/**
 * Sugestão e contestação da lista de materiais de um serviço (`docs/operacao-de-campo.md`, seções 10.2 a 10.5). Todo perfil que não é
 * o administrador envia; quem avalia é o supervisor da equipe que mais faz o serviço (e o administrador). Todos leem, para a
 * colaboração ficar à vista.
 */
export function rotasSugestoesMateriais(deps: Deps, { autenticar }: Autenticacao) {
  const r = new Hono<Ambiente>();

  /** As equipes que fazem o serviço, da que mais faz para a que menos faz; a primeira é a responsável por avaliar. */
  r.get("/sugestoes-materiais/equipes", autenticar(), async (c) => {
    const { atividade } = lerConsulta(c, z.object({ atividade: textoObrigatorio.max(200) }));
    return responder(c, { equipes: await equipesDoServico(deps.db, atividade) });
  });

  /** O número do selo: quantas sugestões esperam a avaliação de quem pede. */
  r.get("/sugestoes-materiais/resumo", autenticar(), async (c) => responder(c, { para_avaliar: await totalParaAvaliar(deps.db, c.get("usuario")) }));

  r.get("/sugestoes-materiais", autenticar(), async (c) => {
    const filtros = lerConsulta(c, esquemaPaginacao.extend(esquemaFiltrosDeSugestoes.shape));
    const { sugestoes, total } = await listarSugestoes(deps.db, c.get("usuario"), filtros);
    return responder(c, { sugestoes, ...meta(filtros, total) });
  });

  r.post("/sugestoes-materiais", autenticar(), async (c) => {
    const eu = c.get("usuario");
    const dados = await lerCorpo(c, esquemaNovaSugestao);
    const { id } = await enviarSugestao(deps.db, eu, dados, deps.agora());
    return responder(c, await detalheDaSugestao(deps.db, eu, id), 201);
  });

  r.get("/sugestoes-materiais/:id", autenticar(), async (c) => responder(c, await detalheDaSugestao(deps.db, c.get("usuario"), lerId(c))));

  r.post("/sugestoes-materiais/:id/aceitar", autenticar(), async (c) => {
    const eu = c.get("usuario");
    const id = lerId(c);
    const dados = await lerCorpo(c, esquemaAceite);
    const { sugestao, ajustada, salvo, ganhos, pontosDoAutor } = await aceitarSugestao(deps.db, eu, id, dados, deps.agora());
    const codigo = sugestao.atividadeCodigo;
    await registrarAuditoria(deps.db, eu, {
      entidade: "sugestao_materiais",
      verbo: "aceitar",
      entidadeId: id,
      alvo: codigo,
      resumo: `Aceitou ${sugestao.tipo === "sugestao" ? "a sugestão" : "a contestação"} da lista de materiais do serviço ${codigo}${ajustada ? ", com ajustes" : ""}`,
      detalhes: { tipo: sugestao.tipo, ajustada, pontos_do_autor: pontosDoAutor },
    });
    if (salvo.mudou) {
      await registrarAuditoria(deps.db, eu, {
        entidade: "atividade",
        verbo: "materiais",
        entidadeId: codigo,
        alvo: codigo,
        resumo: salvo.depois.length === 0 ? `Tirou todos os materiais do serviço ${codigo}` : `Atualizou os materiais do serviço ${codigo} (${salvo.depois.length} item(ns)), por sugestão aceita`,
        detalhes: { materiais: { de: salvo.antes, para: salvo.depois }, sugestao_id: id },
      });
    }
    return responder(c, { ...(await detalheDaSugestao(deps.db, eu, id)), ...ganhosDe(ganhos, eu.id), lista_mudou: salvo.mudou });
  });

  r.post("/sugestoes-materiais/:id/recusar", autenticar(), async (c) => {
    const eu = c.get("usuario");
    const id = lerId(c);
    const { resposta } = await lerCorpo(c, esquemaRecusa);
    const { sugestao, ganhos } = await recusarSugestao(deps.db, eu, id, resposta, deps.agora());
    await registrarAuditoria(deps.db, eu, {
      entidade: "sugestao_materiais",
      verbo: "recusar",
      entidadeId: id,
      alvo: sugestao.atividadeCodigo,
      resumo: `Recusou ${sugestao.tipo === "sugestao" ? "a sugestão" : "a contestação"} da lista de materiais do serviço ${sugestao.atividadeCodigo}`,
      detalhes: { tipo: sugestao.tipo, resposta },
    });
    return responder(c, { ...(await detalheDaSugestao(deps.db, eu, id)), ...ganhosDe(ganhos, eu.id) });
  });

  r.post("/sugestoes-materiais/:id/retirar", autenticar(), async (c) => {
    const eu = c.get("usuario");
    const id = lerId(c);
    await retirarSugestao(deps.db, eu, id);
    return responder(c, await detalheDaSugestao(deps.db, eu, id));
  });

  return r;
}
