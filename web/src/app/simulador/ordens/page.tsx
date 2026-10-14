import type { Metadata } from "next";
import { CartaoSincronizacaoSap, type LeituraSap, type SincronizacaoSap } from "@/components/simulador/ordens/CartaoSincronizacaoSap";
import { PainelOrdens } from "@/components/simulador/ordens/PainelOrdens";
import { rotuloDaSituacaoNoDaprom, type CatalogoDeOrdens, type ListaDeOrdens } from "@/components/simulador/ordens/tipos";
import { Kpi } from "@/components/web/Panel";
import { api } from "@/lib/api";
import type { Paginacao } from "@/lib/tipos";

export const metadata: Metadata = { title: "Simulador · Ordens do SAP" };

const um = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);
const TAMANHO = 50;
const TIPOS = ["YBA1", "YBA2"];
const SITUACOES = Object.keys(rotuloDaSituacaoNoDaprom);

/**
 * Ordens do SAP simulado: o CRUD do lado da empresa, com criação manual e aleatória e alteração em massa, para demonstrar como as OS
 * chegam ao DAPROM e como ele reage a cada mudança (a coluna "No DAPROM" e o cartão da sincronização). O DAPROM só lê estas ordens.
 */
export default async function SimuladorOrdensPage({ searchParams }: PageProps<"/simulador/ordens">) {
  const params = await searchParams;
  const tipo = um(params.tipo);
  const noDaprom = um(params.no_daprom);
  const filtros = {
    busca: um(params.busca)?.trim() || undefined,
    tipo: tipo && TIPOS.includes(tipo) ? tipo : undefined,
    centro_trabalho: um(params.centro_trabalho)?.trim() || undefined,
    no_daprom: noDaprom && SITUACOES.includes(noDaprom) ? noDaprom : undefined,
  };
  const pagina = Math.max(1, Number.parseInt(um(params.pagina) ?? "1", 10) || 1);

  const [lista, catalogo, sincronizacao, historico] = await Promise.all([
    api<ListaDeOrdens>("/sap-simulado/gestao/ordens", { consulta: { ...filtros, pagina, tamanho: TAMANHO } }),
    api<CatalogoDeOrdens>("/sap-simulado/gestao/catalogo"),
    api<SincronizacaoSap>("/sap/sincronizacao"),
    api<{ importacoes: LeituraSap[] } & Paginacao>("/importacoes", { consulta: { tamanho: 10 } }),
  ]);
  const ultimaLeitura = historico.importacoes.find((i) => i.origem === "api") ?? null;
  const c = lista.contagem;
  const naoLidasEIgnoradas = c.nao_lida + c.ignorada;
  const noDapromTotal = lista.total_geral - naoLidasEIgnoradas;

  return (
    <div className="stack g12">
      <div className="stack g4">
        <h1>Ordens do SAP</h1>
        <span className="muted" style={{ maxWidth: 780 }}>
          SAP simulado: o DAPROM só lê estas ordens (a cada leitura, nunca escreve). É aqui que se criam, editam, liberam, encerram e excluem ordens, e que se vê o DAPROM reagir. Dados fictícios.
        </span>
      </div>
      <div className="kpis k4">
        <Kpi label="Ordens" value={lista.total_geral} sub="no SAP" />
        <Kpi label="No DAPROM" marker={<i style={{ background: "var(--lib)" }} />} value={noDapromTotal} sub={`${c.liberada + c.pendente} liberadas ou pendentes · ${c.em_execucao} em execução`} />
        <Kpi label="Ignoradas" marker={<i style={{ background: "var(--al)" }} />} value={c.ignorada} sub="a leitura passou e não criou OS" />
        <Kpi label="Ainda não lidas" marker={<i style={{ background: "var(--ink4)" }} />} value={c.nao_lida} sub="esperam a próxima leitura" />
      </div>
      <CartaoSincronizacaoSap inicial={sincronizacao} ultimaLeitura={ultimaLeitura} />
      <PainelOrdens key={`${JSON.stringify(filtros)}|${lista.pagina}`} lista={lista} catalogo={catalogo} filtros={filtros} />
    </div>
  );
}

