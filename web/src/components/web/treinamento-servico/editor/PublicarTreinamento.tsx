"use client";

import { useState } from "react";
import { JanelaDeAssinatura } from "@/components/ausencia/JanelaDeAssinatura";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { chamar } from "@/lib/cliente-api";
import { rotas } from "@/lib/rotas";
import { pendenciasAbertas, requisitosDePublicacao, termoDePublicacao, type RascunhoDoEditor, type RequisitoDePublicacao } from "@/lib/treinamento-servico";
import { VitoriaNaCena } from "../vitoria/VitoriaNaCena";
import { BotaoTestar } from "./BotaoTestar";

interface PublicarTreinamentoProps {
  codigo: string;
  descricao: string;
  /** O rascunho a publicar; nulo quando não há rascunho (nada a publicar, ou acabou de ser publicado). */
  rascunho: RascunhoDoEditor | null;
  /** A versão no ar antes desta, se houver. */
  versaoNoAr: number | null;
  /** A assinatura do perfil de quem publica (seção 3.7 do `vitoria.md`). */
  assinaturaPath: string | null;
}

const ONDE_CORRIGIR: Record<RequisitoDePublicacao["chave"], "explicacao" | "fases" | "revisao"> = {
  passos: "explicacao",
  fases: "fases",
  preenchido: "revisao",
  palavras: "fases",
  pendencias: "revisao",
};

/**
 * Publicar (seção 3.7 do `vitoria.md`): o que a publicação exige, o que vai ao ar, o termo e a assinatura do perfil, na mesma
 * janela das outras ações assinadas. Publicado, a Vitória comemora; a versão anterior fica no histórico.
 */
export function PublicarTreinamento({ codigo, descricao, rascunho, versaoNoAr, assinaturaPath }: PublicarTreinamentoProps) {
  const [assinando, setAssinando] = useState(false);
  /** A versão que acabou de ir ao ar e a que estava antes (guardada aqui: depois de publicar a página recarrega as versões). */
  const [publicada, setPublicada] = useState<{ versao: number; anterior: number | null } | null>(null);
  const termo = termoDePublicacao(codigo, descricao);
  const rota = (tela?: Parameters<typeof rotas.app.treinamentoServico>[1]) => rotas.app.treinamentoServico(codigo, tela);

  if (publicada !== null) {
    return (
      <section className="panel ts-publicado" role="status">
        <div className="ts-confetes" aria-hidden="true">
          {Array.from({ length: 22 }, (_, i) => (
            <i key={i} style={{ "--i": i } as React.CSSProperties} />
          ))}
        </div>
        <VitoriaNaCena chave="publicado" reacao="comemorando" tamanho={150} empilhada>
          <strong className="ts-balao-titulo">Treinamento publicado!</strong>
          <p>
            A versão {publicada.versao} já aparece no catálogo para os técnicos
            {publicada.anterior ? `; a versão ${publicada.anterior} ficou no histórico` : publicada.versao === 1 ? ", e eles recebem um aviso" : ""}.
          </p>
        </VitoriaNaCena>
        <div className="row g8 wrap ts-centro">
          <LinkButton variant="p" href={rotas.app.catalogo}>
            Voltar ao catálogo
          </LinkButton>
          <LinkButton variant="line" href={rota("versoes")}>
            Ver as versões
          </LinkButton>
        </div>
      </section>
    );
  }

  if (!rascunho) {
    return (
      <section className="panel ts-sem-rascunho">
        <VitoriaNaCena chave="nada" tamanho={84}>
          <strong className="ts-balao-titulo">Não há rascunho para publicar</strong>
          <p>{versaoNoAr ? `A versão ${versaoNoAr} já está no ar.` : "Crie o conteúdo do treinamento primeiro."}</p>
        </VitoriaNaCena>
        <div className="row g8 wrap">
          <LinkButton variant="p" href={versaoNoAr ? rota("explicacao") : rota("criar")}>
            {versaoNoAr ? "Editar o treinamento" : "Criar o conteúdo"}
          </LinkButton>
          <LinkButton variant="line" href={rota()}>
            Visão geral
          </LinkButton>
        </div>
      </section>
    );
  }

  const pendencias = pendenciasAbertas(rascunho).length;
  const requisitos = requisitosDePublicacao(rascunho, pendencias);
  const publicavel = requisitos.every((q) => q.ok);

  async function publicar() {
    await chamar("POST", `/treinamentos/${encodeURIComponent(codigo)}/publicar`, { arquivo_id: assinaturaPath });
    setPublicada({ versao: rascunho!.versao, anterior: versaoNoAr });
  }

  return (
    <div className="ts-publicar">
      <div className="ts-publicar-grade">
        <section className="panel ts-requisitos" aria-labelledby="titulo-requisitos">
          <h2 id="titulo-requisitos">Antes de publicar</h2>
          <ul className="ts-requisitos-lista">
            {requisitos.map((q) => (
              <li key={q.chave} data-ok={q.ok || undefined}>
                <span className="ts-requisito-marca">
                  <Icon name={q.ok ? "check" : "x"} size={13} />
                </span>
                <span className="stack g4">
                  <strong>{q.rotulo}</strong>
                  <span className="small">{q.detalhe}</span>
                </span>
                {!q.ok && (
                  <LinkButton variant="ghost" sm href={rota(ONDE_CORRIGIR[q.chave])}>
                    Resolver
                  </LinkButton>
                )}
              </li>
            ))}
            <li data-ok>
              <span className="ts-requisito-marca ts-requisito-sugestao">
                <Icon name="play" size={13} />
              </span>
              <span className="stack g4">
                <strong>Testar o jogo</strong>
                <span className="small">Recomendado: jogue do começo ao fim como o técnico.</span>
              </span>
              <BotaoTestar codigo={codigo} descricao={descricao} conteudo={rascunho} variant="line" sm rotulo="Testar" />
            </li>
          </ul>
        </section>

        <section className="panel ts-vai-ao-ar" aria-labelledby="titulo-vai-ao-ar">
          <h2 id="titulo-vai-ao-ar">O que vai ao ar</h2>
          <dl className="ts-numeros">
            <div>
              <dt>Versão</dt>
              <dd>{rascunho.versao}</dd>
            </div>
            <div>
              <dt>Passos</dt>
              <dd>{rascunho.explicacao.length}</dd>
            </div>
            <div>
              <dt>Fases</dt>
              <dd>{rascunho.fases.length}</dd>
            </div>
          </dl>
          <ul className="ts-vai-ao-ar-lista">
            <li>
              <Icon name="users" size={13} />
              {versaoNoAr ? `Substitui a versão ${versaoNoAr}, que fica no histórico com a assinatura dela.` : "É a primeira publicação: os técnicos recebem um aviso."}
            </li>
            <li>
              <Icon name="trophy" size={13} />
              Quem já concluiu uma versão anterior não pontua de novo.
            </li>
            {rascunho.gerado_com_ia && (
              <li>
                <Icon name="sparkle" size={13} />A auditoria registra que o rascunho veio da Vitória, com o texto de origem.
              </li>
            )}
          </ul>
        </section>
      </div>

      <section className="panel ts-termo" aria-labelledby="titulo-termo">
        <h2 id="titulo-termo">Termo de revisão</h2>
        <blockquote>{termo}</blockquote>
        <p className="small">Quem publica responde pelo conteúdo, mesmo o que veio da Vitória. A assinatura é a do seu perfil e fica guardada com esta versão.</p>
        <div className="row g8 wrap">
          <Button variant="p" onClick={() => setAssinando(true)} disabled={!publicavel}>
            <Icon name="shield" size={16} />
            Assinar e publicar
          </Button>
          {!publicavel && <span className="small">Resolva os itens marcados acima para publicar.</span>}
        </div>
      </section>

      {assinando && (
        <JanelaDeAssinatura
          titulo={`Publicar a versão ${rascunho.versao}`}
          resumo={termo}
          rotuloConfirmar="Assinar e publicar"
          assinaturaPath={assinaturaPath}
          aoConfirmar={publicar}
          aoFechar={() => setAssinando(false)}
        />
      )}
    </div>
  );
}
