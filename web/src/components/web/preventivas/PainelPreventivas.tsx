"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { chamar, ErroCliente } from "@/lib/cliente-api";
import { dataDoDia } from "@/lib/formatar";
import { aparenciaDaSituacao, SITUACOES, type ListaDePreventivas, type PlanoPreventiva, type SituacaoDoCiclo } from "@/lib/preventivas";
import { LinhaPreventiva } from "./LinhaPreventiva";

/** Minúsculo e sem acento, para a busca. */
const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

interface PainelPreventivasProps {
  /** Só os planos desta equipe (o filtro de equipe do quadro). */
  equipeId?: string;
  /** Filtro de situação ao abrir (`undefined`: as que pedem atenção primeiro, todas visíveis). */
  situacaoInicial?: SituacaoDoCiclo;
  /** Mostra só esta situação, sem os botões de filtro (a seção "sem intervalo" da importação). */
  fixa?: SituacaoDoCiclo;
  /** Texto quando não há nenhum plano na situação fixa. */
  vazio?: string;
}

/**
 * Os planos de preventiva com a contagem regressiva de cada um (`GET /preventivas`): filtros por situação com a contagem,
 * busca por título, plano, equipamento ou local, e cada plano com o histórico e a definição do intervalo. O sistema não cria
 * OS: ele avisa quando o ciclo se aproxima ou vence.
 */
export function PainelPreventivas({ equipeId, situacaoInicial, fixa, vazio }: PainelPreventivasProps) {
  const router = useRouter();
  const [lista, setLista] = useState<ListaDePreventivas | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [situacao, setSituacao] = useState<SituacaoDoCiclo | null>(fixa ?? situacaoInicial ?? null);
  const [busca, setBusca] = useState("");
  // Cada pedido de recarga sobe a versão; a lista está carregando até a resposta dessa versão chegar.
  const [versao, setVersao] = useState(0);
  const [respondida, setRespondida] = useState(-1);
  const carregando = respondida !== versao;
  const carregar = () => setVersao((v) => v + 1);

  useEffect(() => {
    let vivo = true;
    const q = new URLSearchParams();
    if (equipeId) q.set("equipe_id", equipeId);
    chamar<ListaDePreventivas>("GET", `/preventivas${q.size ? `?${q}` : ""}`)
      .then((r) => {
        if (!vivo) return;
        setLista(r);
        setErro(null);
      })
      .catch((e) => vivo && setErro(e instanceof ErroCliente ? e.message : "Não foi possível carregar as preventivas."))
      .finally(() => vivo && setRespondida(versao));
    return () => {
      vivo = false;
    };
  }, [equipeId, versao]);

  const visiveis = useMemo(() => {
    if (!lista) return [];
    const termo = normalizar(busca.trim());
    return lista.planos.filter(
      (p) =>
        (!situacao || p.situacao === situacao) &&
        (!termo || [p.titulo, p.plano_manutencao, p.item_manutencao, p.equipamento, p.local?.codigo, p.equipe?.nome].some((c) => c && normalizar(c).includes(termo))),
    );
  }, [lista, situacao, busca]);

  function atualizado(plano: PlanoPreventiva) {
    setLista((atual) => (atual ? { ...atual, planos: atual.planos.map((p) => (p.id === plano.id ? plano : p)) } : atual));
    // A contagem por situação e os alertas mudam: recarrega a lista e a tela de trás (o selo do botão e o sino).
    carregar();
    router.refresh();
  }

  if (erro && !lista) {
    return (
      <div className="stack g8">
        <span className="entrada-retorno erro" role="alert">
          {erro}
        </span>
        <Button variant="line" sm onClick={carregar}>
          Tentar de novo
        </Button>
      </div>
    );
  }
  if (!lista) return <span className="small">Carregando as preventivas…</span>;

  const contagem = lista.contagem;
  const comPlanos = SITUACOES.filter((s) => contagem[s] > 0 || s === situacao);

  return (
    <div className="stack g12">
      {!fixa && (
        <>
          <div className="prev-resumo">
            {(["vencido", "proximo", "aguardando_execucao", "em_dia"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className="prev-kpi"
                aria-pressed={situacao === s}
                onClick={() => setSituacao(situacao === s ? null : s)}
                style={{ borderTopColor: aparenciaDaSituacao[s].cor }}
              >
                <strong style={{ color: contagem[s] > 0 ? aparenciaDaSituacao[s].cor : undefined }}>{contagem[s]}</strong>
                <span>{aparenciaDaSituacao[s].rotulo}</span>
              </button>
            ))}
          </div>
          <div className="row between wrap g8" style={{ alignItems: "center" }}>
            <div className="chips" role="group" aria-label="Situação do ciclo">
              <button type="button" aria-pressed={situacao === null} onClick={() => setSituacao(null)}>
                Todas · {contagem.total}
              </button>
              {comPlanos.map((s) => (
                <button key={s} type="button" aria-pressed={situacao === s} onClick={() => setSituacao(situacao === s ? null : s)}>
                  {aparenciaDaSituacao[s].rotulo} · {contagem[s]}
                </button>
              ))}
            </div>
          </div>
          <div className="row g8 wrap" style={{ alignItems: "center" }}>
            <input
              className="input"
              type="search"
              placeholder="Buscar por título, plano, equipamento ou local"
              aria-label="Buscar preventivas"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{ flex: "1 1 240px" }}
            />
            <Button variant="ghost" sm onClick={carregar} disabled={carregando}>
              <Icon name="refresh" size={16} className={carregando ? "spin" : undefined} />
              Atualizar
            </Button>
          </div>
          <span className="small">
            Hoje é {dataDoDia(lista.hoje)}. O sistema não cria OS: quando o próximo ciclo entra na antecedência ou vence sem OS nova do plano, o supervisor da
            equipe recebe um alerta nas notificações.
          </span>
        </>
      )}

      {erro && (
        <span className="entrada-retorno erro" role="alert">
          {erro}
        </span>
      )}

      {visiveis.length === 0 ? (
        <p className="muted" style={{ fontSize: 14 }}>
          {fixa ? (vazio ?? "Nenhum plano nesta situação.") : lista.planos.length === 0 ? "Nenhuma OS preventiva com plano de manutenção ainda." : "Nenhum plano com esses filtros."}
        </p>
      ) : (
        <ul className="prev-lista">
          {visiveis.map((p) => (
            <LinhaPreventiva key={p.id} plano={p} aoAtualizar={atualizado} editando={fixa === "sem_intervalo" && p.pode_editar} />
          ))}
        </ul>
      )}
    </div>
  );
}
