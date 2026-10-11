import { CadastrarAssinatura } from "@/components/app/aprovada/CadastrarAssinatura";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { faltaEvidencia, type Colega, type ItemDoModelo, type RascunhoApr, type ResumoDoRascunho } from "@/lib/apr";

interface RevisaoAprProps {
  rascunho: RascunhoApr;
  resumo: ResumoDoRascunho;
  /** Resultado que a `api` deve calcular: só decide o que acontece depois ("Concluir e validar"). */
  esperado: "aprovada" | "bloqueada";
  /** Participantes sem assinatura no perfil (a `api` recusa a APR enquanto faltar). */
  semAssinatura: Colega[];
  /** O técnico logado está sem assinatura e pode desenhá-la aqui. */
  euSemAssinatura: boolean;
  /** Reabre a pergunta (base 0) para responder, corrigir a resposta ou a evidência. */
  aoAbrir: (indice: number) => void;
  aoVoltar: () => void;
  aoObservarGeral: (texto: string) => void;
  aoAssinaturaSalva: (arquivoId: string) => void;
  aoConcluir: () => void;
  concluindo: boolean;
  erro: string | null;
}

/** Revisão final antes de validar: o que falta, itens reprovados, alertas, observações gerais e o aviso do que acontece ao concluir. */
export function RevisaoApr({ rascunho, resumo, esperado, semAssinatura, euSemAssinatura, aoAbrir, aoVoltar, aoObservarGeral, aoAssinaturaSalva, aoConcluir, concluindo, erro }: RevisaoAprProps) {
  const { perguntas, reprovados, alertas, semEvidencia, naSemObservacao, semResposta } = resumo;
  const indiceDe = (item: ItemDoModelo) => perguntas.indexOf(item);
  const bloqueando = esperado === "bloqueada";
  const outrosSemAssinatura = semAssinatura.filter((c) => c.id !== rascunho.usuarioId);
  // Na bloqueada a `api` exige a assinatura de todos; na aprovada isso é resolvido na tela de assinaturas.
  const faltaAssinatura = bloqueando && (euSemAssinatura || outrosSemAssinatura.length > 0);

  return (
    <>
      <div className="card stack g6">
        <h2 style={{ fontSize: 17, fontWeight: 600 }}>Revisão da APR</h2>
        <p className="muted">
          {resumo.respondidas} de {perguntas.length} perguntas respondidas. Depois de validada, a APR não pode ser alterada.
        </p>
      </div>

      {semResposta.length > 0 && (
        <>
          <Notice tone="al" icon="alert">
            <strong>
              {semResposta.length} {semResposta.length > 1 ? "perguntas sem resposta." : "pergunta sem resposta."}
            </strong>{" "}
            A APR é respondida por inteiro.
          </Notice>
          <div className="answered">
            {semResposta.map((item) => (
              <div key={item.id} className="ans-row">
                <span className="n">{indiceDe(item) + 1}</span>
                <span className="t">{item.texto}</span>
                <Button variant="line" sm style={{ height: 36, fontSize: 13 }} onClick={() => aoAbrir(indiceDe(item))}>
                  Responder
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      {reprovados.length > 0 ? (
        <>
          <Notice tone="blq" icon="octagon">
            <strong>
              {reprovados.length} {reprovados.length > 1 ? "itens eliminatórios reprovados." : "item eliminatório reprovado."}
            </strong>{" "}
            Ao validar, a APR será bloqueada e a OS ficará pendente.
          </Notice>
          <div className="answered">
            {reprovados.map((item) => (
              <div key={item.id} className="ans-row">
                <span className="n">{indiceDe(item) + 1}</span>
                <span className="t">
                  {item.texto}
                  <br />
                  <span className="small">
                    {faltaEvidencia(rascunho, item)
                      ? "Falta a evidência"
                      : `“${rascunho.respostas[item.id]?.observacao.trim()}” · ${rascunho.fotos[item.id]?.length ?? 0} foto(s)`}
                  </span>
                </span>
                <Button variant="line" sm style={{ height: 36, fontSize: 13 }} onClick={() => aoAbrir(indiceDe(item))}>
                  Abrir
                </Button>
              </div>
            ))}
          </div>
        </>
      ) : (
        semResposta.length === 0 && (
          <Notice tone="ok" icon="check">
            <strong>Nenhum item eliminatório reprovado.</strong> Ao validar, a APR será aprovada: falta só a confirmação das assinaturas para liberar a execução.
          </Notice>
        )
      )}

      {naSemObservacao.length > 0 && (
        <>
          <Notice tone="al" icon="alert">
            <strong>NA exige observação.</strong> Explique o motivo em {naSemObservacao.length} {naSemObservacao.length > 1 ? "itens" : "item"}.
          </Notice>
          <div className="answered">
            {naSemObservacao.map((item) => (
              <div key={item.id} className="ans-row">
                <span className="n">{indiceDe(item) + 1}</span>
                <span className="t">{item.texto}</span>
                <Button variant="line" sm style={{ height: 36, fontSize: 13 }} onClick={() => aoAbrir(indiceDe(item))}>
                  Abrir
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      {alertas.length > 0 && (
        <Notice tone="al" icon="alert">
          <strong>
            {alertas.length} {alertas.length > 1 ? "alertas" : "alerta"}:
          </strong>{" "}
          fica registrado no PDF e no painel, mas não bloqueia.
        </Notice>
      )}

      <div className="card stack g8">
        <Field label="Observações (opcional)" htmlFor="obs-geral">
          <textarea
            className="textarea"
            id="obs-geral"
            rows={3}
            placeholder="Algo mais que precise ficar registrado nesta APR"
            value={rascunho.observacaoGeral}
            onChange={(evento) => aoObservarGeral(evento.target.value)}
          />
        </Field>
      </div>

      {bloqueando && euSemAssinatura && (
        <div className="card stack g8">
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Sua assinatura</h2>
          <CadastrarAssinatura aoSalvar={aoAssinaturaSalva} />
        </div>
      )}
      {bloqueando && outrosSemAssinatura.length > 0 && (
        <Notice tone="al" icon="alert">
          <strong>
            {outrosSemAssinatura.map((c) => c.nome).join(", ")} {outrosSemAssinatura.length > 1 ? "ainda não cadastraram" : "ainda não cadastrou"} a assinatura no perfil.
          </strong>{" "}
          Peça que cadastrem em Perfil, ou volte e desmarque quem não está presente.
        </Notice>
      )}

      {erro && (
        <Notice tone="blq" icon="alert">
          {erro}
        </Notice>
      )}

      <div className="nav2" style={{ maxWidth: 560 }}>
        <Button variant="line" onClick={aoVoltar} disabled={concluindo}>
          Voltar
        </Button>
        <Button variant="p" disabled={!resumo.completo || faltaAssinatura || concluindo} onClick={aoConcluir}>
          {concluindo ? "Enviando…" : "Concluir e validar"}
        </Button>
      </div>
      {!resumo.completo && (
        <p className="small">
          {semResposta.length > 0 && `Faltam respostas em ${semResposta.length} ${semResposta.length > 1 ? "itens" : "item"}. `}
          {semEvidencia.length > 0 && `Falta evidência em ${semEvidencia.length} item(ns). `}
          {naSemObservacao.length > 0 && `Falta observação em ${naSemObservacao.length} item(ns) com NA.`}
        </p>
      )}
    </>
  );
}
