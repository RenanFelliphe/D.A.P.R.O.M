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

/** O recomendado primeiro; os demais na ordem do código. */
function emOrdem(escolha: EscolhaDoModelo) {
  const recomendado = escolha.modelos.find((m) => m.codigo === escolha.recomendado);
  return recomendado ? [recomendado, ...escolha.modelos.filter((m) => m !== recomendado)] : escolha.modelos;
}

/** O aviso do topo: a recomendação é só uma orientação, e quem confere e escolhe é o técnico. */
function AvisoDaRecomendacao({ escolha }: { escolha: EscolhaDoModelo }) {
  if (escolha.recomendado) {
    return (
      <Notice tone="al" icon="alert">
        <strong>Confira se a opção recomendada é a certa.</strong> Ela vem da leitura do título e da descrição da OS, não da sua avaliação do
        local. Se o serviço tiver outra condição (trabalho em altura, espaço confinado, escavação…), escolha o modelo que a cobre.
      </Notice>
    );
  }
  const combinam = escolha.modelos.filter((m) => m.encontradas.length > 0).length;
  return (
    <Notice tone="info" icon="info">
      {combinam > 1
        ? "Mais de um modelo combina com esta OS. Leia a descrição de cada um e escolha o que atende ao serviço que você vai executar."
        : "Nenhum modelo se destacou na leitura desta OS. Escolha pela descrição e pelos exemplos o que atende ao serviço que você vai executar."}
    </Notice>
  );
}

function OpcaoDeModelo({ modelo, recomendado, atual, carregando, bloqueado, aoSelecionar }: {
  modelo: ModeloParaEscolher;
  recomendado: boolean;
  atual: boolean;
  carregando: boolean;
  bloqueado: boolean;
  aoSelecionar: () => void;
}) {
  return (
    <article className={cx("modelo-opcao", recomendado && "recomendado")} data-treino={recomendado ? "apr-modelo-recomendado" : undefined}>
      <div className="row g8 wrap">
        {recomendado && (
          <>
            <Badge tone="brand">Opção recomendada</Badge>
            <Badge tone="al">Confira se é esta mesmo</Badge>
          </>
        )}
        {atual && <Badge tone="neu">Em uso nesta APR</Badge>}
      </div>
      <h3>
        {modelo.codigo} — {modelo.titulo}
      </h3>
      {modelo.descricao ? <p>{modelo.descricao}</p> : <p className="muted">O admin ainda não descreveu os serviços deste modelo.</p>}
      {modelo.exemplos.length > 0 && (
        <div>
          <span className="lbl">Exemplos de serviço</span>
          <ul>
            {modelo.exemplos.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
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
 * A janela de escolha do modelo da APR: todos os modelos publicados, com título, descrição, exemplos e o botão de
 * selecionar, e o recomendado pela leitura da OS em destaque (com o aviso para conferir). Nunca escolhe sozinha.
 */
export function JanelaDeModelos({ escolha, erro, atual, carregando, aoSelecionar, aoFechar }: JanelaDeModelosProps) {
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
            {emOrdem(escolha).map((m) => (
              <OpcaoDeModelo
                key={m.codigo}
                modelo={m}
                recomendado={m.codigo === escolha.recomendado}
                atual={m.codigo === atual}
                carregando={m.codigo === carregando}
                bloqueado={Boolean(carregando)}
                aoSelecionar={() => aoSelecionar(m.codigo)}
              />
            ))}
          </div>
        </>
      )}
    </JanelaSobreposta>
  );
}
