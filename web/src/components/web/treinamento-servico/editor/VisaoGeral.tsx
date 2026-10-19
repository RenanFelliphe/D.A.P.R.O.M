import type { CSSProperties, ReactNode } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { dataHora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { pendenciasAbertas, problemasDoConteudo, requisitosDePublicacao, type RascunhoComIA, type VersaoAnterior } from "@/lib/treinamento-servico";
import { VitoriaNaCena } from "../vitoria/VitoriaNaCena";
import { BotaoTestar } from "./BotaoTestar";

interface VisaoGeralProps {
  codigo: string;
  descricao: string;
  /** O rascunho em edição, se houver (a visão geral não cria um só por abrir). */
  rascunho: RascunhoComIA | null;
  publicada: VersaoAnterior | null;
  problemasAbertos: number;
}

type Situacao = "feita" | "agora" | "depois";

/**
 * A visão geral do treinamento do admin: o caminho até publicar (conteúdo, validação, teste e publicação), com a situação de
 * cada etapa e o atalho para ela; ao lado, o que está no ar, os problemas reportados e a Vitória.
 */
export function VisaoGeral({ codigo, descricao, rascunho, publicada, problemasAbertos }: VisaoGeralProps) {
  const rota = (tela?: Parameters<typeof rotas.app.treinamentoServico>[1]) => rotas.app.treinamentoServico(codigo, tela);

  return (
    <div className="ts-visao">
      <div className="ts-editor-grade">
        <div className="ts-editor-principal">{rascunho ? <Caminho codigo={codigo} descricao={descricao} rascunho={rascunho} /> : <SemRascunho codigo={codigo} publicada={publicada} />}</div>

        <aside className="ts-editor-lado" aria-label="Situação do treinamento">
          <section className="panel ts-no-ar">
            <span className="lbl">No ar para os técnicos</span>
            {publicada ? (
              <>
                <strong className="ts-no-ar-versao">
                  <span className="ts-ponto-vivo" />
                  Versão {publicada.versao}
                </strong>
                <span className="small">
                  {publicada.total_passos} passos · {publicada.total_fases} fases
                  <br />
                  Publicada em {dataHora(publicada.publicada_em)} por {publicada.publicada_por_nome ?? "—"}
                </span>
                <LinkButton variant="ghost" sm href={rota("versoes")}>
                  Ver todas as versões
                </LinkButton>
              </>
            ) : (
              <span className="small">Ainda não publicado: os técnicos não veem este treinamento.</span>
            )}
          </section>
          <section className={cx("panel ts-no-ar", problemasAbertos > 0 && "ts-com-alerta")}>
            <span className="lbl">Problemas reportados</span>
            <strong className="ts-no-ar-versao">{problemasAbertos === 0 ? "Nenhum em aberto" : problemasAbertos === 1 ? "1 em aberto" : `${problemasAbertos} em aberto`}</strong>
            <span className="small">Os técnicos reportam pelo botão &ldquo;Reportar problema&rdquo; de cada fase.</span>
            <LinkButton variant="ghost" sm href={rota("problemas")}>
              Abrir os problemas
            </LinkButton>
          </section>
          {rascunho?.ia.disponivel && (
            <section className="panel ts-no-ar">
              <span className="lbl">Vitória (IA)</span>
              <span className="small">
                {rascunho.gerado_com_ia ? `Este rascunho veio da Vitória. Rodadas usadas: ${rascunho.ia.rodadas_usadas} de ${rascunho.ia.limite_rodadas}.` : "Este rascunho foi feito à mão."}
              </span>
              {rascunho.ia.pode_gerar && (
                <LinkButton variant="ghost" sm href={rota("gerar")}>
                  <Icon name="sparkle" size={13} />
                  {rascunho.gerado_com_ia ? "Gerar de novo" : "Gerar com a Vitória"}
                </LinkButton>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function SemRascunho({ codigo, publicada }: { codigo: string; publicada: VersaoAnterior | null }) {
  return (
    <section className="panel ts-sem-rascunho">
      <VitoriaNaCena chave="sem-rascunho" reacao="certo" tamanho={96}>
        <strong className="ts-balao-titulo">Tudo publicado!</strong>
        <p>
          {publicada ? `A versão ${publicada.versao} está no ar e não há rascunho em edição.` : "Não há rascunho em edição."} Editar cria a versão seguinte como rascunho; a publicada continua
          no ar até a nova ser publicada.
        </p>
      </VitoriaNaCena>
      <div className="row g8 wrap">
        <LinkButton variant="p" href={rotas.app.treinamentoServico(codigo, "explicacao")}>
          <Icon name="pencil" size={16} />
          Editar o treinamento
        </LinkButton>
        <LinkButton variant="line" href={rotas.app.treinamentoServico(codigo, "criar")}>
          Recomeçar o conteúdo
        </LinkButton>
      </div>
    </section>
  );
}

function Caminho({ codigo, descricao, rascunho }: { codigo: string; descricao: string; rascunho: RascunhoComIA }) {
  const rota = (tela?: Parameters<typeof rotas.app.treinamentoServico>[1]) => rotas.app.treinamentoServico(codigo, tela);
  const { explicacao, fases } = rascunho;
  const pendencias = pendenciasAbertas(rascunho).length;
  const incompletos = problemasDoConteudo(rascunho).length;
  const requisitos = requisitosDePublicacao(rascunho, pendencias);
  const conteudoOk = requisitos.filter((q) => q.chave !== "pendencias").every((q) => q.ok);
  const publicavel = requisitos.every((q) => q.ok);

  const etapas: { icone: IconName; titulo: string; detalhe: string; situacao: Situacao; acoes: ReactNode }[] = [
    {
      icone: "pencil",
      titulo: "Conteúdo",
      detalhe: `${explicacao.length === 1 ? "1 passo" : `${explicacao.length} passos`} de explicação · ${fases.length === 1 ? "1 fase" : `${fases.length} fases`} de jogo${incompletos > 0 ? " · há campos vazios" : ""}${fases.length < 3 ? " · mínimo de 3 fases" : ""}`,
      situacao: conteudoOk ? "feita" : "agora",
      acoes: (
        <>
          <LinkButton variant="line" sm href={rota("explicacao")}>
            Explicação
          </LinkButton>
          <LinkButton variant="line" sm href={rota("fases")}>
            Fases do jogo
          </LinkButton>
        </>
      ),
    },
    {
      icone: "check",
      titulo: "Validação",
      detalhe: rascunho.gerado_com_ia
        ? pendencias === 0
          ? "Nenhuma pendência da Vitória."
          : `${pendencias === 1 ? "1 pendência" : `${pendencias} pendências`} da Vitória para conferir.`
        : "Confira o treinamento inteiro com as respostas certas.",
      situacao: pendencias > 0 ? "agora" : conteudoOk ? "feita" : "depois",
      acoes: (
        <LinkButton variant={pendencias > 0 ? "p" : "line"} sm href={rota("revisao")}>
          Abrir a revisão
        </LinkButton>
      ),
    },
    {
      icone: "play",
      titulo: "Teste",
      detalhe: "Jogue como o técnico vai jogar, numa janela, sem pontuar.",
      situacao: publicavel ? "agora" : "depois",
      acoes: <BotaoTestar codigo={codigo} descricao={descricao} conteudo={rascunho} sm />,
    },
    {
      icone: "shield",
      titulo: "Publicação",
      detalhe: publicavel ? "Pronto para publicar com a sua assinatura." : "Libera quando o conteúdo estiver completo e sem pendências.",
      situacao: publicavel ? "agora" : "depois",
      acoes: publicavel ? (
        <LinkButton variant="p" sm href={rota("publicar")}>
          Publicar
          <Icon name="right" size={13} />
        </LinkButton>
      ) : (
        <Button variant="p" sm disabled>
          Publicar
        </Button>
      ),
    },
  ];

  return (
    <section className="ts-caminho-vertical" aria-labelledby="titulo-caminho-visao">
      <div className="ts-secao-cab">
        <div>
          <h2 id="titulo-caminho-visao">Rascunho da versão {rascunho.versao}</h2>
          <p className="muted">O caminho até os técnicos verem este treinamento.</p>
        </div>
      </div>
      <ol className="ts-etapas">
        {etapas.map((e, i) => (
          <li key={e.titulo} className="ts-etapa" data-situacao={e.situacao} style={{ "--i": i } as CSSProperties}>
            <span className="ts-etapa-marca" aria-hidden="true">
              {e.situacao === "feita" ? <Icon name="check" size={16} /> : <Icon name={e.icone} size={16} />}
            </span>
            <div className="ts-etapa-corpo">
              <div className="ts-etapa-texto">
                <strong>
                  {i + 1}. {e.titulo}
                </strong>
                <span className="small">{e.detalhe}</span>
              </div>
              <div className="ts-etapa-acoes">{e.acoes}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
