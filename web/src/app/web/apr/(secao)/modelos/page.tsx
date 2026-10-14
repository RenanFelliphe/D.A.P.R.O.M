import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { CartaoModelo } from "@/components/web/apr/CartaoModelo";
import { ModelosExcluidos } from "@/components/web/apr/ModelosExcluidos";
import { editaModelos } from "@/components/web/apr/secao";
import { Kpi } from "@/components/web/Panel";
import { agruparModelos, type ResumoModelo } from "@/data/modelos";
import { api, usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";

export const metadata: Metadata = { title: "Modelos de APR" };

/**
 * Aba Modelos: um cartão por modelo (versão em uso, rascunho e APRs), os totais e os modelos excluídos.
 * O supervisor lê; o administrador cria, edita e exclui.
 */
export default async function ModelosPage({ searchParams }: PageProps<"/web/apr/modelos">) {
  // Endereço antigo (`/web/modelos?codigo=APR 03`): abre o modelo.
  const pedido = (await searchParams).codigo;
  const codigo = Array.isArray(pedido) ? pedido[0] : pedido;
  if (codigo?.trim()) redirect(rotas.web.modelo(codigo.trim()));

  const { usuario } = await usuarioAtual();
  const podeEditar = editaModelos(usuario);
  const [ativos, arquivados] = await Promise.all([
    api<{ modelos: ResumoModelo[] }>("/modelos-apr", { consulta: { tamanho: 200 } }),
    api<{ modelos: ResumoModelo[] }>("/modelos-apr", { consulta: { arquivados: true, tamanho: 200 } }),
  ]);
  const grupos = agruparModelos(ativos.modelos);
  const excluidos = agruparModelos(arquivados.modelos);
  const emUso = grupos.filter((g) => g.emUso).length;
  const rascunhos = grupos.filter((g) => g.rascunho).length;
  const aprs = grupos.reduce((soma, g) => soma + g.aprsTotal, 0);

  return (
    <>
      <div className="row between wrap" style={{ alignItems: "flex-end" }}>
        <span className="muted" style={{ fontSize: 14, maxWidth: 820 }}>
          Cada modelo segue um documento de APR da Segurança do Trabalho. Editar cria o rascunho da próxima versão; ao publicar, ela passa a valer para as
          APRs novas, e as já preenchidas continuam ligadas à versão que usaram.
          {podeEditar ? "" : " Só o administrador altera os modelos."}
        </span>
        {podeEditar && (
          <LinkButton variant="p" sm href={rotas.web.novoModelo}>
            <Icon name="plus" size={16} />
            Novo modelo
          </LinkButton>
        )}
      </div>

      <div className="kpis k4">
        <Kpi label="Modelos em uso" value={emUso} sub="com versão publicada" />
        <Kpi
          label="Rascunhos"
          value={rascunhos}
          sub={rascunhos > 0 ? "aguardam publicação" : "nenhum pendente"}
          subStyle={rascunhos > 0 ? { color: "var(--al)", fontWeight: 500 } : undefined}
        />
        <Kpi label="APRs respondidas" value={aprs} sub="nos modelos em uso" />
        <Kpi label="Excluídos" value={excluidos.length} sub="guardados para o histórico" />
      </div>

      {grupos.length === 0 ? (
        <p className="muted">Nenhum modelo de APR cadastrado.</p>
      ) : (
        <div className="modelos-grade">
          {grupos.map((g) => (
            <CartaoModelo key={g.codigo} grupo={g} />
          ))}
        </div>
      )}

      {excluidos.length > 0 && <ModelosExcluidos grupos={excluidos} podeEditar={podeEditar} />}
    </>
  );
}
