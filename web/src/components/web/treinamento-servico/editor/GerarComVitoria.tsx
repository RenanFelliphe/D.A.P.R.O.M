"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { z } from "zod";
import { Button, LinkButton } from "@/components/ui/Button";
import { idDoErro, MensagemDeErro } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { useFormulario, useValorDoForm } from "@/components/ui/useFormulario";
import { rotas } from "@/lib/rotas";
import { LIMITES, type RascunhoComIA, type ResultadoDaIA } from "@/lib/treinamento-servico";
import { EXEMPLO_DE_PROCEDIMENTO, ORIENTACOES_DO_PROCEDIMENTO } from "@/lib/treinamento-servico-exemplo";
import { VitoriaNaCena } from "../vitoria/VitoriaNaCena";
import { AvisoDeFalhaDaIA } from "./AvisoDeFalhaDaIA";
import { CarregandoComVitoria } from "./CarregandoComVitoria";
import { PlanoDoJogo, planoPadrao, type Plano } from "./PlanoDoJogo";
import { useRascunhoIA } from "./useRascunhoIA";

interface GerarComVitoriaProps {
  codigo: string;
  rascunho: RascunhoComIA;
  /** Os materiais do serviço no catálogo, que a Vitória também recebe (para o Selecione com os materiais do serviço). */
  materiais: string[];
}

/** O procedimento colado: o mínimo para a Vitória ter o que ler e o máximo que a `api` aceita. */
const esquema = z.object({
  texto: z
    .string()
    .trim()
    .min(LIMITES.procedimentoMin, `Cole o procedimento inteiro, com pelo menos ${LIMITES.procedimentoMin.toLocaleString("pt-BR")} caracteres: algumas frases não bastam.`)
    .max(LIMITES.procedimentoMax, `O texto pode ter até ${LIMITES.procedimentoMax.toLocaleString("pt-BR")} caracteres.`),
});

/** Depois de pronto, quanto tempo a comemoração fica na tela antes de abrir a validação. */
const ABRIR_REVISAO_MS = 3500;

/**
 * "Gerar com a Vitória" (seção 3.6 do `vitoria.md`): como escrever o procedimento, com um exemplo logo abaixo; o texto; as
 * fases do jogo (quantas e o tipo de cada uma, ou "A Vitória escolhe"), logo abaixo do texto; e,
 * enquanto a IA trabalha, a Vitória pensando com o progresso. Pronto, ela comemora e a validação abre sozinha.
 */
export function GerarComVitoria({ codigo, rascunho, materiais }: GerarComVitoriaProps) {
  const roteador = useRouter();
  const idTexto = useId();
  const { form, validar } = useFormulario(esquema, { texto: rascunho.texto_origem ?? "" });
  const [texto, setTexto] = useValorDoForm(form, "texto");
  const erroDoTexto = form.formState.errors.texto?.message;
  const [confirmando, setConfirmando] = useState(false);
  const [plano, setPlano] = useState<Plano>(planoPadrao);
  const [pronto, setPronto] = useState<ResultadoDaIA | null>(null);
  const ia = useRascunhoIA(codigo, rascunho.ia, { aoConcluir: setPronto });
  const { situacao } = ia;
  const temConteudo = rascunho.explicacao.length + rascunho.fases.length > 0;
  const revisao = rotas.app.treinamentoServico(codigo, "revisao");

  useEffect(() => {
    if (!pronto) return;
    const id = window.setTimeout(() => roteador.push(revisao), ABRIR_REVISAO_MS);
    return () => window.clearTimeout(id);
  }, [pronto, roteador, revisao]);

  async function gerar() {
    setConfirmando(false);
    await ia.gerar(texto, plano);
  }

  /** Confere o texto antes de gerar (a mensagem aparece abaixo do campo) e, havendo rascunho, pede a confirmação de substituí-lo. */
  async function tentarGerar() {
    if (!(await validar())) return;
    if (temConteudo) setConfirmando(true);
    else await gerar();
  }

  if (pronto) {
    const { explicacao, fases, pendencias } = pronto.rascunho;
    return (
      <section className="panel ts-gerar-pronto" role="status">
        <VitoriaNaCena chave="pronto" reacao="comemorando" tamanho={150} empilhada>
          <strong className="ts-balao-titulo">Pronto! Montei o rascunho.</strong>
          <p>{pronto.resumo}</p>
        </VitoriaNaCena>
        <dl className="ts-numeros">
          <div>
            <dt>Passos</dt>
            <dd>{explicacao.length}</dd>
          </div>
          <div>
            <dt>Fases</dt>
            <dd>{fases.length}</dd>
          </div>
          <div data-alerta={pendencias.length > 0 || undefined}>
            <dt>Para conferir</dt>
            <dd>{pendencias.length}</dd>
          </div>
        </dl>
        {pronto.descartados > 0 && (
          <Notice tone="al" icon="alert">
            {pronto.descartados === 1 ? "1 item veio fora do formato e ficou de fora." : `${pronto.descartados} itens vieram fora do formato e ficaram de fora.`}
          </Notice>
        )}
        <p className="small">Abrindo a validação…</p>
        <LinkButton variant="p" href={revisao}>
          Validar o rascunho agora
          <Icon name="right" size={16} />
        </LinkButton>
      </section>
    );
  }

  if (ia.trabalhando) {
    return (
      <section className="panel ts-gerar-espera">
        <CarregandoComVitoria progresso={ia.progresso} />
      </section>
    );
  }

  return (
    <div className="ts-gerar">
      <section className="panel ts-gerar-orientacao" aria-labelledby="titulo-orientacao">
        <VitoriaNaCena chave="gerar" tamanho={84}>
          <strong className="ts-balao-titulo">Cole o procedimento e eu monto o rascunho</strong>
          <p>Uso só o seu texto e os materiais do serviço no catálogo. Marco de que trecho saiu cada passo e cada fase, e você valida tudo antes de publicar.</p>
        </VitoriaNaCena>
        <h2 id="titulo-orientacao">Como escrever o texto</h2>
        <ol className="ts-orientacoes">
          {ORIENTACOES_DO_PROCEDIMENTO.map((o, i) => (
            <li key={o.titulo}>
              <span className="ts-proximo-num">{i + 1}</span>
              <span className="stack g4">
                <strong>{o.titulo}</strong>
                <span className="small">{o.texto}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="ts-nao-cole">
          <Icon name="lock" size={13} />
          Não cole a APR nem o checklist: o treinamento ensina o comportamento seguro, e a Vitória não recebe o modelo de APR.
        </p>
        {materiais.length > 0 ? (
          <div className="stack g6">
            <span className="lbl">Materiais do serviço que ela também recebe</span>
            <div className="ts-fichas">
              {materiais.map((m) => (
                <span key={m} className="ts-ficha ts-ficha-leitura">
                  {m}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <span className="small">Este serviço ainda não tem materiais no catálogo: o Selecione com os materiais do serviço fica de fora.</span>
        )}
      </section>

      <div className="ts-gerar-coluna">
        <section className="panel ts-gerar-form" aria-labelledby={idTexto}>
          <div className="field" data-erro={erroDoTexto ? "" : undefined}>
            <label id={idTexto} htmlFor={`${idTexto}-campo`} className="ts-rotulo-grande">
              Texto do procedimento
            </label>
            <textarea
              id={`${idTexto}-campo`}
              className="textarea ts-procedimento"
              rows={16}
              maxLength={LIMITES.procedimentoMax}
              value={texto}
              placeholder="Cole aqui o procedimento do serviço: o que ele usa, os passos na ordem, os cuidados e os números exatos."
              aria-invalid={erroDoTexto ? true : undefined}
              aria-describedby={erroDoTexto ? idDoErro(`${idTexto}-campo`) : undefined}
              onChange={(e) => {
                setTexto(e.target.value);
                ia.limparErro();
              }}
            />
            {erroDoTexto && <MensagemDeErro id={idDoErro(`${idTexto}-campo`)}>{erroDoTexto}</MensagemDeErro>}
            <div className="row between wrap g8">
              <span className="small">
                {texto.length.toLocaleString("pt-BR")} de {LIMITES.procedimentoMax.toLocaleString("pt-BR")} caracteres
              </span>
              {texto && (
                <Button variant="ghost" sm onClick={() => setTexto("")}>
                  Limpar
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className="panel ts-gerar-form ts-gerar-plano" aria-labelledby={`${idTexto}-plano`}>
          <div className="stack g4">
            <h2 id={`${idTexto}-plano`} className="ts-rotulo-grande">
              Fases do jogo
            </h2>
            <span className="small">Quantas fases o jogo terá e qual minijogo vai em cada uma. Deixe “A Vitória escolhe” onde tanto faz, ou use “1 de cada”.</span>
          </div>
          <PlanoDoJogo plano={plano} aoMudar={setPlano} temMateriais={materiais.length > 0} />

          {ia.erro && <AvisoDeFalhaDaIA falha={ia.erro} />}

          {confirmando ? (
            <Notice tone="al" icon="alert">
              <span className="stack g8">
                <span>
                  O rascunho atual tem {rascunho.explicacao.length} passos e {rascunho.fases.length} fases. Gerar <strong>substitui tudo</strong>
                  {situacao.usa_ia ? " e gasta uma rodada da Vitória" : ""}.
                </span>
                <span className="row g8 wrap">
                  <Button variant="d" sm onClick={gerar}>
                    Substituir e gerar
                  </Button>
                  <Button variant="ghost" sm onClick={() => setConfirmando(false)}>
                    Cancelar
                  </Button>
                </span>
              </span>
            </Notice>
          ) : (
            <Button variant="p" block onClick={() => void tentarGerar()} disabled={!situacao.pode_gerar}>
              <Icon name="sparkle" size={16} />
              {situacao.usa_ia ? "Gerar de novo com a Vitória" : "Gerar o rascunho com a Vitória"}
            </Button>
          )}
          <span className="small ts-gerar-limite">
            {situacao.motivo
              ? `${situacao.motivo}.`
              : situacao.usa_ia
                ? `Rodadas deste treinamento: ${situacao.rodadas_usadas} de ${situacao.limite_rodadas}.`
                : `Treinamentos feitos com a Vitória: ${situacao.treinamentos_usados} de ${situacao.limite_treinamentos}.`}
          </span>
        </section>
      </div>

      <section className="panel ts-gerar-exemplo" aria-labelledby="titulo-exemplo">
        <div className="ts-secao-cab">
          <div>
            <h2 id="titulo-exemplo">Exemplo de texto</h2>
            <p className="muted">Um procedimento fictício no formato que funciona melhor. Use-o para conhecer o fluxo; o treinamento de verdade sai do procedimento oficial.</p>
          </div>
          <Button variant="line" sm onClick={() => setTexto(EXEMPLO_DE_PROCEDIMENTO)}>
            <Icon name="download" size={13} />
            Usar este exemplo
          </Button>
        </div>
        <pre className="ts-exemplo-texto">{EXEMPLO_DE_PROCEDIMENTO}</pre>
      </section>
    </div>
  );
}
