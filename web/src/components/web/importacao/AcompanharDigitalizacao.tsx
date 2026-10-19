"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/web/Panel";
import { chamar, ErroCliente } from "@/lib/cliente-api";
import { ConferenciaDigitalizacao } from "./ConferenciaDigitalizacao";
import { ComoVaiFuncionar, type Passo } from "./ComoVaiFuncionar";
import type { Digitalizacao, EtapaDaDigitalizacao, ResultadoDaDigitalizacao } from "./tipos-digitalizacao";

/** De quanto em quanto tempo se pergunta à `api` como vai a leitura (ms); com a rede fora, espera mais. */
const A_CADA_MS = 2000;
const A_CADA_COM_FALHA_MS = 5000;

const ORDEM_DAS_ETAPAS: EtapaDaDigitalizacao[] = ["preparando", "ocr", "ia", "conferindo"];

function passosDaLeitura(d: Digitalizacao): Passo[] {
  const posicao = ORDEM_DAS_ETAPAS.indexOf(d.etapa);
  const estado = (i: number): Passo["estado"] => (posicao > i ? "feito" : "proximo");
  return [
    { titulo: "PDF recebido", detalhe: "O arquivo está guardado; as folhas são desenhadas uma a uma.", estado: "feito" },
    {
      titulo: "Leitura do texto impresso",
      detalhe: d.paginas > 0 ? `O OCR do sistema lê o que foi impresso pelo SAP: folha ${Math.min(d.paginas_lidas + (d.etapa === "ocr" ? 1 : 0), d.paginas)} de ${d.paginas}.` : "O OCR do sistema lê o que foi impresso pelo SAP.",
      estado: estado(1),
    },
    { titulo: "Leitura do que foi escrito à mão", detalhe: "A IA lê só o manuscrito (início e fim reais, pessoas e descrição), nunca assinaturas nem nomes.", estado: estado(2) },
    { titulo: "Conferência com o SAP e os cadastros", detalhe: "O sistema compara o que foi lido com os cadastros e aponta o que não bate.", estado: estado(3) },
  ];
}

interface AcompanharDigitalizacaoProps {
  id: string;
  podeCadastrarEquipe: boolean;
  /** Saiu da digitalização sem registrar (descartada, ou a pessoa fechou a conferência). */
  aoSair: () => void;
  aoRegistrar: (nome: string, resultado: ResultadoDaDigitalizacao) => void;
}

/**
 * Uma digitalização em andamento: enquanto as folhas são lidas em segundo plano, mostra o passo a passo e a barra de folhas
 * (a tela pergunta à `api` a cada 2 s); pronta, abre a conferência; se a leitura falhou, diz por quê. Dá para sair e voltar:
 * a leitura continua no servidor e a digitalização fica na lista de "em aberto".
 */
export function AcompanharDigitalizacao({ id, podeCadastrarEquipe, aoSair, aoRegistrar }: AcompanharDigitalizacaoProps) {
  const [dados, setDados] = useState<Digitalizacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [descartando, setDescartando] = useState(false);
  // `aoSair` muda a cada render do pai: o laço de consultas não pode recomeçar por isso.
  const sair = useEffectEvent(aoSair);

  useEffect(() => {
    let ativo = true;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    async function consultar() {
      try {
        const atual = await chamar<Digitalizacao>("GET", `/digitalizacoes/${id}`);
        if (!ativo) return;
        setDados(atual);
        setErro(null);
        if (atual.estado === "lendo") temporizador = setTimeout(consultar, A_CADA_MS);
      } catch (e) {
        if (!ativo) return;
        // Digitalização que não existe mais (descartada em outra aba): não adianta insistir.
        if (e instanceof ErroCliente && e.status === 404) {
          sair();
          return;
        }
        setErro(e instanceof ErroCliente ? e.message : "Servidor indisponível. Tentando de novo…");
        temporizador = setTimeout(consultar, A_CADA_COM_FALHA_MS);
      }
    }
    void consultar();
    return () => {
      ativo = false;
      if (temporizador) clearTimeout(temporizador);
    };
  }, [id]);

  async function descartar() {
    setDescartando(true);
    setErro(null);
    try {
      await chamar("DELETE", `/digitalizacoes/${id}`);
      aoSair();
    } catch (e) {
      setErro(e instanceof ErroCliente ? e.message : "Servidor indisponível. Tente de novo.");
      setDescartando(false);
    }
  }

  if (!dados) {
    return (
      <Panel>
        <div className="row g8 muted" role="status">
          <Icon name="refresh" size={16} className="spin" />
          Abrindo a digitalização…
          {erro && <span className="small">{erro}</span>}
        </div>
      </Panel>
    );
  }

  if (dados.estado === "falhou") {
    return (
      <Panel>
        <div className="row g12 wrap" style={{ alignItems: "center" }}>
          <span className="arq-tag pdf" aria-hidden="true">
            PDF
          </span>
          <span className="stack" style={{ flex: 1, lineHeight: 1.3, minWidth: 0 }}>
            <span className="mono" style={{ fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>
              {dados.nome_arquivo}
            </span>
            <span className="small">a leitura não terminou</span>
          </span>
        </div>
        <Notice tone="blq" icon="octagon" role="alert">
          <strong>Não foi possível ler este PDF.</strong> {dados.erro}
        </Notice>
        {erro && (
          <span className="entrada-retorno erro" role="alert">
            {erro}
          </span>
        )}
        <div className="row g8">
          <Button variant="p" sm onClick={descartar} disabled={descartando}>
            <Icon name={descartando ? "refresh" : "trash"} size={16} className={descartando ? "spin" : undefined} />
            {descartando ? "Descartando…" : "Descartar e tentar outro arquivo"}
          </Button>
        </div>
      </Panel>
    );
  }

  if (dados.estado === "lida" && dados.leitura) {
    return (
      <ConferenciaDigitalizacao
        id={dados.id}
        nome={dados.nome_arquivo}
        leitura={dados.leitura}
        podeCadastrarEquipe={podeCadastrarEquipe}
        aoDescartar={descartar}
        aoSair={aoSair}
        aoRegistrar={(resultado) => aoRegistrar(dados.nome_arquivo, resultado)}
      />
    );
  }

  const porcentagem = dados.paginas > 0 ? Math.round((dados.paginas_lidas / dados.paginas) * 100) : 0;
  return (
    <Panel>
      <div className="row g12 wrap" style={{ alignItems: "center" }}>
        <span className="arq-tag pdf" aria-hidden="true">
          PDF
        </span>
        <span className="stack" style={{ flex: 1, lineHeight: 1.3, minWidth: 0 }}>
          <span className="mono" style={{ fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>
            {dados.nome_arquivo}
          </span>
          <span className="small" role="status">
            <Icon name="refresh" size={13} className="spin" /> Lendo as folhas… você pode sair desta tela: a leitura continua e a digitalização fica em aberto.
          </span>
        </span>
        <Button variant="line" sm onClick={aoSair}>
          Ver depois
        </Button>
      </div>
      <div className="trilho" role="progressbar" aria-label="Folhas lidas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={porcentagem}>
        <i style={{ width: `${Math.max(porcentagem, 4)}%`, background: "var(--o-cam)", transition: "width .4s ease" }}></i>
      </div>
      <ComoVaiFuncionar titulo="O que o sistema está fazendo" passos={passosDaLeitura(dados)} />
      {erro && (
        <span className="small" role="status" style={{ color: "var(--al)" }}>
          {erro}
        </span>
      )}
    </Panel>
  );
}
