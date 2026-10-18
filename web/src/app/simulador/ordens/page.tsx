import type { Metadata } from "next";
import { CartaoSincronizacaoSap, type LeituraSap, type SincronizacaoSap } from "@/components/simulador/ordens/CartaoSincronizacaoSap";
import { PainelOrdens } from "@/components/simulador/ordens/PainelOrdens";
import { rotuloDaSituacaoNoSynqOs, type CatalogoDeOrdens, type ListaDeOrdens } from "@/components/simulador/ordens/tipos";
import { Kpi } from "@/components/web/Panel";
import { api } from "@/lib/api";
import type { Paginacao } from "@/lib/tipos";

export const metadata: Metadata = { title: "Simulador · Ordens do SAP" };

const um = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);
const TAMANHO = 50;
const TIPOS = ["YBA1", "YBA2"];
const SITUACOES = Object.keys(rotuloDaSituacaoNoSynqOs);

/**
 * Ordens do SAP simulado: o CRUD do lado da empresa, com criação manual e aleatória e alteração em massa, para demonstrar como as OS
 * chegam ao SYNQ OS e como ele reage a cada mudança (a coluna "No SYNQ OS" e o cartão da sincronização). O SYNQ OS só lê estas ordens.
 */
export default async function SimuladorOrdensPage({ searchParams }: PageProps<"/simulador/ordens">) {
  const params = await searchParams;
  const tipo = um(params.tipo);
  const noSynqOs = um(params.no_synq_os);
  const filtros = {
    busca: um(params.busca)?.trim() || undefined,
    tipo: tipo && TIPOS.includes(tipo) ? tipo : undefined,
    centro_trabalho: um(params.centro_trabalho)?.trim() || undefined,
    no_synq_os: noSynqOs && SITUACOES.includes(noSynqOs) ? noSynqOs : undefined,
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
  const noSynqOsTotal = lista.total_geral - naoLidasEIgnoradas;

  return (
    <div className="stack g12">
      <div className="stack g4">
        <h1>Ordens do SAP</h1>
        <span className="muted" style={{ maxWidth: 780 }}>
          SAP simulado: o SYNQ OS só lê estas ordens (a cada leitura, nunca escreve). É aqui que se criam, editam, liberam, encerram e excluem ordens, e que se vê o SYNQ OS reagir. Dados fictícios.
        </span>
      </div>
      <div className="kpis k4">
        <Kpi label="Ordens" value={lista.total_geral} sub="no SAP" />
        <Kpi label="No SYNQ OS" marker={<i style={{ background: "var(--lib)" }} />} value={noSynqOsTotal} sub={`${c.liberada + c.pendente} liberadas ou pendentes · ${c.em_execucao + c.encerrando + c.aguardando_supervisor} em execução ou aguardando assinaturas`} />
        <Kpi label="Ignoradas" marker={<i style={{ background: "var(--al)" }} />} value={c.ignorada} sub="a leitura passou e não criou OS" />
        <Kpi label="Ainda não lidas" marker={<i style={{ background: "var(--ink4)" }} />} value={c.nao_lida} sub="esperam a próxima leitura" />
      </div>
      <CartaoSincronizacaoSap inicial={sincronizacao} ultimaLeitura={ultimaLeitura} />
      <PainelOrdens key={`${JSON.stringify(filtros)}|${lista.pagina}`} lista={lista} catalogo={catalogo} filtros={filtros} />
    </div>
  );
}

