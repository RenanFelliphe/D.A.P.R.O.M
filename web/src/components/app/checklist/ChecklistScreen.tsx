"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PainelAcoes, Colunas } from "@/components/app/AppChrome";
import { ChecklistCabecalho } from "@/components/app/checklist/ChecklistCabecalho";
import { EvidenciaCard, ObservacaoNaCard } from "@/components/app/checklist/EvidenciaCard";
import { GradePerguntas } from "@/components/app/checklist/GradePerguntas";
import { NavegacaoChecklist } from "@/components/app/checklist/NavegacaoChecklist";
import { PerguntaCard } from "@/components/app/checklist/PerguntaCard";
import { ProgressoChecklist } from "@/components/app/checklist/ProgressoChecklist";
import { RevisaoApr } from "@/components/app/checklist/RevisaoApr";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import {
  abrirRevisao,
  adicionarFoto,
  avancar,
  estaReprovado,
  faltaEvidencia,
  faltaObservacaoNa,
  geraAlerta,
  irPara,
  montarPayload,
  observar,
  removerFoto,
  resultadoEsperado,
  resumoDe,
  responder,
  voltar,
  voltarDaRevisao,
  type Colega,
  type RascunhoApr,
  type Resposta,
} from "@/lib/apr";
import { enviarEvento, ErroCliente, ErroDeEvento, novoId } from "@/lib/cliente-api";
import { miniaturaDe, posicaoAtual } from "@/lib/foto-local";
import { rotas } from "@/lib/rotas";
import { useRascunhoApr } from "@/state/rascunho-apr";

interface ChecklistScreenProps {
  os: { id: string; rotulo: string; titulo: string; local: string };
  usuarioId: string;
  colegas: Colega[];
}

/** Texto para o usuário de qualquer falha ao enviar o evento. */
function mensagemDeErro(erro: unknown) {
  if (erro instanceof ErroDeEvento) return erro.situacao === "pendente" ? `${erro.message}. Tente de novo em instantes.` : erro.message;
  if (erro instanceof ErroCliente) return erro.message;
  return "Não foi possível enviar a APR. Tente de novo.";
}

/**
 * Checklist da APR: responde-se tudo, em qualquer ordem, e só se valida no fim. Mostra uma pergunta por vez (com a
 * evidência quando a resposta reprova) e a revisão final. O rascunho vive no navegador até a APR ser concluída.
 */
export function ChecklistScreen({ os, usuarioId, colegas }: ChecklistScreenProps) {
  const roteador = useRouter();
  const { rascunho, atualizar, descartar } = useRascunhoApr(os.id, usuarioId);
  const [minhaAssinatura, setMinhaAssinatura] = useState<string | null>(null);
  const [concluindo, setConcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const resumo = useMemo(() => (rascunho ? resumoDe(rascunho) : null), [rascunho]);
  const modo = rascunho?.modo;

  // Ao entrar na revisão (ou voltar dela), a página volta ao topo.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [modo]);

  if (rascunho === undefined) return <Screen>{null}</Screen>;
  if (rascunho === null || !resumo) {
    return (
      <Screen>
        <div className="card stack g8">
          <strong>{concluindo ? "Enviando a APR…" : "Não há APR em andamento para esta OS."}</strong>
          {!concluindo && (
            <>
              <span className="muted">Comece uma APR nova: escolha os participantes e os riscos da atividade.</span>
              <div>
                <LinkButton variant="p" href={rotas.app.apr(os.id)}>
                  Nova APR
                </LinkButton>
              </div>
            </>
          )}
        </div>
      </Screen>
    );
  }

  const r: RascunhoApr = rascunho;
  const total = resumo.perguntas.length;
  const indice = Math.min(r.indice, Math.max(0, total - 1));
  const item = resumo.perguntas[indice];
  const revisando = r.modo === "revisao" || !item;
  const resposta = item ? r.respostas[item.id] : undefined;
  const reprovada = item ? estaReprovado(item, resposta?.resposta) : false;
  const alerta = item ? geraAlerta(item, resposta?.resposta) : false;
  const risco = item?.risco_id ? r.modelo.riscos.find((x) => x.id === item.risco_id) : undefined;

  /** Qualquer mudança nas respostas invalida uma validação anterior (assinaturas confirmadas incluídas). */
  const alterar = (funcao: (atual: RascunhoApr) => RascunhoApr) => atualizar((atual) => ({ ...funcao(atual), concluidaEm: null, assinaturas: {} }));
  /** Navegar não muda a APR. */
  const navegar = atualizar;

  const assinaturaDe = (c: Colega) => (c.id === usuarioId ? (minhaAssinatura ?? c.assinatura_path) : c.assinatura_path);
  const participantes = r.participantes.map((p) => colegas.find((c) => c.id === p.usuarioId)).filter((c): c is Colega => Boolean(c));
  const semAssinatura = participantes.filter((c) => !assinaturaDe(c));
  const euSemAssinatura = semAssinatura.some((c) => c.id === usuarioId);

  function aoResponder(valor: Resposta) {
    if (!item) return;
    alterar((atual) => {
      const novo = responder(atual, item, valor);
      // Reprovada e NA pedem observação (e foto): ficam na pergunta; as demais seguem adiante.
      return estaReprovado(item, valor) || valor === "na" ? novo : avancar(novo);
    });
  }

  async function aoFotoEnviada(foto: { arquivoId: string; previa: string }) {
    if (!item) return;
    const itemId = item.id;
    const [miniatura, posicao] = await Promise.all([miniaturaDe(foto.previa), posicaoAtual()]);
    URL.revokeObjectURL(foto.previa);
    alterar((atual) => adicionarFoto(atual, itemId, { id: novoId(), arquivoId: foto.arquivoId, capturadaEm: new Date().toISOString(), miniatura, ...(posicao ?? {}) }));
  }

  async function concluir() {
    setErro(null);
    const esperado = resultadoEsperado(r);
    const agora = new Date().toISOString();
    if (esperado === "aprovada") {
      // Aprovada: antes de registrar, cada participante confirma a assinatura do perfil.
      atualizar((atual) => ({ ...atual, concluidaEm: agora, assinaturas: {} }));
      roteador.push(rotas.app.aprovada(os.id));
      return;
    }
    // Bloqueada: vale na hora (as assinaturas do papel não bloqueiam) e a OS fica pendente.
    setConcluindo(true);
    try {
      const resposta = await enviarEvento({
        id: r.eventoId,
        tipo: "apr_concluida",
        os_id: os.id,
        payload: montarPayload({ ...r, concluidaEm: agora }, "bloqueada"),
      });
      const resultado = (resposta.aprs.find((a) => a.id === r.aprId) ?? resposta.aprs[0])?.resultado;
      descartar();
      roteador.push(resultado === "aprovada" ? rotas.app.os(os.id) : rotas.app.bloqueio(os.id));
    } catch (e) {
      setErro(mensagemDeErro(e));
      setConcluindo(false);
    }
  }

  function descartarRascunho() {
    if (window.confirm("Descartar esta APR em andamento? As respostas e as fotos deste rascunho serão perdidas.")) {
      descartar();
      roteador.push(rotas.app.os(os.id));
    }
  }

  return (
    <Screen>
      <ChecklistCabecalho os={os} modelo={r.modelo} />
      <ProgressoChecklist
        titulo={revisando ? `Revisão · ${resumo.respondidas} de ${total}` : `Pergunta ${indice + 1} de ${total}`}
        secao={revisando ? "Antes de validar" : (risco ? `Medida preventiva · ${risco.nome}` : "Verificação")}
        respondidas={resumo.respondidas}
        total={total}
      />
      <Colunas
        principal={
          revisando ? (
            <RevisaoApr
              rascunho={r}
              resumo={resumo}
              esperado={resultadoEsperado(r)}
              semAssinatura={semAssinatura}
              euSemAssinatura={euSemAssinatura}
              aoAbrir={(i) => navegar((atual) => irPara(atual, i))}
              aoVoltar={() => navegar(voltarDaRevisao)}
              aoObservarGeral={(texto) => alterar((atual) => ({ ...atual, observacaoGeral: texto }))}
              aoAssinaturaSalva={setMinhaAssinatura}
              aoConcluir={concluir}
              concluindo={concluindo}
              erro={erro}
            />
          ) : (
            <>
              <PerguntaCard numero={indice + 1} item={item} resposta={resposta?.resposta} aoResponder={aoResponder} />
              {alerta && (
                <Notice tone="al" icon="alert">
                  <strong>Alerta registrado.</strong> Esta resposta não bloqueia a atividade, mas aparece no PDF e no painel.
                </Notice>
              )}
              {reprovada && (
                <EvidenciaCard
                  item={item}
                  observacao={resposta?.observacao ?? ""}
                  fotos={r.fotos[item.id] ?? []}
                  aoObservar={(texto) => alterar((atual) => observar(atual, item.id, texto))}
                  aoFotoEnviada={aoFotoEnviada}
                  aoRemoverFoto={(fotoId) => alterar((atual) => removerFoto(atual, item.id, fotoId))}
                  aoErroDeFoto={setErro}
                />
              )}
              {resposta?.resposta === "na" && <ObservacaoNaCard observacao={resposta.observacao} aoObservar={(texto) => alterar((atual) => observar(atual, item.id, texto))} />}
              {erro && (
                <Notice tone="blq" icon="alert">
                  {erro}
                </Notice>
              )}
              <NavegacaoChecklist
                indice={indice}
                total={total}
                podeAvancar={resposta !== undefined}
                aoVoltar={() => navegar(voltar)}
                aoAvancar={() => navegar(avancar)}
              />
            </>
          )
        }
        lateral={
          <>
            {!revisando && (
              <GradePerguntas
                total={total}
                atual={indice}
                respondida={(i) => r.respostas[resumo.perguntas[i]!.id] !== undefined}
                pendente={(i) => faltaEvidencia(r, resumo.perguntas[i]!) || faltaObservacaoNa(r, resumo.perguntas[i]!)}
                aoSelecionar={(i) => navegar((atual) => irPara(atual, i))}
              />
            )}
            <PainelAcoes>
              <div className="row g8 small" style={{ alignItems: "flex-start" }}>
                <Icon name="save" size={16} style={{ marginTop: 2 }} />
                Rascunho salvo neste navegador. Se a página fechar, você continua daqui; nada é enviado até concluir.
              </div>
              <div className="stack g8">
                {!revisando && (
                  <Button variant="line" sm block onClick={() => navegar(abrirRevisao)} data-treino="ck-revisar">
                    Ir para a revisão
                  </Button>
                )}
                <LinkButton variant="line" sm block href={rotas.app.os(os.id)}>
                  Sair e continuar depois
                </LinkButton>
                <Button variant="ghost" sm block onClick={descartarRascunho}>
                  Descartar esta APR
                </Button>
              </div>
            </PainelAcoes>
          </>
        }
      />
    </Screen>
  );
}
