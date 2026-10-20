"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Colunas, PainelAcoes, Trilha } from "@/components/app/AppChrome";
import { AssinarConferencia } from "@/components/app/conferencia/AssinarConferencia";
import { CampoDaConferenciaCard } from "@/components/app/conferencia/CampoDaConferencia";
import { EtapasDaConferencia } from "@/components/app/conferencia/EtapasDaConferencia";
import { FecharConferencia } from "@/components/app/conferencia/FecharConferencia";
import { VitoriaDaConferencia } from "@/components/app/conferencia/VitoriaDaConferencia";
import { Recolhivel } from "@/components/app/detalhe/Recolhivel";
import { AtualizarSozinha } from "@/components/app/execucao/AtualizarSozinha";
import { useAcao } from "@/components/app/execucao/useAcao";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { JanelaSobreposta } from "@/components/ui/JanelaSobreposta";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { ErroDeEnvio } from "@/components/ui/useFormulario";
import { chamar } from "@/lib/cliente-api";
import {
  EXPLICACAO_DA_TOLERANCIA,
  ROTULO_DO_ESTADO_DA_CONFERENCIA,
  ROTULO_DO_RESULTADO,
  ROTULO_DO_TIPO_DA_CONFERENCIA,
  acaoDaTela,
  camposParaEscolher,
  conferenciaAnda,
  descreverOpcao,
  escolhaEfetiva,
  escolhasParaEnviar,
  passoDaConferencia,
  ressalvasDaConferencia,
  separarCampos,
  situacaoDoParticipante,
  textoDaEscolha,
  type ConferenciaDaApi,
} from "@/lib/conferencia";
import { dataHora, hora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { useToast } from "@/state/toast";

/** De quanto em quanto tempo a tela relê a conferência (os outros sincronizam, escolhem e assinam em outros aparelhos). */
const RELER_A_CADA_MS = 15_000;

interface Props {
  conferencia: ConferenciaDaApi;
  /** "Fecha sozinha em 3 dias" (calculado no servidor), ou `null` quando já terminou. */
  prazo: string | null;
}

const tomDoEstado = { aguardando_sincronizacao: "al", aguardando_responsavel: "al", aguardando_assinaturas: "info", concluida: "ok", fechada_sem_todos: "info" } as const;
const iconeDoEstado = { aguardando_sincronizacao: "refresh", aguardando_responsavel: "pencil", aguardando_assinaturas: "clip", concluida: "check", fechada_sem_todos: "lock" } as const;
const seloDoEstado = { aguardando_sincronizacao: "al", aguardando_responsavel: "al", aguardando_assinaturas: "lib", concluida: "enc", fechada_sem_todos: "neu" } as const;

/**
 * A conferência da execução (execução compartilhada, etapa 3): o que cada aparelho registrou sem sinal, lado a lado. Quem decide marca a
 * versão certa de cada diferença (já pré-marcada com o padrão sugerido) e confirma numa janela; os demais dão a ciência ou assinam, com
 * ressalva opcional; depois de 72 horas quem decide pode fechar com o que existe. A página relê a conferência sozinha (`AtualizarSozinha`).
 */
export function ConferenciaScreen({ conferencia: c, prazo }: Props) {
  const router = useRouter();
  const exibirAviso = useToast();
  const { ocupado, erro, limparErro, executar } = useAcao();
  /** O que a pessoa trocou do padrão (ou da escolha já gravada): só os campos que ela mexeu. */
  const [trocas, setTrocas] = useState<Record<string, string>>({});
  const [confirmando, setConfirmando] = useState(false);

  const passo = passoDaConferencia(c);
  const acao = acaoDaTela(c);
  const { divergentes, conferem } = separarCampos(c.campos);
  const paraEscolher = camposParaEscolher(c);
  const idsParaEscolher = new Set(paraEscolher.map((campo) => campo.campo));
  const envio = escolhasParaEnviar(c, trocas);
  const ressalvas = ressalvasDaConferencia(c);
  const podeAssinar = c.eu.deve_assinar && c.estado === "aguardando_assinaturas";
  const numeroDaOs = c.os.numero_ordem ? `OS ${c.os.numero_ordem}` : "OS sem número";

  const confirmar = () =>
    executar(async () => {
      await chamar("POST", `/conferencias/${c.id}/decidir`, { escolhas: envio });
      setTrocas({});
      setConfirmando(false);
      exibirAviso("Escolhas registradas");
      router.refresh();
    });

  const camposDaTela = (lista: typeof c.campos) =>
    lista.map((campo) => (
      <CampoDaConferenciaCard
        key={campo.campo}
        conferencia={c}
        campo={campo}
        podeEscolher={idsParaEscolher.has(campo.campo)}
        marcada={escolhaEfetiva(c, campo, trocas)}
        aoMarcar={(escolha) => setTrocas((atuais) => ({ ...atuais, [campo.campo]: escolha }))}
        desabilitado={ocupado}
      />
    ));

  const principal = (
    <>
      <Notice tone={tomDoEstado[c.estado]} icon={iconeDoEstado[c.estado]} role="status">
        <strong>{passo.titulo}.</strong> {passo.texto}
        {prazo && (
          <>
            <br />
            <span className="small">{prazo}.</span>
          </>
        )}
      </Notice>
      <VitoriaDaConferencia />

      {c.campos.length === 0 ? (
        <div className="panel">
          <h2>O que cada aparelho registrou</h2>
          <p className="muted">
            {c.estado === "aguardando_sincronizacao"
              ? "As versões aparecem aqui assim que todos sincronizarem."
              : "Esta conferência não guardou diferenças para comparar."}
          </p>
        </div>
      ) : (
        <>
          {divergentes.length > 0 && (
            <section className="panel" aria-label="Diferenças entre os aparelhos" data-treino="conferencia-diferencas">
              <div className="stack g6">
                <h2>{paraEscolher.length > 0 ? "Escolha a versão certa de cada diferença" : "O que os aparelhos registraram de jeitos diferentes"}</h2>
                <p className="muted">
                  {paraEscolher.length > 0
                    ? "Já deixamos marcado o padrão sugerido. Troque onde a versão certa for outra e confirme."
                    : "Cada cartão mostra o que cada aparelho registrou. Quem decide escolhe a versão que vale."}
                </p>
              </div>
              {camposDaTela(divergentes)}
              {paraEscolher.length > 0 && (
                <div className="stack g8">
                  <ErroDeEnvio mensagem={confirmando ? null : (erro?.mensagem ?? null)} />
                  <div className="row g8 wrap">
                    <Button
                      variant="p"
                      onClick={() => {
                        limparErro();
                        setConfirmando(true);
                      }}
                      disabled={ocupado || envio.length === 0}
                      data-treino="conferencia-confirmar"
                    >
                      <Icon name="check" size={18} />
                      Confirmar escolhas
                    </Button>
                    <span className="small muted">
                      {paraEscolher.length === 1 ? "1 escolha sua" : `${paraEscolher.length} escolhas suas`} · o resto fica com {c.responsavel ? "quem decide" : "o responsável ou o supervisor"}.
                    </span>
                  </div>
                </div>
              )}
            </section>
          )}
          {conferem.length > 0 && (
            <section className="card stack g6" aria-label="O que confere">
              <h2 style={{ fontSize: 15, fontWeight: 600 }}>{divergentes.length > 0 ? "O que os aparelhos concordam" : "Os aparelhos registraram o mesmo"}</h2>
              <div>
                {conferem.map((campo) => (
                  <div key={campo.campo} className="cf-confere">
                    <strong>{campo.rotulo}</strong>
                    <span>{campo.opcoes[0] ? descreverOpcao(campo.campo, campo.opcoes[0]) : "—"}</span>
                    <Badge tone="enc">Confere</Badge>
                  </div>
                ))}
              </div>
              <span className="small muted">{EXPLICACAO_DA_TOLERANCIA}</span>
            </section>
          )}
        </>
      )}

      {(c.estado === "concluida" || c.estado === "fechada_sem_todos") && (
        <div className="stack g8">
          <LinkButton variant="line" href={rotas.app.os(c.os.id)}>
            Voltar para a OS
          </LinkButton>
        </div>
      )}
    </>
  );

  const lateral = (
    <>
      <PainelAcoes titulo="O que fazer agora">
        {acao === "escolher" && (
          <Notice tone="al" icon="pencil">
            <strong>A escolha é sua.</strong> Marque a versão certa de cada diferença ao lado e confirme.
          </Notice>
        )}
        {podeAssinar && <AssinarConferencia conferencia={c} />}
        {c.eu.pode_fechar && <FecharConferencia conferencia={c} />}
        {acao === "acompanhar" && !podeAssinar && !c.eu.pode_fechar && (
          <div className="row g8 small">
            <Icon name={c.estado === "concluida" || c.estado === "fechada_sem_todos" ? "check" : "clock"} size={16} />
            {c.estado === "concluida" || c.estado === "fechada_sem_todos" ? "Nada mais a fazer." : "Nada a fazer por enquanto: você é avisado quando for a sua vez."}
          </div>
        )}
        <LinkButton variant="ghost" block href={rotas.app.os(c.os.id)}>
          Voltar para a OS
        </LinkButton>
      </PainelAcoes>

      <section className="panel" aria-label="Equipe da conferência">
        <h2>Equipe</h2>
        <div>
          {c.participantes.map((p) => {
            const s = situacaoDoParticipante(p, c.responsavel?.id ?? null);
            return (
              <div key={p.usuario.id} className="cf-pessoa">
                <div className="cf-pessoa-linha">
                  <strong>{p.usuario.nome}</strong>
                  <Badge tone={s.tom}>{s.sincronia}</Badge>
                </div>
                <span className="small">{s.assinatura}{p.assinatura ? ` · ${dataHora(p.assinatura.assinada_em)}` : ""}</span>
              </div>
            );
          })}
        </div>
        {ressalvas.length > 0 && (
          <div className="stack g8">
            <span className="lbl">Ressalvas</span>
            {ressalvas.map((r) => (
              <p key={`${r.nome}-${r.quando}`} className="cf-ressalva">
                <strong>{r.nome}</strong> ({dataHora(r.quando)}): {r.ressalva}
              </p>
            ))}
          </div>
        )}
      </section>

      <Recolhivel titulo="Prazos" resumo={prazo ?? ROTULO_DO_ESTADO_DA_CONFERENCIA[c.estado]}>
        <div className="stack g6 small">
          <span>Aberta em {dataHora(c.criada_em)}</span>
          {c.responsavel && <span>Responsável pela conferência: {c.responsavel.nome}</span>}
          {conferenciaAnda(c) ? (
            <>
              <span>Quem decide pode fechar com o que existe a partir de {dataHora(c.libera_fechar_em)} (72 horas).</span>
              <span>Fecha sozinha em {dataHora(c.limite_em)} (7 dias), pelo padrão sugerido.</span>
            </>
          ) : (
            c.fechada_em && (
              <span>
                {c.fechada_por ? `Fechada por ${c.fechada_por.nome}` : "Fechada pelo prazo de 7 dias"} em {dataHora(c.fechada_em)}.
              </span>
            )
          )}
        </div>
      </Recolhivel>

      {c.versoes.length > 0 && (
        <Recolhivel titulo="Registro de cada aparelho" resumo={`${c.versoes.length} ${c.versoes.length === 1 ? "versão" : "versões"}`}>
          {c.versoes.map((v) => (
            <div key={v.autor_id} className="cf-versao">
              <strong>{v.autor_nome}</strong>
              <span>
                Início {v.inicio ? hora(v.inicio) : "—"} · fim {v.fim ? hora(v.fim) : "—"}
                {v.resultado ? ` · ${ROTULO_DO_RESULTADO[v.resultado]}` : ""}
              </span>
              <span className="muted">
                {v.pausas.length === 0 ? "Sem pausas" : `${v.pausas.length} ${v.pausas.length === 1 ? "pausa" : "pausas"}`} · {v.evidencias} {v.evidencias === 1 ? "foto ou PDF" : "fotos e PDFs"}
                {v.sem_sinal ? " · registrou sem sinal" : ""}
              </span>
            </div>
          ))}
        </Recolhivel>
      )}
    </>
  );

  return (
    <Screen className="cf-pagina">
      <Trilha passos={[{ rotulo: "OS da equipe", href: rotas.app.lista }, { rotulo: numeroDaOs, href: rotas.app.os(c.os.id) }, { rotulo: "Conferência" }]} />
      <div className="stack g6">
        <div className="cf-titulo">
          <h1>Conferência da execução</h1>
          <Badge tone={seloDoEstado[c.estado]}>{ROTULO_DO_ESTADO_DA_CONFERENCIA[c.estado]}</Badge>
          {c.tipo && <Badge tone="neu">{ROTULO_DO_TIPO_DA_CONFERENCIA[c.tipo]}</Badge>}
        </div>
        <span className="muted">
          <span className="mono">{numeroDaOs}</span> · {c.os.titulo}
        </span>
      </div>
      <EtapasDaConferencia conferencia={c} />
      <Colunas principal={principal} lateral={lateral} />

      {confirmando && (
        <JanelaSobreposta titulo="Confirmar as escolhas" aoFechar={ocupado ? () => undefined : () => setConfirmando(false)} dataTreino="conferencia-janela">
          <div className="stack g12">
            <p>Estas versões passam a valer na execução. Os outros participantes assinam em seguida.</p>
            <ul className="cf-confirmacao">
              {envio.map((e) => {
                const campo = c.campos.find((x) => x.campo === e.campo)!;
                return (
                  <li key={e.campo}>
                    <strong>{campo.rotulo}</strong>
                    <span>{textoDaEscolha(campo, e.escolha)}</span>
                  </li>
                );
              })}
            </ul>
            <ErroDeEnvio mensagem={erro?.mensagem ?? null} />
            <div className="row g8 wrap">
              <Button variant="p" onClick={() => void confirmar()} disabled={ocupado} aria-busy={ocupado}>
                {ocupado ? "Registrando…" : "Confirmar escolhas"}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmando(false)} disabled={ocupado}>
                Voltar
              </Button>
            </div>
          </div>
        </JanelaSobreposta>
      )}

      {conferenciaAnda(c) && <AtualizarSozinha cadaMs={RELER_A_CADA_MS} />}
    </Screen>
  );
}
