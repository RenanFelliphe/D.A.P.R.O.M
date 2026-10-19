import type { CSSProperties } from "react";
import { LinkButton } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ImagemArquivo } from "@/components/ui/ImagemArquivo";
import { data } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { duracaoEstimada, formatarNota, notaMaxima, pontosMaximos, type RankingDoTreinamento as Ranking, type TreinamentoParaJogador, type TreinamentoResumo } from "@/lib/treinamento-servico";
import { BotaoTreinar } from "./jogo/BotaoTreinar";
import { RankingDoTreinamento } from "./RankingDoTreinamento";
import { VitoriaNaCena } from "./vitoria/VitoriaNaCena";

interface CapaDoTreinamentoProps {
  treinamento: TreinamentoParaJogador;
  /** A situação de quem pede (concluído, fases certas); nula se a lista não veio. */
  resumo: TreinamentoResumo | null;
  /** O ranking de quem já concluiu; nulo se não veio (a capa aparece sem ele). */
  ranking: Ranking | null;
  /** O admin não joga (a `api` recusa a tentativa): testa pelo editor. */
  admin: boolean;
}

/**
 * A capa do treinamento na página `/treinar`: o cenário, a Vitória convidando, o que vem pela frente, o botão que abre o jogo
 * e o ranking de quem já concluiu.
 */
export function CapaDoTreinamento({ treinamento, resumo, ranking, admin }: CapaDoTreinamentoProps) {
  const passos = treinamento.explicacao.length;
  const fases = treinamento.total_fases;
  const concluido = Boolean(resumo?.concluido);
  const partes: { icone: IconName; titulo: string; texto: string }[] = [
    { icone: "chat", titulo: "Parte 1 · A explicação", texto: `A Vitória explica o serviço em ${passos === 1 ? "1 passo" : `${passos} passos`}, no seu ritmo.` },
    { icone: "play", titulo: "Parte 2 · O jogo", texto: `${fases === 1 ? "1 fase" : `${fases} fases`} por toque: quiz, decisões, caça-palavras, memória, termo e outros minijogos.` },
    {
      icone: "trophy",
      titulo: "A nota",
      texto: `Até ${formatarNota(notaMaxima(fases))}: cada fase vale até 10 pelos acertos, vezes o tempo (mais rápido vale mais), e a soma vezes as fases × 10. No ranking vale a sua melhor nota; na gamificação, até ${pontosMaximos(fases)} pontos na primeira vez.`,
    },
  ];

  return (
    <div className="ts-capa-pagina">
      <section className="panel ts-capa-hero">
        <div className="ts-capa-hero-arte">
          {treinamento.cenario_path ? (
            <ImagemArquivo id={treinamento.cenario_path} alt={`Cenário de ${treinamento.descricao}`} />
          ) : (
            <span className="ts-capa-hero-fundo" aria-hidden="true">
              <Icon name="shield" size={24} />
            </span>
          )}
        </div>
        <div className="ts-capa-hero-texto">
          <span className="lbl">Treinamento de serviço · versão {treinamento.versao}</span>
          <h1>{treinamento.descricao}</h1>
          <div className="ts-chips">
            <span className="ts-chip">
              <Icon name="clock" size={13} />~{duracaoEstimada(passos, fases)} min
            </span>
            <span className="ts-chip">
              <Icon name="play" size={13} />
              {fases} {fases === 1 ? "fase" : "fases"}
            </span>
            {concluido && (
              <span className="ts-chip ts-chip-ok">
                <Icon name="check" size={13} />
                Concluído · {resumo!.fases_certas}/{resumo!.total_fases} fases certas
              </span>
            )}
          </div>
          <VitoriaNaCena chave="capa-pagina" reacao="ola" tamanho={96}>
            <p>
              {concluido
                ? "Você já concluiu este treinamento. Jogar de novo não dá pontos na gamificação, mas pode melhorar a sua nota no ranking."
                : "Oi! Eu te explico o serviço e depois você joga. Acertar rápido vale mais!"}
            </p>
          </VitoriaNaCena>
          {admin ? (
            <div className="stack g6">
              <LinkButton variant="p" href={rotas.app.treinamentoServico(treinamento.atividade_codigo)}>
                <Icon name="pencil" size={16} />
                Abrir no editor
              </LinkButton>
              <span className="small">O admin não joga: use &ldquo;Testar o jogo&rdquo; no editor, que não pontua.</span>
            </div>
          ) : (
            <BotaoTreinar codigo={treinamento.atividade_codigo} treinamento={treinamento} jaConcluiu={concluido} rotulo={concluido ? "Jogar de novo" : "Começar o treinamento"} className="ts-capa-botao" />
          )}
          <p className="ts-assinatura">
            <Icon name="shield" size={13} />
            Revisado e assinado por {treinamento.publicada_por_nome} em {data(treinamento.publicada_em)}.
          </p>
        </div>
      </section>

      <ol className="ts-capa-partes">
        {partes.map((p, i) => (
          <li key={p.titulo} className="panel" style={{ "--i": i } as CSSProperties}>
            <span className="ts-capa-etapa-icone">
              <Icon name={p.icone} size={18} />
            </span>
            <strong>{p.titulo}</strong>
            <span className="small">{p.texto}</span>
          </li>
        ))}
      </ol>

      {ranking && <RankingDoTreinamento ranking={ranking} className="panel ts-capa-ranking" />}
    </div>
  );
}
