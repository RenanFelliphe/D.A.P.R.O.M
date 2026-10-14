import { Hono, type Context } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import {
  criarConquista,
  criarPatente,
  editarConquista,
  editarPatente,
  editarRegra,
  esquemaEdicaoDaConquista,
  esquemaEdicaoDaPatente,
  esquemaRegra,
  excluirConquista,
  excluirPatente,
  trocarImagemDaConquista,
  trocarImagemDaEquipeDaPatente,
  trocarImagemDaPatente,
} from "../dominio/gamificacao-cadastros";
import {
  escopoDoRanking,
  extratoDaPessoa,
  listarConquistas,
  listarPatentes,
  listarRegras,
  marcarAvisosVistos,
  montarRanking,
  painelDaPessoa,
  perfilDaEquipe,
  perfilDaPessoa,
  temporadasParaApi,
} from "../dominio/gamificacao-leituras";
import { codigoDaTemporada } from "../dominio/temporadas";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { invalido } from "../http/erros";
import { esquemaPaginacao, limiteEDeslocamento, meta } from "../http/paginacao";
import { responder } from "../http/resposta";
import { lerConsulta, lerCorpo, lerId } from "../http/validacao";

/** O corpo `multipart/form-data` do envio de imagens: os campos de texto, o arquivo `imagem` e, nas patentes, a `imagem_equipe`. */
async function lerFormulario(c: Context) {
  const form = await c.req.parseBody().catch(() => null);
  if (!form) throw invalido("validacao", "Envie os dados como multipart/form-data");
  const { imagem, imagem_equipe: imagemEquipe, ...campos } = form;
  return { campos, imagem, imagemEquipe };
}

/**
 * Gamificação (`gameficacao.md`): "Minha pontuação", extrato, rankings de pessoas e equipes, temporadas, perfis, e os
 * cadastros do admin (tarefas, patentes e conquistas, com imagens). Todo perfil lê as páginas de consulta; quem não joga (o
 * admin) não tem pontuação própria. As rotas que geram pontos (`POST /eventos`, ciência, intervalo da preventiva, assinatura e
 * treino) devolvem `pontos_ganhos`.
 */
export function rotasGamificacao(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();
  const admin = exigirPerfil("admin");
  const joga = exigirPerfil("tecnico");

  // ---- Consulta ---------------------------------------------------------------------------------------------------

  /** Minha pontuação: patente, barra até a próxima, pontos, posições, conquistas com o progresso e os avisos pendentes. */
  r.get("/gamificacao/eu", autenticar(), joga, async (c) => responder(c, await painelDaPessoa(deps, c.get("usuario"))));

  /** O extrato da própria pessoa: `?temporada=2026-T4` (padrão: a de hoje) ou `?temporada=geral`. */
  r.get("/gamificacao/extrato", autenticar(), joga, async (c) => {
    const f = lerConsulta(c, esquemaPaginacao.extend({ temporada: z.string().optional() }));
    const { limit, offset } = limiteEDeslocamento(f);
    const escopo = f.temporada ?? codigoDaTemporada(deps.agora());
    const { total, pontos, lancamentos } = await extratoDaPessoa(deps, c.get("usuario"), escopo, limit, offset);
    return responder(c, { temporada: escopo, pontos, lancamentos, ...meta(f, total) });
  });

  /** O ranking: `?tipo=pessoas|equipes` e `?temporada=<codigo>|geral` (padrão: pessoas, na temporada de hoje). Os anônimos vão mascarados. */
  r.get("/gamificacao/ranking", autenticar(), async (c) => {
    const f = lerConsulta(c, z.object({ tipo: z.enum(["pessoas", "equipes"]).default("pessoas"), temporada: z.string().optional() }));
    return responder(c, await montarRanking(deps, c.get("usuario"), f.tipo, await escopoDoRanking(deps, f.temporada)));
  });

  /** A equipe na gamificação: soma, média, patente, posição, conquistas e os pontos de cada membro. */
  r.get("/gamificacao/equipes/:id", autenticar(), async (c) => responder(c, await perfilDaEquipe(deps, c.get("usuario"), lerId(c))));

  /** A pessoa na gamificação (o perfil dela): patente da temporada, maior patente e conquistas; o anônimo só aparece a si e ao admin. */
  r.get("/gamificacao/usuarios/:id", autenticar(), async (c) => responder(c, await perfilDaPessoa(deps, c.get("usuario"), lerId(c))));

  r.get("/gamificacao/temporadas", autenticar(), async (c) => responder(c, await temporadasParaApi(deps)));

  /** "Como pontuar": as tarefas com o valor de agora, as regras do jogo e o que não pontua. */
  r.get("/gamificacao/regras", autenticar(), async (c) => responder(c, await listarRegras(deps)));

  r.get("/gamificacao/patentes", autenticar(), async (c) => responder(c, await listarPatentes(deps, c.get("usuario"))));

  r.get("/gamificacao/conquistas", autenticar(), async (c) => responder(c, await listarConquistas(deps, c.get("usuario"))));

  /** Marca os avisos de conquista e de patente como vistos (a próxima abertura não os mostra de novo). */
  r.post("/gamificacao/avisos/vistos", autenticar(), joga, async (c) => {
    await marcarAvisosVistos(deps, c.get("usuario"));
    return responder(c, { ok: true });
  });

  // ---- Cadastros (admin) -------------------------------------------------------------------------------------------

  r.patch("/gamificacao/regras/:codigo", autenticar(), admin, async (c) => {
    return responder(c, await editarRegra(deps, c.get("usuario"), c.req.param("codigo"), await lerCorpo(c, esquemaRegra)));
  });

  r.post("/gamificacao/patentes", autenticar(), admin, async (c) => {
    const { campos, imagem, imagemEquipe } = await lerFormulario(c);
    return responder(c, await criarPatente(deps, c.get("usuario"), campos, imagem, imagemEquipe), 201);
  });

  r.patch("/gamificacao/patentes/:id", autenticar(), admin, async (c) => {
    return responder(c, await editarPatente(deps, c.get("usuario"), lerId(c), await lerCorpo(c, esquemaEdicaoDaPatente)));
  });

  r.put("/gamificacao/patentes/:id/imagem", autenticar(), admin, async (c) => {
    const { imagem } = await lerFormulario(c);
    return responder(c, await trocarImagemDaPatente(deps, c.get("usuario"), lerId(c), imagem));
  });

  /** A imagem da patente nas equipes (ranking de equipes e perfil da equipe): a das pessoas não muda. */
  r.put("/gamificacao/patentes/:id/imagem-equipe", autenticar(), admin, async (c) => {
    const { imagemEquipe } = await lerFormulario(c);
    return responder(c, await trocarImagemDaEquipeDaPatente(deps, c.get("usuario"), lerId(c), imagemEquipe));
  });

  r.delete("/gamificacao/patentes/:id", autenticar(), admin, async (c) => {
    await excluirPatente(deps, c.get("usuario"), lerId(c));
    return responder(c, { ok: true });
  });

  r.post("/gamificacao/conquistas", autenticar(), admin, async (c) => {
    const { campos, imagem } = await lerFormulario(c);
    return responder(c, await criarConquista(deps, c.get("usuario"), campos, imagem), 201);
  });

  r.patch("/gamificacao/conquistas/:id", autenticar(), admin, async (c) => {
    return responder(c, await editarConquista(deps, c.get("usuario"), lerId(c), await lerCorpo(c, esquemaEdicaoDaConquista)));
  });

  r.put("/gamificacao/conquistas/:id/imagem", autenticar(), admin, async (c) => {
    const { imagem } = await lerFormulario(c);
    return responder(c, await trocarImagemDaConquista(deps, c.get("usuario"), lerId(c), imagem));
  });

  r.delete("/gamificacao/conquistas/:id", autenticar(), admin, async (c) => {
    await excluirConquista(deps, c.get("usuario"), lerId(c));
    return responder(c, { ok: true });
  });

  return r;
}
