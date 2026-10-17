import type { Metadata } from "next";
import { PainelFuncionarios } from "@/components/simulador/funcionarios/PainelFuncionarios";
import type { CatalogoDeFuncionarios, ListaDeFuncionarios } from "@/components/simulador/funcionarios/tipos";
import { Kpi } from "@/components/web/Panel";
import { CartaoRegistro, type SincronizacaoDoRegistro } from "@/components/web/usuarios/CartaoRegistro";
import { api } from "@/lib/api";
import type { Equipe } from "@/lib/tipos";

export const metadata: Metadata = { title: "Simulador · Funcionários" };

const um = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);
const TAMANHO = 50;

/**
 * Registro de funcionários simulado (RH): o CRUD do lado da empresa, com criação manual e aleatória e ações em massa, e o cartão da
 * sincronização com o SYNC OS. É daqui que se cria quem poderá virar usuário e que se desliga quem deve perder o acesso.
 */
export default async function SimuladorFuncionariosPage({ searchParams }: PageProps<"/simulador/funcionarios">) {
  const params = await searchParams;
  const busca = um(params.busca)?.trim() || undefined;
  const pagina = Math.max(1, Number.parseInt(um(params.pagina) ?? "1", 10) || 1);

  const [lista, catalogo, sincronizacao, equipes] = await Promise.all([
    api<ListaDeFuncionarios>("/rh-simulado/gestao/funcionarios", { consulta: { busca, pagina, tamanho: TAMANHO } }),
    api<CatalogoDeFuncionarios>("/rh-simulado/gestao/catalogo"),
    api<SincronizacaoDoRegistro>("/rh/sincronizacao"),
    api<{ equipes: Equipe[] }>("/equipes", { consulta: { tamanho: 200 } }),
  ]);
  const total = lista.contagem.ativo + lista.contagem.afastado + lista.contagem.desligado;

  return (
    <div className="stack g12">
      <div className="stack g4">
        <h1>Registro de funcionários</h1>
        <span className="muted" style={{ maxWidth: 780 }}>
          Sistema de RH simulado: o SYNC OS consulta este registro para cadastrar usuários e saber de desligamentos. Dados fictícios.
        </span>
      </div>
      <div className="kpis k4">
        <Kpi label="Funcionários" value={total} sub="no registro" />
        <Kpi label="Ativos" marker={<i style={{ background: "var(--enc)" }} />} value={lista.contagem.ativo} sub="podem ser cadastrados" />
        <Kpi label="Afastados" marker={<i style={{ background: "var(--al)" }} />} value={lista.contagem.afastado} sub="férias, licença" />
        <Kpi label="Desligados" marker={<i style={{ background: "var(--blq)" }} />} value={lista.contagem.desligado} sub="perdem o acesso no SYNC OS" />
      </div>
      <CartaoRegistro inicial={sincronizacao} titulo="Sincronização com o SYNC OS" />
      <PainelFuncionarios
        key={`${busca ?? ""}|${lista.pagina}`}
        lista={lista}
        catalogo={catalogo}
        busca={busca}
        nomesDeEquipe={Object.fromEntries(equipes.equipes.map((e) => [e.id, e.nome]))}
      />
    </div>
  );
}
