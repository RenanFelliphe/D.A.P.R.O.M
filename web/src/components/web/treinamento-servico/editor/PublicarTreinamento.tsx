"use client";

import { useState } from "react";
import { JanelaDeAssinatura } from "@/components/ausencia/JanelaDeAssinatura";
import { Button, LinkButton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { chamar } from "@/lib/cliente-api";
import { rotas } from "@/lib/rotas";
import { pendenciasAbertas, requisitosDePublicacao, termoDePublicacao, type RascunhoDoEditor, type RequisitoDePublicacao } from "@/lib/treinamento-servico";
import { situacaoDaValidacao, type ValidacaoDoTreinamento } from "@/lib/treinamento-validacao";
import { VitoriaNaCena } from "../vitoria/VitoriaNaCena";
import { AndamentoDaValidacao } from "./AndamentoDaValidacao";
import { BotaoRetirarValidacao } from "./BotaoRetirarValidacao";
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
  /** A validação pelos supervisores deste rascunho; `null` quando a pessoa não participa dela ou não há rascunho. */
  validacao?: ValidacaoDoTreinamento | null;
  /** O admin pode publicar direto (a exceção); o supervisor só envia para validação. */
  admin?: boolean;
}

/** O mínimo de caracteres da justificativa de publicar sem esperar os supervisores: uma frase, não um "ok". */
const MINIMO_DA_JUSTIFICATIVA = 10;

const ONDE_CORRIGIR: Record<RequisitoDePublicacao["chave"], "explicacao" | "fases" | "revisao"> = {
  passos: "explicacao",
  fases: "fases",
  preenchido: "revisao",
  palavras: "fases",
  pendencias: "revisao",
};

/**
 * Publicar (seção 3.7 do `vitoria.md` e `validacao-de-treinamento.md`): o que a publicação exige, o que vai ao ar e quem valida. Quem
 * cria envia para a validação dos supervisores (com a assinatura do perfil, na janela das outras ações assinadas) e acompanha o
 * andamento; o admin também pode publicar direto, como exceção, com justificativa. Publicado, a Vitória comemora.
 */
export function PublicarTreinamento({ codigo, descricao, rascunho, versaoNoAr, assinaturaPath, validacao = null, admin = false }: PublicarTreinamentoProps) {
  const [assinando, setAssinando] = useState<"enviar" | "direto" | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [faltaJustificativa, setFaltaJustificativa] = useState(false);
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

  const previstos = validacao?.validadores_previstos ?? [];
  const emValidacao = validacao?.em_validacao ?? false;
  const devolvido = situacaoDaValidacao(validacao) === "devolvido";
  /** Com gente que poderia validar, publicar direto é a exceção e pede o porquê; sem ninguém (serviço sem OS), não há o que justificar. */
  const exigeJustificativa = previstos.length > 0 || emValidacao;
  const nValidadores = emValidacao ? (validacao?.validadores.length ?? 0) : previstos.length;
  const quantasAssinam = Math.min(2, nValidadores);
  const podeEnviar = Boolean(validacao?.pode_enviar) && previstos.length > 0;

  async function publicarDireto() {
    await chamar("POST", `/treinamentos/${encodeURIComponent(codigo)}/publicar`, {
      arquivo_id: assinaturaPath,
      ...(justificativa.trim() ? { justificativa: justificativa.trim() } : {}),
    });
    setPublicada({ versao: rascunho!.versao, anterior: versaoNoAr });
  }

  async function enviarParaValidacao() {
    await chamar("POST", `/treinamentos/${encodeURIComponent(codigo)}/validacao/enviar`);
  }

  function pedirPublicacaoDireta() {
    if (exigeJustificativa && justificativa.trim().length < MINIMO_DA_JUSTIFICATIVA) {
      setFaltaJustificativa(true);
      return;
    }
    setFaltaJustificativa(false);
    setAssinando("direto");
  }

  const janelaDaPublicacaoDireta = assinando === "direto" && (
    <JanelaDeAssinatura
      titulo={`Publicar a versão ${rascunho.versao}`}
      resumo={termo}
      rotuloConfirmar="Assinar e publicar"
      assinaturaPath={assinaturaPath}
      aoConfirmar={publicarDireto}
      aoFechar={() => setAssinando(null)}
    >
      {justificativa.trim() && (
        <p className="small">
          <strong>Justificativa:</strong> {justificativa.trim()}
        </p>
      )}
    </JanelaDeAssinatura>
  );

  const publicarDiretoBloco = admin && exigeJustificativa && (
    <details className="ts-direto">
      <summary>Publicar direto, sem esperar os supervisores (exceção do administrador)</summary>
      <div className="stack g8">
        <p className="small">O treinamento costuma passar por quem conhece o serviço. Publicar direto fica registrado na auditoria e na versão, com a sua justificativa.</p>
        <Field
          label="Justificativa (obrigatória)"
          htmlFor="justificativa-direta"
          erro={faltaJustificativa ? `Explique por que não espera a validação (ao menos ${MINIMO_DA_JUSTIFICATIVA} caracteres).` : undefined}
        >
          <textarea
            id="justificativa-direta"
            className="textarea"
            rows={3}
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Ex.: correção urgente de uma resposta errada no ar"
          />
        </Field>
        <div className="row g8 wrap">
          <Button variant="od" sm onClick={pedirPublicacaoDireta} disabled={!publicavel}>
            <Icon name="shield" size={13} />
            Publicar direto
          </Button>
        </div>
      </div>
    </details>
  );

  if (emValidacao && validacao) {
    return (
      <div className="ts-publicar">
        <section className="panel" aria-labelledby="titulo-andamento">
          <h2 id="titulo-andamento">Em validação pelos supervisores</h2>
          <p className="muted">
            O treinamento foi enviado e está travado para edição. Publica sozinho quando {quantasAssinam} {quantasAssinam === 1 ? "supervisor assina" : "supervisores assinam"}; se um deles
            recusar, ele volta para o autor com o motivo.
          </p>
          <AndamentoDaValidacao validacao={validacao} />
          <div className="row g8 wrap">
            {validacao.pode_retirar && <BotaoRetirarValidacao codigo={codigo} />}
            <LinkButton variant="ghost" sm href={rota("versoes")}>
              Ver as versões
            </LinkButton>
          </div>
        </section>
        {publicarDiretoBloco}
        {janelaDaPublicacaoDireta}
      </div>
    );
  }

  return (
    <div className="ts-publicar">
      {devolvido && validacao?.historico[0] && (
        <Notice tone="blq" icon="alert" role="status">
          <span className="stack g4">
            <strong>Devolvido pela validação{validacao.historico[0].por_nome ? ` por ${validacao.historico[0].por_nome}` : ""}</strong>
            <span>{validacao.historico[0].motivo ?? "Sem motivo registrado."}</span>
            <span className="small">Ajuste o que foi pedido e envie de novo: a nova rodada escolhe os validadores outra vez.</span>
          </span>
        </Notice>
      )}
      <div className="ts-publicar-grade">
        <section className="panel ts-requisitos" aria-labelledby="titulo-requisitos">
          <h2 id="titulo-requisitos">Antes de enviar</h2>
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

      {previstos.length > 0 && (
        <section className="panel ts-quem-valida" aria-labelledby="titulo-quem-valida">
          <h2 id="titulo-quem-valida">Quem valida</h2>
          <p className="muted">
            Validam os supervisores das equipes que mais fazem este serviço, sem a de quem criou. Publica quando {quantasAssinam} {quantasAssinam === 1 ? "assina" : "assinam"}; uma recusa devolve o
            treinamento a quem criou, com o motivo. Os validadores ficam fixos a partir do envio.
          </p>
          <ol>
            {previstos.map((p) => (
              <li key={p.equipe_nome}>
                <strong>{p.equipe_nome}</strong>
                <span className="small"> · {p.supervisor_nome ?? "quem responde pela equipe"}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="panel ts-termo" aria-labelledby="titulo-termo">
        <h2 id="titulo-termo">{podeEnviar ? "Enviar para validação" : "Publicação"}</h2>
        <blockquote>{termo}</blockquote>
        {podeEnviar ? (
          <p className="small">
            Quem envia responde pelo conteúdo, mesmo o que veio da Vitória. Enquanto os supervisores validam, o rascunho fica travado; você pode retirá-lo da validação para editar. A assinatura é
            a do seu perfil.
          </p>
        ) : previstos.length === 0 ? (
          <p className="small">
            {admin
              ? "Nenhuma equipe pode validar este treinamento agora (por exemplo, o serviço ainda não tem OS): você publica direto, com a sua assinatura."
              : "Nenhuma equipe pode validar este treinamento agora. Peça ao administrador para publicar."}
          </p>
        ) : (
          <p className="small">Só quem criou o rascunho o envia para validação.</p>
        )}
        <div className="row g8 wrap">
          {podeEnviar ? (
            <Button variant="p" onClick={() => setAssinando("enviar")} disabled={!publicavel}>
              <Icon name="shield" size={16} />
              Assinar e enviar para validação
            </Button>
          ) : (
            admin &&
            previstos.length === 0 && (
              <Button variant="p" onClick={() => setAssinando("direto")} disabled={!publicavel}>
                <Icon name="shield" size={16} />
                Assinar e publicar
              </Button>
            )
          )}
          {!publicavel && <span className="small">Resolva os itens marcados acima para continuar.</span>}
        </div>
      </section>

      {publicarDiretoBloco}

      {assinando === "enviar" && (
        <JanelaDeAssinatura
          titulo={`Enviar a versão ${rascunho.versao} para validação`}
          resumo={termo}
          rotuloConfirmar="Assinar e enviar"
          assinaturaPath={assinaturaPath}
          aoConfirmar={enviarParaValidacao}
          aoFechar={() => setAssinando(null)}
        >
          <div className="stack g4">
            <strong className="small">Validam:</strong>
            <ul className="ts-requisitos-lista">
              {previstos.map((p) => (
                <li key={p.equipe_nome} data-ok>
                  <span className="ts-requisito-marca">
                    <Icon name="users" size={13} />
                  </span>
                  <span className="small">
                    <strong>{p.equipe_nome}</strong>
                    {p.supervisor_nome ? ` · ${p.supervisor_nome}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <span className="small muted">
              O rascunho fica travado até {quantasAssinam} {quantasAssinam === 1 ? "assinar" : "assinarem"} ou alguém recusar.
            </span>
          </div>
        </JanelaDeAssinatura>
      )}
      {janelaDaPublicacaoDireta}
    </div>
  );
}
