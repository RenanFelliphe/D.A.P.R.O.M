"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AssinaturaCard, type LinhaDeAssinatura } from "@/components/app/aprovada/AssinaturaCard";
import { CabecalhoPagina, Colunas, PainelAcoes } from "@/components/app/AppChrome";
import { EtapasApr } from "@/components/app/nova-apr/EtapasApr";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { PontosGanhos } from "@/components/web/gamificacao/PontosGanhos";
import { estaTravada, montarPayload, resumoDe, retirarParticipante, type Colega, type RascunhoApr } from "@/lib/apr";
import { enviarEvento, ErroCliente, ErroDeEvento } from "@/lib/cliente-api";
import { dataHora } from "@/lib/formatar";
import type { RespostaComPontos } from "@/lib/gamificacao";
import { rotas } from "@/lib/rotas";
import type { OsStatus } from "@/lib/tipos";
import { useRascunhoApr } from "@/state/rascunho-apr";

/** A APR que a `api` já registrou (aprovada, de hoje, sem execução). */
export interface AprRegistrada {
  modelo: { codigo: string; versao: number };
  concluidaEm: string;
  itens: number;
  participantes: { usuarioId: string; nome: string; funcao: "responsavel" | "executor"; assinaturaPath: string; assinadaEm: string }[];
}

interface AprovadaScreenProps {
  os: { id: string; rotulo: string; titulo: string; local: string; status: OsStatus };
  usuarioId: string;
  colegas: Colega[];
  registrada: AprRegistrada | null;
}

function mensagemDeErro(erro: unknown) {
  if (erro instanceof ErroDeEvento) return erro.situacao === "pendente" ? `${erro.message}. Tente de novo em instantes.` : erro.message;
  if (erro instanceof ErroCliente) return erro.message;
  return "Não foi possível registrar a APR. Tente de novo.";
}

/**
 * APR aprovada. Enquanto o evento não foi enviado, cada participante confirma a assinatura do perfil; ao confirmar o
 * último, a APR é registrada (`apr_concluida`) e a execução é liberada.
 */
export function AprovadaScreen({ os, usuarioId, colegas, registrada: doServidor }: AprovadaScreenProps) {
  const roteador = useRouter();
  const { rascunho, atualizar, descartar } = useRascunhoApr(os.id, usuarioId);
  const [recemRegistrada, setRecemRegistrada] = useState<AprRegistrada | null>(null);
  const [pontos, setPontos] = useState<RespostaComPontos | null>(null);
  const [minhaAssinatura, setMinhaAssinatura] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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

  const registrada = recemRegistrada ?? (rascunho?.concluidaEm ? null : doServidor);
  // Só a APR que a `api` aprovou chega às assinaturas; a reprovada fica no checklist, pedindo a evidência.
  const pendente = !registrada && rascunho && rascunho.concluidaEm && rascunho.avaliacao?.resultado === "aprovada" ? rascunho : null;

  if (!registrada && !pendente) {
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
                : "Termine o checklist e use “Concluir e validar” para chegar às assinaturas."}
          </span>
          <div>
            <LinkButton variant="p" href={rascunho ? rotas.app.checklist(os.id) : rotas.app.os(os.id)}>
              {rascunho ? "Continuar APR" : "Voltar à OS"}
            </LinkButton>
          </div>
        </div>
      </Screen>
    );
  }

  const assinaturaDe = (c: Colega) => (c.id === usuarioId ? (minhaAssinatura ?? c.assinatura_path) : c.assinatura_path);

  const linhas: LinhaDeAssinatura[] = registrada
    ? registrada.participantes.map((p) => ({ usuarioId: p.usuarioId, nome: p.nome, funcao: p.funcao, assinaturaPath: p.assinaturaPath, assinadaEm: p.assinadaEm, eu: p.usuarioId === usuarioId }))
    : pendente!.participantes.map((p) => {
        const colega = colegas.find((c) => c.id === p.usuarioId);
        return {
          usuarioId: p.usuarioId,
          nome: colega?.nome ?? "Participante",
          funcao: p.funcao,
          assinaturaPath: colega ? assinaturaDe(colega) : null,
          assinadaEm: pendente!.assinaturas[p.usuarioId] ?? null,
          eu: p.usuarioId === usuarioId,
        };
      });

  const resumo = pendente ? resumoDe(pendente) : null;
  const itens = registrada ? registrada.itens : resumo!.perguntas.length;
  const modelo = registrada ? registrada.modelo : pendente!.modelo;
  const todasConfirmadas = linhas.length > 0 && linhas.every((l) => l.assinadaEm !== null);

  async function registrar(r: RascunhoApr) {
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await enviarEvento({ id: r.eventoId, tipo: "apr_concluida", os_id: os.id, payload: montarPayload(r) });
      const resultado = (resposta.aprs.find((a) => a.id === r.aprId) ?? resposta.aprs[0])?.resultado;
      setPontos(resposta);
      descartar();
      if (resultado === "bloqueada") {
        // A `api` é quem decide: se ela bloqueou, vale o impedimento.
        roteador.push(rotas.app.bloqueio(os.id));
        return;
      }
      const resumoAtual = resumoDe(r);
      setRecemRegistrada({
        modelo: { codigo: r.modelo.codigo, versao: r.modelo.versao },
        concluidaEm: r.concluidaEm ?? new Date().toISOString(),
        itens: resumoAtual.perguntas.length,
        participantes: r.participantes.map((p) => {
          const colega = colegas.find((c) => c.id === p.usuarioId);
          return { usuarioId: p.usuarioId, nome: colega?.nome ?? "Participante", funcao: p.funcao, assinaturaPath: (colega && assinaturaDe(colega)) ?? "", assinadaEm: r.assinaturas[p.usuarioId] ?? new Date().toISOString() };
        }),
      });
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  function confirmar(id: string) {
    const r = pendente!;
    const novo: RascunhoApr = { ...r, assinaturas: { ...r.assinaturas, [id]: new Date().toISOString() } };
    atualizar(() => novo);
    if (novo.participantes.every((p) => novo.assinaturas[p.usuarioId])) void registrar(novo);
  }

  function retirar(id: string) {
    const novo = retirarParticipante(pendente!, id);
    atualizar(() => novo);
    // Se quem sobrou já tinha confirmado, a APR está completa.
    if (novo.participantes.length > 0 && novo.participantes.every((p) => novo.assinaturas[p.usuarioId])) void registrar(novo);
  }

  function voltarAoChecklist() {
    atualizar((atual) => ({ ...atual, concluidaEm: null, assinaturas: {}, avaliacao: null }));
    roteador.push(rotas.app.checklist(os.id));
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
            {registrada ? ` · registrada em ${dataHora(registrada.concluidaEm)}` : ""}.
          </p>
        </div>
      </div>
      {erro && (
        <Notice tone="blq" icon="alert">
          {erro}
        </Notice>
      )}
      <Colunas
        principal={
          <section className="stack g8" data-treino="assinaturas">
            <h2>Assinaturas</h2>
            <div className="nav2">
              {linhas.map((linha) => (
                <AssinaturaCard
                  key={linha.usuarioId}
                  linha={linha}
                  ocupado={enviando}
                  somenteLeitura={Boolean(registrada)}
                  aoConfirmar={() => confirmar(linha.usuarioId)}
                  aoRetirar={() => retirar(linha.usuarioId)}
                  aoCadastrar={setMinhaAssinatura}
                />
              ))}
            </div>
          </section>
        }
        lateral={
          <PainelAcoes>
            {registrada ? (
              <>
                <Notice tone="ok" icon="lock">
                  <strong>{os.rotulo} liberada para execução.</strong> A APR vale só para esta OS e para hoje. Para outra OS, outra APR.
                </Notice>
                <PontosGanhos resposta={pontos} />
              </>
            ) : (
              <Notice tone="info" icon="info">
                {enviando
                  ? "Registrando a APR…"
                  : "Cada participante confirma a assinatura do perfil. Quando todos confirmarem, a APR é registrada e a execução é liberada."}
              </Notice>
            )}
            {registrada ? (
              <LinkButton variant="p" block href={rotas.app.execucao(os.id)} data-treino="iniciar-execucao">
                <Icon name="play" size={18} fill />
                Iniciar execução · {os.rotulo}
              </LinkButton>
            ) : (
              <>
                {erro && todasConfirmadas && (
                  <Button variant="p" block disabled={enviando} onClick={() => void registrar(pendente!)}>
                    Tentar registrar de novo
                  </Button>
                )}
                <Button variant="p" block disabled>
                  <Icon name="play" size={18} fill />
                  Iniciar execução · {os.rotulo}
                </Button>
                <Button variant="ghost" sm block disabled={enviando} onClick={voltarAoChecklist}>
                  Voltar ao checklist
                </Button>
              </>
            )}
          </PainelAcoes>
        }
      />
    </Screen>
  );
}
