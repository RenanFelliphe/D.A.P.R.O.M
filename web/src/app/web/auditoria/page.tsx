import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Screen } from "@/components/ui/Screen";
import { TabelaAuditoria } from "@/components/web/auditoria/TabelaAuditoria";
import { entidadesDaAuditoria, type RegistroDeAuditoria } from "@/data/auditoria";
import { api, usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import { ehAdmin, type Paginacao } from "@/lib/tipos";

export const metadata: Metadata = { title: "Auditoria" };

const um = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);
const TAMANHO = 50;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Auditoria: quem fez o quê e quando nas telas de gestão (cadastros, modelos, importações, baixa no SAP). Só o administrador. */
export default async function AuditoriaPage({ searchParams }: PageProps<"/web/auditoria">) {
  const { usuario } = await usuarioAtual();
  if (!ehAdmin(usuario)) redirect(rotas.app.lista);

  const params = await searchParams;
  const entidade = um(params.entidade);
  const de = um(params.de);
  const ate = um(params.ate);
  const filtros = {
    busca: um(params.busca)?.trim() || undefined,
    entidade: entidadesDaAuditoria.some((e) => e.valor === entidade) ? entidade : undefined,
    de: de && DIA.test(de) ? de : undefined,
    ate: ate && DIA.test(ate) ? ate : undefined,
  };
  const pagina = Math.max(1, Number.parseInt(um(params.pagina) ?? "1", 10) || 1);

  const lista = await api<{ registros: RegistroDeAuditoria[] } & Paginacao>("/auditoria", { consulta: { ...filtros, pagina, tamanho: TAMANHO } });

  return (
    <Screen>
      <div className="stack g4">
        <h1>Auditoria</h1>
        <span className="muted">Quem fez o quê e quando nas telas de gestão. Os registros só são acrescentados: ninguém os altera nem apaga.</span>
      </div>
      <TabelaAuditoria registros={lista.registros} filtros={filtros} pagina={lista.pagina} tamanho={lista.tamanho} total={lista.total} />
    </Screen>
  );
}
