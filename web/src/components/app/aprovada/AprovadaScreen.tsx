"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AssinaturaCard, type LinhaDeAssinatura } from "@/components/app/aprovada/AssinaturaCard";
import { JanelaDeRecusa } from "@/components/app/aprovada/JanelaDeRecusa";
import { CabecalhoPagina, Colunas, PainelAcoes } from "@/components/app/AppChrome";
import { useAcao } from "@/components/app/execucao/useAcao";
import { EtapasApr } from "@/components/app/nova-apr/EtapasApr";
import { JanelaDeAssinatura } from "@/components/ausencia/JanelaDeAssinatura";
import { AtualizacaoAutomatica } from "@/components/ui/AtualizacaoAutomatica";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { ErroDeEnvio } from "@/components/ui/useFormulario";
import { PontosGanhos } from "@/components/web/gamificacao/PontosGanhos";
import { estaTravada, montarPayload, resumoDe, type Colega } from "@/lib/apr";
import { enviarEvento } from "@/lib/cliente-api";
import { dataHora } from "@/lib/formatar";
import type { RespostaComPontos } from "@/lib/gamificacao";
import { situacaoDaApr, type AprDaOs } from "@/lib/os-app";
import { rotas } from "@/lib/rotas";
import { useMinhaAssinatura } from "@/state/minha-assinatura";
import { useRascunhoApr } from "@/state/rascunho-apr";

/** A APR que a `api` já registrou (aprovada, de hoje, sem execução), com o estado da assinatura de cada participante. */
export type AprRegistrada = Pick<AprDaOs, "id" | "concluida_em" | "modelo" | "participantes"> & { itens: number };

interface AprovadaScreenProps {
  os: { id: string; rotulo: string; titulo: string; local: string };
  usuarioId: string;
  /** A equipe da OS: só para dar nome aos participantes enquanto a APR validada ainda não foi registrada. */
  colegas: Colega[];
  registrada: AprRegistrada | null;
}

/**
 * APR aprovada. Depois de "Concluir e validar", a APR é registrada na hora (`apr_concluida`, sem assinaturas) e esta tela mostra o
 * estado de cada participante: assinou (com a hora), pendente ou recusou (com o motivo). Cada um assina na própria conta; a
 * pessoa logada, se ainda não assinou, assina ("Assinar a APR") ou recusa (direito de recusa, com motivo). A tela se atualiza
 * sozinha para ver os colegas assinando. A execução só começa quando todos que ficaram na APR assinaram; se a APR deixou de
 * servir (o responsável recusou, ou restaram menos de 2), a tela diz por quê e leva a uma APR nova.
 */
export function AprovadaScreen({ os, usuarioId, colegas, registrada }: AprovadaScreenProps) {
  const roteador = useRouter();
  const assinaturaPath = useMinhaAssinatura();
  const { rascunho, descartar } = useRascunhoApr(os.id, usuarioId);
  const { ocupado: registrando, erro: erroDoRegistro, executar } = useAcao();
  const [pontos, setPontos] = useState<RespostaComPontos | null>(null);
  const [janela, setJanela] = useState<"assinar" | "recusar" | null>(null);

  const cabecalho = (
    <CabecalhoPagina
      trilha={[
        { rotulo: "OS da equipe", href: rotas.app.lista },
        { rotulo: <span className="mono">{os.rotulo}</span>, href: rotas.app.os(os.id) },
        { rotulo: "Nova APR", href: rotas.app.apr(os.id) },
        { rotulo: "APR aprovada" },
      ]}
    >
      <h1>APR · {os.local}</h1>
      <span className="muted">
        <span className="mono">{os.rotulo}</span> · Etapa 3 de 3
      </span>
    </CabecalhoPagina>
  );

  if (rascunho === undefined) return <Screen>{cabecalho}</Screen>;

  // O rascunho aprovado cujo registro já chegou à `api` (o envio deu certo, mas a limpeza não): não é mais pendente.
  const jaRegistrado = Boolean(rascunho && registrada && registrada.id === rascunho.aprId);
  // Aprovada pela `api`, mas ainda não registrada (a conexão falhou ao registrar): falta só enviar.
  const pendente = rascunho && !jaRegistrado && rascunho.concluidaEm && rascunho.avaliacao?.resultado === "aprovada" ? rascunho : null;
  const apr = pendente ? null : registrada;

  if (!apr && !pendente) {
    return (
      <Screen>
        {cabecalho}
        <div className="card stack g8">
          <strong>
            {!rascunho ? "Não há APR aprovada aguardando assinaturas para esta OS." : estaTravada(rascunho) ? "Esta APR reprovou e já está registrada como bloqueada." : "Esta APR ainda não foi concluída."}
          </strong>
          <span className="muted">
            {!rascunho
              ? "Volte à OS para fazer uma APR nova ou ver as anteriores."
              : estaTravada(rascunho)
                ? "Falta anexar a evidência dos itens reprovados, no checklist."
                : "Termine o checklist e use “Concluir e validar” para registrar a APR."}
          </span>
          <div>
            <LinkButton variant="p" href={rascunho ? rotas.app.checklist(os.id) : rotas.app.os(os.id)}>
              {rascunho ? "Continuar APR" : "Voltar à OS"}
            </LinkButton>
          </div>
        </div>
        <AtualizacaoAutomatica aCadaMs={10_000} />
      </Screen>
    );
  }

  const linhas: LinhaDeAssinatura[] = apr
    ? apr.participantes.map((p) => ({
        usuarioId: p.usuario_id,
        nome: p.nome,
        funcao: p.funcao,
        assinaturaPath: p.assinatura_path,
        assinadaEm: p.assinada_em,
        presencial: p.assinatura_presencial,
        recusouEm: p.recusou_em,
        recusaMotivo: p.recusa_motivo,
        eu: p.usuario_id === usuarioId,
      }))
    : pendente!.participantes.map((p) => ({
        usuarioId: p.usuarioId,
        nome: colegas.find((c) => c.id === p.usuarioId)?.nome ?? "Participante",
        funcao: p.funcao,
        assinaturaPath: null,
        assinadaEm: null,
        eu: p.usuarioId === usuarioId,
      }));

  const itens = apr ? apr.itens : resumoDe(pendente!).perguntas.length;
  const modelo = apr ? apr.modelo : pendente!.modelo;
  const situacao = apr ? situacaoDaApr(apr) : null;
  const minha = apr?.participantes.find((p) => p.usuario_id === usuarioId);
  const euAssinei = Boolean(minha?.assinada_em);
  const euRecusei = Boolean(minha?.recusou_em);
  const faltam = situacao?.faltam.map((p) => p.nome) ?? [];

  /** Só falta enviar: a APR validada vai para a `api`, que a registra sem assinaturas. */
  const registrar = () =>
    executar(async () => {
      const r = pendente!;
      const resposta = await enviarEvento({ id: r.eventoId, tipo: "apr_concluida", os_id: os.id, payload: montarPayload(r) });
      const resultado = (resposta.aprs.find((a) => a.id === r.aprId) ?? resposta.aprs[0])?.resultado;
      descartar();
      // A `api` é quem decide: se ela bloqueou, vale o impedimento.
      if (resultado === "bloqueada") roteador.push(rotas.app.bloqueio(os.id));
      else roteador.refresh();
    });

  async function assinar() {
    const resposta = await enviarEvento({ tipo: "apr_assinada", os_id: os.id, payload: { apr_id: apr!.id, assinada_em: new Date().toISOString() } });
    setPontos(resposta);
  }

  async function recusar(motivo: string) {
    await enviarEvento({ tipo: "apr_recusada", os_id: os.id, payload: { apr_id: apr!.id, motivo, recusada_em: new Date().toISOString() } });
    setJanela(null);
    roteador.refresh();
  }

  function voltarAoChecklist() {
    descartar();
    roteador.push(rotas.app.apr(os.id));
  }

  return (
    <Screen>
      {cabecalho}
      <EtapasApr atual={2} />
      <div className="res-banner rb-ok" data-treino="apr-resultado">
        <span className="ic">
          <Icon name="check" size={24} />
        </span>
        <div className="stack g4">
          <h2>APR aprovada</h2>
          <p>
            {itens} de {itens} itens respondidos · {modelo.codigo} v{modelo.versao}
            {apr ? ` · registrada em ${dataHora(apr.concluida_em)}` : ""}.
          </p>
        </div>
      </div>
      {pendente && <ErroDeEnvio mensagem={erroDoRegistro?.mensagem ?? null} />}
      {situacao?.inviavel && (
        <Notice tone="blq" icon="octagon">
          <strong>Esta APR não serve mais.</strong> {situacao.motivoInviavel} Faça uma APR nova para executar a OS.
        </Notice>
      )}
      <Colunas
        principal={
          <section className="stack g8" data-treino="assinaturas">
            <h2>Assinaturas</h2>
            <p className="muted">
              Todos os participantes assinam a APR, cada um na própria conta, só agora, no começo. A execução começa quando todos que ficaram na APR tiverem assinado.
            </p>
            <div className="nav2" data-treino="apr-assinaturas-estado">
              {linhas.map((linha) => (
                <AssinaturaCard key={linha.usuarioId} linha={linha} />
              ))}
            </div>
          </section>
        }
        lateral={
          <PainelAcoes>
            {pendente ? (
              <>
                <Notice tone="al" icon="alert">
                  A APR foi aprovada, mas ainda não foi registrada no sistema (a conexão falhou). Registre para que cada participante receba o aviso e assine.
                </Notice>
                <Button variant="p" block disabled={registrando} aria-busy={registrando} onClick={() => void registrar()}>
                  {registrando ? "Registrando…" : "Registrar a APR"}
                </Button>
                <Button variant="ghost" sm block disabled={registrando} onClick={voltarAoChecklist}>
                  Descartar e fazer uma APR nova
                </Button>
              </>
            ) : situacao!.inviavel ? (
              <>
                <LinkButton variant="p" block href={rotas.app.apr(os.id)}>
                  Fazer uma APR nova
                </LinkButton>
                <LinkButton variant="line" sm block href={rotas.app.os(os.id)}>
                  Voltar à OS
                </LinkButton>
              </>
            ) : euRecusei ? (
              <>
                <Notice tone="info" icon="user">
                  <strong>Você recusou esta APR e saiu dela.</strong> O supervisor foi avisado. Os demais participantes seguem; se o responsável também recusar ou restarem menos de 2, será preciso uma APR nova.
                </Notice>
                <LinkButton variant="line" sm block href={rotas.app.os(os.id)}>
                  Voltar à OS
                </LinkButton>
              </>
            ) : (
              <>
                {!euAssinei && (
                  <>
                    <Notice tone="info" icon="clip">
                      <strong>Falta a sua assinatura.</strong> Você assina com a assinatura do seu perfil. Se não concorda com a APR, use o direito de recusa.
                    </Notice>
                    <Button variant="p" block onClick={() => setJanela("assinar")} data-treino="apr-assinar">
                      <Icon name="check" size={18} />
                      Assinar a APR
                    </Button>
                    <Button variant="od" block onClick={() => setJanela("recusar")} data-treino="apr-recusar">
                      Recusar a APR (direito de recusa)
                    </Button>
                  </>
                )}
                {euAssinei && <PontosGanhos resposta={pontos} />}
                {situacao!.pronta ? (
                  <>
                    <Notice tone="ok" icon="lock">
                      <strong>{os.rotulo} liberada para execução.</strong> Todos assinaram. A APR vale só para esta OS e para hoje. Para outra OS, outra APR.
                    </Notice>
                    <LinkButton variant="p" block href={rotas.app.execucao(os.id)} data-treino="iniciar-execucao">
                      <Icon name="play" size={18} fill />
                      Iniciar execução · {os.rotulo}
                    </LinkButton>
                  </>
                ) : (
                  euAssinei && (
                    <>
                      <Notice tone="info" icon="clock">
                        <strong>Você assinou.</strong> Falta a assinatura de {faltam.join(", ")}. A execução só pode ser iniciada quando todos assinarem; esta tela se atualiza sozinha.
                      </Notice>
                      <Button variant="p" block disabled>
                        <Icon name="play" size={18} fill />
                        Iniciar execução · {os.rotulo}
                      </Button>
                    </>
                  )
                )}
              </>
            )}
          </PainelAcoes>
        }
      />
      {janela === "assinar" && apr && (
        <JanelaDeAssinatura
          titulo="Assinar a APR"
          resumo={`Você assina a APR da ${os.rotulo} (${modelo.codigo} v${modelo.versao}), declarando que concorda com ela e está em condições de executar o serviço.`}
          rotuloConfirmar="Assinar a APR"
          assinaturaPath={assinaturaPath}
          aoConfirmar={assinar}
          aoFechar={() => setJanela(null)}
        />
      )}
      {janela === "recusar" && apr && <JanelaDeRecusa aoRecusar={recusar} aoFechar={() => setJanela(null)} />}
      <AtualizacaoAutomatica aCadaMs={10_000} />
    </Screen>
  );
}
