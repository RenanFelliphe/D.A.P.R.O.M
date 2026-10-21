"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { JanelaSobreposta } from "@/components/ui/JanelaSobreposta";
import { Notice } from "@/components/ui/Notice";
import type { EscolhaDoModelo, ModeloParaEscolher } from "@/lib/apr";
import { cx } from "@/lib/cx";

interface JanelaDeModelosProps {
  /** `null` enquanto carrega. */
  escolha: EscolhaDoModelo | null;
  erro?: string | null;
  /** Código do modelo em uso (na troca), que não se seleciona de novo. */
  atual?: string | null;
  /** Código que está sendo carregado depois de selecionado. */
  carregando?: string | null;
  aoSelecionar: (codigo: string) => void;
  aoFechar: () => void;
}

/** O aviso do topo: a recomendação é só uma orientação, e quem confere e escolhe é o técnico. */
function AvisoDaRecomendacao({ escolha }: { escolha: EscolhaDoModelo }) {
  if (escolha.recomendado) {
    return (
      <Notice tone="al" icon="alert">
        <strong>Sempre confira se a opção recomendada é a certa.</strong></Notice>
    );
  }
  const combinam = escolha.modelos.filter((m) => m.encontradas.length > 0).length;
  return (
    <Notice tone="info" icon="info">
      {combinam > 1
        ? "Mais de um modelo combina com esta OS. Leia a descrição de cada um e escolha o que atende ao serviço que você vai executar."
        : "Nenhum modelo se destacou na leitura desta OS. Escolha pela descrição o que atende ao serviço que você vai executar."}
    </Notice>
  );
}

function OpcaoDeModelo({ modelo, recomendado, motivo, atual, carregando, bloqueado, aoSelecionar }: {
  modelo: ModeloParaEscolher;
  recomendado: boolean;
  /** Por que a Vitória recomenda este modelo (só quando a IA leu a OS). */
  motivo: string | null;
  atual: boolean;
  carregando: boolean;
  bloqueado: boolean;
  aoSelecionar: () => void;
}) {
  return (
    <article className={cx("modelo-opcao", recomendado && "recomendado")} data-treino={recomendado ? "apr-modelo-recomendado" : undefined}>
      {atual && (
        <div className="row g8 wrap">
          <Badge tone="neu">Em uso nesta APR</Badge>
        </div>
      )}
      <h4>
        {modelo.codigo} — {modelo.titulo}
      </h4>
      {modelo.descricao ? <p>{modelo.descricao}</p> : <p className="muted">O admin ainda não descreveu os serviços deste modelo.</p>}
      {recomendado && motivo && <p className="achado">Vitória: {motivo}</p>}
      {modelo.encontradas.length > 0 && (
        <p className="achado">
          Encontrado nesta OS:{" "}
          {modelo.encontradas.map((p, i) => (
            <span key={p}>
              {i > 0 && ", "}
              <mark>{p}</mark>
            </span>
          ))}
        </p>
      )}
      <div className="modelo-opcao-acoes">
        <Button variant={recomendado ? "p" : "line"} disabled={atual || bloqueado} onClick={aoSelecionar}>
          {carregando ? "Abrindo…" : atual ? "Em uso" : `Selecionar ${modelo.codigo}`}
        </Button>
      </div>
    </article>
  );
}

/**
 * A janela de escolha do modelo da APR: todos os modelos publicados, com título, descrição e o botão de selecionar
 * (os exemplos de serviço da orientação não aparecem, para não pesar de texto). O recomendado pela leitura da OS vem
 * sozinho no topo, em destaque (com o aviso para conferir), e os demais em duas colunas, na ordem do código. Nunca
 * escolhe sozinha.
 */
export function JanelaDeModelos({ escolha, erro, atual, carregando, aoSelecionar, aoFechar }: JanelaDeModelosProps) {
  const recomendado = escolha?.modelos.find((m) => m.codigo === escolha.recomendado);
  const outros = escolha?.modelos.filter((m) => m !== recomendado) ?? [];
  const opcao = (m: ModeloParaEscolher) => (
    <OpcaoDeModelo
      key={m.codigo}
      modelo={m}
      recomendado={m === recomendado}
      motivo={m === recomendado ? (escolha?.motivo ?? null) : null}
      atual={m.codigo === atual}
      carregando={m.codigo === carregando}
      bloqueado={Boolean(carregando)}
      aoSelecionar={() => aoSelecionar(m.codigo)}
    />
  );

  return (
    <JanelaSobreposta titulo="Escolha o modelo da APR" aoFechar={aoFechar} className="dlg-modelos">
      {erro && (
        <Notice tone="blq" icon="alert">
          {erro}
        </Notice>
      )}
      {!escolha ? (
        !erro && <span className="muted">Carregando os modelos…</span>
      ) : escolha.modelos.length === 0 ? (
        <Notice tone="blq" icon="alert">
          Não há modelo de APR publicado. Avise o admin.
        </Notice>
      ) : (
        <>
          <AvisoDaRecomendacao escolha={escolha} />
          <div className="modelos-apr" data-treino="apr-modelo">
            {recomendado && (
              <section className="modelos-apr-grupo">
                <h3>Opção recomendada</h3>
                {opcao(recomendado)}
              </section>
            )}
            {outros.length > 0 && (
              <section className="modelos-apr-grupo">
                <h3>{recomendado ? "Outros modelos de APR" : "Modelos de APR"}</h3>
                <div className="modelos-apr-grade">{outros.map(opcao)}</div>
              </section>
            )}
          </div>
        </>
      )}
    </JanelaSobreposta>
  );
}
