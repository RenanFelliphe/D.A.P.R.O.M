"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BarraAcoesEmMassa } from "@/components/simulador/BarraAcoesEmMassa";
import { BotaoComMenu } from "@/components/simulador/BotaoComMenu";
import { TabelaSelecionavel, type ColunaDaTabela } from "@/components/simulador/TabelaSelecionavel";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MenuAcoes } from "@/components/ui/MenuAcoes";
import { Notice } from "@/components/ui/Notice";
import { JanelaModal } from "@/components/web/JanelaModal";
import { Panel } from "@/components/web/Panel";
import { PaginacaoLista } from "@/components/web/PaginacaoLista";
import { chamar } from "@/lib/cliente-api";
import { dataDoDia } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { useToast } from "@/state/toast";
import { FormularioOrdem } from "./FormularioOrdem";
import { FormularioOrdensAleatorias } from "./FormularioOrdensAleatorias";
import { JanelaEmMassaOrdens, type FiltrosDaBusca } from "./JanelaEmMassaOrdens";
import { rotuloDaSituacaoNoSyncOs, type AcaoEmMassaDeOrdens, type CatalogoDeOrdens, type ListaDeOrdens, type Ordem, type SituacaoNoSyncOs } from "./tipos";
import { VerMaisOrdem } from "./VerMaisOrdem";

type Janela = { tipo: "manual" } | { tipo: "aleatorio" } | { tipo: "editar"; o: Ordem } | { tipo: "excluir"; o: Ordem } | { tipo: "ver"; o: Ordem } | { tipo: "massa"; acao: AcaoEmMassaDeOrdens } | null;

const tonsDaSituacao: Record<SituacaoNoSyncOs, BadgeTone> = { nao_lida: "neu", ignorada: "al", liberada: "lib", pendente: "al", em_execucao: "exe", encerrada: "enc", cancelada: "blq", devolvida: "neu" };

interface PainelOrdensProps {
  lista: ListaDeOrdens;
  catalogo: CatalogoDeOrdens;
  filtros: FiltrosDaBusca;
}

/**
 * A tabela do simulador do SAP: busca e filtros (tipo, centro de trabalho e "No SYNC OS"), "Nova ordem" (manual ou aleatória), seleção com
 * ações em massa (mudar status, mudar centro, reprogramar e excluir), "ver mais", editar e excluir. A coluna "No SYNC OS" mostra como o
 * SYNC OS reagiu a cada ordem, e o selo "Alterada depois da última leitura" mostra o que ele vai pegar na próxima.
 */
export function PainelOrdens({ lista, catalogo, filtros }: PainelOrdensProps) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [janela, setJanela] = useState<Janela>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [todosDaBusca, setTodosDaBusca] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const daPagina = lista.ordens;
  const marcadosNaPagina = daPagina.filter((o) => selecionados.has(o.numero_ordem)).length;
  const quantidade = todosDaBusca ? lista.total : selecionados.size;
  const consulta = { ...filtros };

  function limparSelecao() {
    setSelecionados(new Set());
    setTodosDaBusca(false);
  }

  function fechar(concluiu = false) {
    setJanela(null);
    setErro(null);
    if (concluiu) limparSelecao();
  }

  async function excluir(o: Ordem) {
    setOcupado(true);
    setErro(null);
    try {
      await chamar("DELETE", `/sap-simulado/gestao/ordens/${encodeURIComponent(o.numero_ordem)}`);
      exibirAviso(`A ordem ${o.numero_ordem} foi excluída.`);
      fechar();
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir a ordem");
    } finally {
      setOcupado(false);
    }
  }

  const noSyncOs = (o: Ordem) => o.no_sync_os.situacao !== "nao_lida" && o.no_sync_os.situacao !== "ignorada";
  const centroPorCodigo = new Map(catalogo.centros_de_trabalho.map((c) => [c.centro_trabalho, c.nome]));

  const colunas: ColunaDaTabela<Ordem>[] = [
    { titulo: "Ordem", largura: 100, className: "mono", render: (o) => o.numero_ordem },
    {
      titulo: "Título",
      render: (o) => (
        <span className="stack g4" style={{ alignItems: "flex-start" }}>
          <b>{o.titulo}</b>
          {o.alterada_depois_da_leitura && (
            <Badge tone="brand" style={{ padding: "1px 8px", fontSize: 11 }}>
              Alterada depois da última leitura
            </Badge>
          )}
        </span>
      ),
    },
    { titulo: "Tipo", largura: 90, render: (o) => (o.tipo_ordem === "YBA1" ? "Corretiva" : "Preventiva") },
    { titulo: "Centro de trabalho", render: (o) => <span title={centroPorCodigo.get(o.centro_trabalho)}>{o.centro_trabalho}</span> },
    { titulo: "Início", largura: 100, render: (o) => dataDoDia(o.data_inicio_prog) },
    { titulo: "Status SAP", render: (o) => <span className="mono">{o.status_sap ?? "—"}</span> },
    {
      titulo: "No SYNC OS",
      render: (o) => (
        <span className="stack g4" style={{ alignItems: "flex-start" }}>
          <Badge tone={tonsDaSituacao[o.no_sync_os.situacao]} style={{ padding: "1px 8px", fontSize: 11 }}>
            {rotuloDaSituacaoNoSyncOs[o.no_sync_os.situacao]}
          </Badge>
          {o.no_sync_os.motivo && <span className="small" style={{ whiteSpace: "normal", maxWidth: 220 }}>{o.no_sync_os.motivo}</span>}
        </span>
      ),
    },
    {
      titulo: "Mais",
      largura: 80,
      render: (o) => (
        <button type="button" className="sim-link" onClick={() => setJanela({ tipo: "ver", o })}>
          Ver mais
        </button>
      ),
    },
  ];

  return (
    <Panel>
      <div className="row between wrap">
        <h2>Ordens · {lista.total}</h2>
        <BotaoComMenu
          rotulo="Nova ordem"
          opcoes={[
            { rotulo: "Manual", descricao: "Preencher todos os campos", aoClicar: () => setJanela({ tipo: "manual" }) },
            { rotulo: "Aleatória", descricao: "Gerar várias de uma vez, por tipo e centro", aoClicar: () => setJanela({ tipo: "aleatorio" }) },
          ]}
        />
      </div>

      <form method="get" action={rotas.simulador.ordens} className="filtros-lista">
        <div className="field">
          <label htmlFor="f-busca">Busca</label>
          <input id="f-busca" name="busca" type="search" className="input" placeholder="Número, título, equipamento ou local" defaultValue={filtros.busca ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="f-tipo">Tipo</label>
          <select id="f-tipo" name="tipo" className="select" defaultValue={filtros.tipo ?? ""}>
            <option value="">Todos</option>
            <option value="YBA1">Corretiva (YBA1)</option>
            <option value="YBA2">Preventiva (YBA2)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-centro">Centro de trabalho</label>
          <select id="f-centro" name="centro_trabalho" className="select" defaultValue={filtros.centro_trabalho ?? ""}>
            <option value="">Todos</option>
            {catalogo.centros_de_trabalho.map((c) => (
              <option key={c.centro_trabalho} value={c.centro_trabalho}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-no-sync-os">No SYNC OS</label>
          <select id="f-no-sync-os" name="no_sync_os" className="select" defaultValue={filtros.no_sync_os ?? ""}>
            <option value="">Todas</option>
            {(Object.keys(rotuloDaSituacaoNoSyncOs) as SituacaoNoSyncOs[]).map((s) => (
              <option key={s} value={s}>
                {rotuloDaSituacaoNoSyncOs[s]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-line btn-sm" style={{ height: 36 }}>
          Filtrar
        </button>
      </form>

      <BarraAcoesEmMassa
        quantidade={quantidade}
        rotulo="ordens"
        totalDaBusca={lista.total}
        marcadosNaPagina={marcadosNaPagina}
        tamanhoDaPagina={daPagina.length}
        todosDaBusca={todosDaBusca}
        aoSelecionarTodosDaBusca={() => setTodosDaBusca(true)}
        aoLimpar={limparSelecao}
      >
        <Button variant="line" sm onClick={() => setJanela({ tipo: "massa", acao: "mudar_status" })}>
          Mudar status SAP
        </Button>
        <Button variant="line" sm onClick={() => setJanela({ tipo: "massa", acao: "mudar_centro" })}>
          Mudar centro de trabalho
        </Button>
        <Button variant="line" sm onClick={() => setJanela({ tipo: "massa", acao: "reprogramar" })}>
          Reprogramar
        </Button>
        <Button variant="d" sm onClick={() => setJanela({ tipo: "massa", acao: "excluir" })}>
          Excluir
        </Button>
      </BarraAcoesEmMassa>

      <TabelaSelecionavel
        legenda="Ordens do SAP simulado"
        rotuloDoItem="ordem"
        linhas={daPagina}
        idDe={(o) => o.numero_ordem}
        colunas={colunas}
        selecionados={selecionados}
        aoAlterarSelecao={(s) => {
          setSelecionados(s);
          setTodosDaBusca(false);
        }}
        vazio={lista.total_geral === 0 ? "Não há ordens. Crie pelo botão acima." : "Nenhuma ordem encontrada para esta busca."}
        acoesDaLinha={(o) => (
          <span style={{ display: "inline-flex", justifyContent: "flex-end" }}>
            <MenuAcoes
              rotulo={`Ações da ordem ${o.numero_ordem}`}
              itens={[
                { rotulo: "Editar", aoClicar: () => setJanela({ tipo: "editar", o }) },
                { rotulo: noSyncOs(o) ? "Excluir (já no SYNC OS)" : "Excluir", aoClicar: () => setJanela({ tipo: "excluir", o }), perigo: true, desabilitado: noSyncOs(o) },
              ]}
            />
          </span>
        )}
      />

      <PaginacaoLista caminho={rotas.simulador.ordens} consulta={consulta} pagina={lista.pagina} tamanho={lista.tamanho} total={lista.total} />

      {janela?.tipo === "manual" && (
        <JanelaModal titulo="Nova ordem" aoFechar={() => fechar()} className="dlg-larga">
          <FormularioOrdem catalogo={catalogo} aoConcluir={() => fechar()} />
        </JanelaModal>
      )}
      {janela?.tipo === "aleatorio" && (
        <JanelaModal titulo="Novas ordens aleatórias" aoFechar={() => fechar()} className="dlg-larga">
          <FormularioOrdensAleatorias catalogo={catalogo} aoConcluir={() => fechar()} />
        </JanelaModal>
      )}
      {janela?.tipo === "editar" && (
        <JanelaModal titulo={`Editar a ordem ${janela.o.numero_ordem}`} aoFechar={() => fechar()} className="dlg-larga">
          <FormularioOrdem ordem={janela.o} catalogo={catalogo} aoConcluir={() => fechar()} />
        </JanelaModal>
      )}
      {janela?.tipo === "ver" && <VerMaisOrdem ordem={janela.o} catalogo={catalogo} aoFechar={() => fechar()} />}
      {janela?.tipo === "excluir" && (
        <JanelaModal titulo="Excluir ordem" aoFechar={() => fechar()}>
          <p style={{ fontSize: 14 }}>
            Excluir a ordem <b>{janela.o.numero_ordem}</b> ({janela.o.titulo}) do SAP? Não dá para desfazer.
          </p>
          {erro && (
            <Notice tone="blq" icon="alert">
              {erro}
            </Notice>
          )}
          <div className="row g8" style={{ justifyContent: "flex-end" }}>
            <Button variant="line" sm onClick={() => fechar()} disabled={ocupado}>
              Cancelar
            </Button>
            <Button variant="d" sm onClick={() => excluir(janela.o)} disabled={ocupado}>
              {ocupado ? "Excluindo…" : "Excluir"}
            </Button>
          </div>
        </JanelaModal>
      )}
      {janela?.tipo === "massa" && (
        <JanelaEmMassaOrdens
          acao={janela.acao}
          catalogo={catalogo}
          numeros={[...selecionados]}
          todosDaBusca={todosDaBusca}
          filtros={filtros}
          daPagina={daPagina.map((o) => ({ numero: o.numero_ordem, situacao: o.no_sync_os.situacao }))}
          aoFechar={fechar}
        />
      )}
    </Panel>
  );
}
