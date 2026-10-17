"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BarraAcoesEmMassa } from "@/components/simulador/BarraAcoesEmMassa";
import { BotaoComMenu } from "@/components/simulador/BotaoComMenu";
import { TabelaSelecionavel, type ColunaDaTabela } from "@/components/simulador/TabelaSelecionavel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MenuAcoes } from "@/components/ui/MenuAcoes";
import { Notice } from "@/components/ui/Notice";
import { JanelaModal } from "@/components/web/JanelaModal";
import { Panel } from "@/components/web/Panel";
import { PaginacaoLista } from "@/components/web/PaginacaoLista";
import { chamar } from "@/lib/cliente-api";
import { rotas } from "@/lib/rotas";
import { useToast } from "@/state/toast";
import { FormularioAleatorio } from "./FormularioAleatorio";
import { FormularioFuncionario } from "./FormularioFuncionario";
import { JanelaEmMassa } from "./JanelaEmMassa";
import type { AcaoEmMassa, CatalogoDeFuncionarios, Funcionario, ListaDeFuncionarios } from "./tipos";
import { VerMaisFuncionario } from "./VerMaisFuncionario";

type Janela = { tipo: "manual" } | { tipo: "aleatorio" } | { tipo: "editar"; f: Funcionario } | { tipo: "excluir"; f: Funcionario } | { tipo: "ver"; f: Funcionario } | { tipo: "massa"; acao: AcaoEmMassa } | null;

interface PainelFuncionariosProps {
  lista: ListaDeFuncionarios;
  catalogo: CatalogoDeFuncionarios;
  busca?: string;
  /** `equipe.id` → nome, para mostrar a equipe da conta no "ver mais". */
  nomesDeEquipe: Record<string, string>;
}

/**
 * A tabela do simulador de funcionários: busca, "Novo funcionário" (manual ou aleatório), seleção com ações em massa (mudar setor,
 * mudar situação e excluir), "ver mais", editar e excluir. Tudo vai para `/rh-simulado/gestao/...`; o que o SYNC OS faz com cada mudança
 * (o aviso de desligamento, por exemplo) acontece do lado dele.
 */
export function PainelFuncionarios({ lista, catalogo, busca, nomesDeEquipe }: PainelFuncionariosProps) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [janela, setJanela] = useState<Janela>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [todosDaBusca, setTodosDaBusca] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const daPagina = lista.funcionarios;
  const marcadosNaPagina = daPagina.filter((f) => selecionados.has(f.matricula)).length;
  const quantidade = todosDaBusca ? lista.total : selecionados.size;

  function limparSelecao() {
    setSelecionados(new Set());
    setTodosDaBusca(false);
  }

  function fechar(concluiu = false) {
    setJanela(null);
    setErro(null);
    if (concluiu) limparSelecao();
  }

  async function excluir(f: Funcionario) {
    setOcupado(true);
    setErro(null);
    try {
      await chamar("DELETE", `/rh-simulado/gestao/funcionarios/${encodeURIComponent(f.matricula)}`);
      exibirAviso(`${f.nome} foi excluído(a) do registro.`);
      fechar();
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir o funcionário");
    } finally {
      setOcupado(false);
    }
  }

  const colunas: ColunaDaTabela<Funcionario>[] = [
    {
      titulo: "Nome completo",
      render: (f) => (
        <span className="stack g4" style={{ alignItems: "flex-start" }}>
          <b>{f.nome}</b>
          <span className="row g4 wrap">
            {f.situacao === "afastado" && <Badge tone="al" style={{ padding: "1px 8px", fontSize: 11 }}>Afastado</Badge>}
            {f.situacao === "desligado" && <Badge tone="blq" style={{ padding: "1px 8px", fontSize: 11 }}>Desligado</Badge>}
            {f.conta_no_sync_os && (
              <Badge tone={f.conta_no_sync_os.ativo ? "lib" : "neu"} style={{ padding: "1px 8px", fontSize: 11 }}>
                {f.conta_no_sync_os.ativo ? "No SYNC OS" : "No SYNC OS (desativada)"}
              </Badge>
            )}
          </span>
        </span>
      ),
    },
    { titulo: "E-mail", render: (f) => f.email },
    { titulo: "Matrícula", largura: 100, className: "mono", render: (f) => f.matricula },
    { titulo: "Setor", render: (f) => f.setor },
    {
      titulo: "Mais",
      largura: 90,
      render: (f) => (
        <button type="button" className="sim-link" onClick={() => setJanela({ tipo: "ver", f })}>
          Ver mais
        </button>
      ),
    },
  ];

  return (
    <Panel>
      <div className="row between wrap">
        <h2>Funcionários · {lista.total}</h2>
        <BotaoComMenu
          rotulo="Novo funcionário"
          opcoes={[
            { rotulo: "Manual", descricao: "Preencher todos os campos", aoClicar: () => setJanela({ tipo: "manual" }) },
            { rotulo: "Aleatório", descricao: "Gerar vários de uma vez, por setor e cargo", aoClicar: () => setJanela({ tipo: "aleatorio" }) },
          ]}
        />
      </div>

      <form method="get" action={rotas.simulador.funcionarios} className="filtros-lista">
        <div className="field">
          <label htmlFor="f-busca">Busca</label>
          <input id="f-busca" name="busca" type="search" className="input" placeholder="Nome, e-mail ou matrícula" defaultValue={busca ?? ""} />
        </div>
        <button type="submit" className="btn btn-line btn-sm" style={{ height: 36 }}>
          Buscar
        </button>
      </form>

      <BarraAcoesEmMassa
        quantidade={quantidade}
        rotulo="funcionários"
        totalDaBusca={lista.total}
        marcadosNaPagina={marcadosNaPagina}
        tamanhoDaPagina={daPagina.length}
        todosDaBusca={todosDaBusca}
        aoSelecionarTodosDaBusca={() => setTodosDaBusca(true)}
        aoLimpar={limparSelecao}
      >
        <Button variant="line" sm onClick={() => setJanela({ tipo: "massa", acao: "mudar_setor" })}>
          Mudar setor
        </Button>
        <Button variant="line" sm onClick={() => setJanela({ tipo: "massa", acao: "mudar_situacao" })}>
          Mudar situação
        </Button>
        <Button variant="d" sm onClick={() => setJanela({ tipo: "massa", acao: "excluir" })}>
          Excluir
        </Button>
      </BarraAcoesEmMassa>

      <TabelaSelecionavel
        legenda="Funcionários do registro"
        rotuloDoItem="funcionário"
        linhas={daPagina}
        idDe={(f) => f.matricula}
        colunas={colunas}
        selecionados={selecionados}
        aoAlterarSelecao={(s) => {
          setSelecionados(s);
          setTodosDaBusca(false);
        }}
        classeDaLinha={(f) => (f.situacao === "desligado" ? "off" : undefined)}
        vazio={busca ? "Nenhum funcionário encontrado para esta busca." : "O registro está vazio. Crie funcionários pelo botão acima."}
        acoesDaLinha={(f) => (
          <span style={{ display: "inline-flex", justifyContent: "flex-end" }}>
            <MenuAcoes
              rotulo={`Ações de ${f.nome}`}
              itens={[
                { rotulo: "Editar", aoClicar: () => setJanela({ tipo: "editar", f }) },
                { rotulo: f.conta_no_sync_os ? "Excluir (tem conta)" : "Excluir", aoClicar: () => setJanela({ tipo: "excluir", f }), perigo: true, desabilitado: Boolean(f.conta_no_sync_os) },
              ]}
            />
          </span>
        )}
      />

      <PaginacaoLista caminho={rotas.simulador.funcionarios} consulta={{ busca }} pagina={lista.pagina} tamanho={lista.tamanho} total={lista.total} />

      {janela?.tipo === "manual" && (
        <JanelaModal titulo="Novo funcionário" aoFechar={() => fechar()} className="dlg-larga">
          <FormularioFuncionario catalogo={catalogo} aoConcluir={() => fechar()} />
        </JanelaModal>
      )}
      {janela?.tipo === "aleatorio" && (
        <JanelaModal titulo="Novos funcionários aleatórios" aoFechar={() => fechar()} className="dlg-larga">
          <FormularioAleatorio catalogo={catalogo} aoConcluir={() => fechar()} />
        </JanelaModal>
      )}
      {janela?.tipo === "editar" && (
        <JanelaModal titulo={`Editar ${janela.f.nome}`} aoFechar={() => fechar()} className="dlg-larga">
          <FormularioFuncionario funcionario={janela.f} catalogo={catalogo} aoConcluir={() => fechar()} />
        </JanelaModal>
      )}
      {janela?.tipo === "ver" && <VerMaisFuncionario funcionario={janela.f} nomesDeEquipe={nomesDeEquipe} aoFechar={() => fechar()} />}
      {janela?.tipo === "excluir" && (
        <JanelaModal titulo="Excluir funcionário" aoFechar={() => fechar()}>
          <p style={{ fontSize: 14 }}>
            Excluir <b>{janela.f.nome}</b> (matrícula {janela.f.matricula}) do registro? Não dá para desfazer.
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
            <Button variant="d" sm onClick={() => excluir(janela.f)} disabled={ocupado}>
              {ocupado ? "Excluindo…" : "Excluir"}
            </Button>
          </div>
        </JanelaModal>
      )}
      {janela?.tipo === "massa" && (
        <JanelaEmMassa
          acao={janela.acao}
          catalogo={catalogo}
          matriculas={[...selecionados]}
          todosDaBusca={todosDaBusca}
          busca={busca}
          daPagina={daPagina.map((f) => ({ matricula: f.matricula, tem_conta: Boolean(f.conta_no_sync_os) }))}
          aoFechar={fechar}
        />
      )}
    </Panel>
  );
}
