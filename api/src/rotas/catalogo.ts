import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import { MATERIAL_CATEGORIAS } from "../db/schema";
import { diferencas, registrarAuditoria } from "../dominio/auditoria";
import { avisarListaAtualizada } from "../dominio/sugestao-materiais";
import {
  criarMaterial,
  editarMaterial,
  esquemaMaterial,
  esquemaMateriaisDoServico,
  excluirMaterial,
  listarMateriais,
  listarServicos,
  salvarMateriaisDoServico,
  servicoDaAtividade,
} from "../dominio/catalogo";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { naoEncontrado } from "../http/erros";
import { esquemaPaginacao, meta } from "../http/paginacao";
import { responder } from "../http/resposta";
import { booleanoDaConsulta, lerConsulta, lerCorpo, lerId, uuid } from "../http/validacao";

/** O código da atividade na URL (pode ter pontos e barras: `8.7.2/8.7.3`), como em `/atividades/{codigo}`. */
function codigoDoServico(bruto: string) {
  const codigo = bruto.trim();
  if (!codigo || codigo.length > 200) throw naoEncontrado("Serviço não encontrado");
  return codigo;
}

/**
 * Catálogo de serviço: os materiais, ferramentas e EPIs (`/catalogo/materiais`) e a lista que cada serviço usa
 * (`/catalogo/servicos`; o serviço é a atividade do plano de manutenção). Todo perfil autenticado lê; só o admin escreve.
 */
export function rotasCatalogo(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();
  const soAdmin = exigirPerfil("admin");

  // ---- Materiais -------------------------------------------------------------------------------------------------

  r.get("/catalogo/materiais", autenticar(), async (c) => {
    const filtros = lerConsulta(
      c,
      esquemaPaginacao.extend({
        busca: z.string().trim().min(1).optional(),
        categoria: z.enum(MATERIAL_CATEGORIAS).optional(),
        ativo: booleanoDaConsulta,
      }),
    );
    const { materiais, total } = await listarMateriais(deps.db, filtros);
    return responder(c, { materiais, ...meta(filtros, total) });
  });

  r.post("/catalogo/materiais", autenticar(), soAdmin, async (c) => {
    const dados = await lerCorpo(c, esquemaMaterial);
    const criado = await criarMaterial(deps.db, dados);
    await registrarAuditoria(deps.db, c.get("usuario"), {
      entidade: "material",
      verbo: "criar",
      entidadeId: criado.id,
      alvo: criado.descricao,
      resumo: `Cadastrou o material "${criado.descricao}" (${criado.unidade})`,
      detalhes: { codigo: criado.codigo, unidade: criado.unidade, categoria: criado.categoria },
    });
    return responder(c, criado, 201);
  });

  r.put("/catalogo/materiais/:id", autenticar(), soAdmin, async (c) => {
    const id = lerId(c);
    const dados = await lerCorpo(c, esquemaMaterial);
    const { anterior, salvo } = await editarMaterial(deps.db, id, dados);
    const mudancas = diferencas(
      { codigo: anterior.codigo, descricao: anterior.descricao, unidade: anterior.unidade, categoria: anterior.categoria, ativo: anterior.ativo },
      { codigo: salvo.codigo, descricao: salvo.descricao, unidade: salvo.unidade, categoria: salvo.categoria, ativo: salvo.ativo },
    );
    if (Object.keys(mudancas).length > 0) {
      const soAtivo = Object.keys(mudancas).length === 1 && "ativo" in mudancas;
      await registrarAuditoria(deps.db, c.get("usuario"), {
        entidade: "material",
        verbo: soAtivo ? (salvo.ativo ? "ativar" : "desativar") : "editar",
        entidadeId: id,
        alvo: salvo.descricao,
        resumo: soAtivo
          ? `${salvo.ativo ? "Reativou" : "Desativou"} o material "${salvo.descricao}"`
          : `Editou o material "${salvo.descricao}" (${Object.keys(mudancas).join(", ")})`,
        detalhes: mudancas,
      });
    }
    return responder(c, salvo);
  });

  r.delete("/catalogo/materiais/:id", autenticar(), soAdmin, async (c) => {
    const id = lerId(c);
    const excluido = await excluirMaterial(deps.db, id);
    await registrarAuditoria(deps.db, c.get("usuario"), {
      entidade: "material",
      verbo: "excluir",
      entidadeId: id,
      alvo: excluido.descricao,
      resumo: `Excluiu o material "${excluido.descricao}"`,
      detalhes: { codigo: excluido.codigo },
    });
    return responder(c, {});
  });

  // ---- Serviços --------------------------------------------------------------------------------------------------

  r.get("/catalogo/servicos", autenticar(), async (c) => {
    const filtros = lerConsulta(
      c,
      esquemaPaginacao.extend({
        busca: z.string().trim().min(1).optional(),
        sem_materiais: booleanoDaConsulta,
        material_id: uuid.optional(),
      }),
    );
    const { servicos, total } = await listarServicos(deps.db, filtros);
    return responder(c, { servicos, ...meta(filtros, total) });
  });

  r.get("/catalogo/servicos/:codigo{.+}", autenticar(), async (c) => {
    const servico = await servicoDaAtividade(deps.db, codigoDoServico(c.req.param("codigo")));
    if (!servico) throw naoEncontrado("Serviço não encontrado");
    return responder(c, servico);
  });

  /** Troca a lista de materiais do serviço pela enviada (`{materiais: [{material_id, quantidade?, observacao?}]}`, na ordem). */
  r.put("/catalogo/servicos/:codigo{.+}", autenticar(), soAdmin, async (c) => {
    const codigo = codigoDoServico(c.req.param("codigo"));
    const dados = await lerCorpo(c, esquemaMateriaisDoServico);
    const { servico, mudou, antes, depois, itensAntes, itensDepois } = await salvarMateriaisDoServico(deps.db, codigo, dados);
    if (mudou) {
      // Todos os que fazem o serviço sabem que a lista mudou (o admin que mexeu já sabe).
      await avisarListaAtualizada(deps.db, { codigo, antes: itensAntes, depois: itensDepois, excluir: [c.get("usuario").id], agora: deps.agora() });
      await registrarAuditoria(deps.db, c.get("usuario"), {
        entidade: "atividade",
        verbo: "materiais",
        entidadeId: codigo,
        alvo: codigo,
        resumo: depois.length === 0 ? `Tirou todos os materiais do serviço ${codigo}` : `Atualizou os materiais do serviço ${codigo} (${depois.length} item(ns))`,
        detalhes: { materiais: { de: antes, para: depois } },
      });
    }
    const completo = await servicoDaAtividade(deps.db, codigo);
    return responder(c, completo ?? servico);
  });

  return r;
}
