"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Colunas, PainelAcoes } from "@/components/app/AppChrome";
import { EtapasApr } from "@/components/app/nova-apr/EtapasApr";
import { JanelaDeModelos } from "@/components/app/nova-apr/JanelaDeModelos";
import { ModeloAprCard } from "@/components/app/nova-apr/ModeloAprCard";
import { OsDaAprCard } from "@/components/app/nova-apr/OsDaAprCard";
import { ParticipantesApr } from "@/components/app/nova-apr/ParticipantesApr";
import { RiscosApr } from "@/components/app/nova-apr/RiscosApr";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { MensagemDeErro } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { ErroDeEnvio, useFormulario, useValorDoForm } from "@/components/ui/useFormulario";
import {
  avisoAoDescartar,
  continuaNasAssinaturas,
  doModeloCompleto,
  estaTravada,
  MIN_PARTICIPANTES,
  novoRascunho,
  riscosEquivalentes,
  totalDePerguntas,
  type Colega,
  type EscolhaDoModelo,
  type Funcao,
  type ModeloCompleto,
} from "@/lib/apr";
import { rotas } from "@/lib/rotas";
import { chamar, ErroCliente } from "@/lib/cliente-api";
import { gravarRascunho, useRascunhoApr } from "@/state/rascunho-apr";

interface NovaAprScreenProps {
  /** `reservada`: o supervisor reservou a OS a quem está aplicando a APR, que é o responsável e não o troca. */
  os: { id: string; rotulo: string; titulo: string; local: string; reservada?: boolean };
  usuarioId: string;
  colegas: Colega[];
  /** Os modelos publicados, com a orientação e o recomendado pela leitura da OS (`GET /os/{id}/modelos-apr`). */
  escolha: EscolhaDoModelo;
}

/**
 * Etapa 1 da APR: o modelo, os participantes (a equipe da OS) e os riscos da atividade. Cada APR nasce vazia. O modelo é
 * sempre o técnico quem escolhe: a janela de escolha abre ao entrar, com o recomendado em destaque, e o modelo pode ser
 * trocado depois (aqui e no checklist).
 */
export function NovaAprScreen({ os, usuarioId, colegas, escolha }: NovaAprScreenProps) {
  const roteador = useRouter();
  const { rascunho, descartar } = useRascunhoApr(os.id, usuarioId);

  const [modelo, setModelo] = useState<ModeloCompleto | null>(null);
  /** `auto`: abre sozinha enquanto não há modelo escolhido. */
  const [janela, setJanela] = useState<"auto" | "aberta" | "fechada">("auto");
  const [carregandoModelo, setCarregandoModelo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [responsavelId, setResponsavelId] = useState(usuarioId);
  const [riscos, setRiscos] = useState<string[]>([]);

  // Eu primeiro, depois a equipe por nome (a `api` já ordena por nome).
  const equipe = useMemo(() => [...colegas].sort((a, b) => Number(b.id === usuarioId) - Number(a.id === usuarioId)), [colegas, usuarioId]);

  // A APR exige ao menos 2 participantes e um modelo escolhido. O botão não fica desativado: faltando algo, a mensagem aparece junto do que falta.
  const esquema = useMemo(
    () =>
      z.object({
        modelo: z.string().min(1, "Escolha o modelo da APR antes de começar o checklist."),
        participantes: z
          .array(z.string())
          .min(
            MIN_PARTICIPANTES,
            equipe.length < MIN_PARTICIPANTES
              ? "Não dá para iniciar a APR: só há 1 pessoa disponível na equipe, e ninguém executa o serviço sozinho."
              : `Marque ao menos mais um colega: a APR precisa de pelo menos ${MIN_PARTICIPANTES} participantes, porque ninguém executa o serviço sozinho.`,
          ),
      }),
    [equipe.length],
  );
  const { form, ref, enviar, erroEnvio } = useFormulario(esquema, { modelo: "", participantes: [usuarioId] });
  const [marcados, setMarcados] = useValorDoForm(form, "participantes");
  const [, setModeloEscolhido] = useValorDoForm(form, "modelo");
  const erros = form.formState.errors;
  const janelaAberta = rascunho === null && (janela === "aberta" || (janela === "auto" && !modelo));

  /** Carrega a versão publicada mais recente do modelo escolhido; na troca, os riscos de mesmo nome continuam marcados. */
  async function escolherModelo(codigo: string) {
    setErro(null);
    setCarregandoModelo(codigo);
    try {
      const completo = await chamar<ModeloCompleto>("GET", `/modelos-apr/${encodeURIComponent(codigo)}/versoes/publicada`);
      setRiscos((atuais) => (modelo ? riscosEquivalentes(doModeloCompleto(modelo), atuais, doModeloCompleto(completo)) : []));
      setModelo(completo);
      setModeloEscolhido(completo.codigo);
      setJanela("fechada");
    } catch (e) {
      setErro(e instanceof ErroCliente ? e.message : "Não foi possível carregar o modelo.");
    } finally {
      setCarregandoModelo(null);
    }
  }

  function alternarParticipante(id: string) {
    if (id === usuarioId) return;
    setMarcados((atuais) => (atuais.includes(id) ? atuais.filter((m) => m !== id) : [...atuais, id]));
    if (id === responsavelId) setResponsavelId(usuarioId);
  }

  function alternarRisco(id: string) {
    setRiscos((atuais) => (atuais.includes(id) ? atuais.filter((r) => r !== id) : [...atuais, id]));
  }

  const total = modelo ? totalDePerguntas(doModeloCompleto(modelo), riscos) : 0;

  const comecar = enviar(() => {
    if (!modelo) return;
    const participantes = marcados.map((id) => ({ usuarioId: id, funcao: (id === responsavelId ? "responsavel" : "executor") as Funcao }));
    gravarRascunho(novoRascunho({ osId: os.id, usuarioId, modelo: doModeloCompleto(modelo), participantes, riscos }));
    roteador.push(rotas.app.checklist(os.id));
  });

  if (rascunho) {
    const bloqueada = estaTravada(rascunho);
    return (
      <div className="stack g12">
        <Notice tone={bloqueada ? "blq" : "info"} icon={bloqueada ? "octagon" : "save"}>
          {bloqueada ? (
            <>
              <strong>Sua APR desta OS reprovou e já está registrada como bloqueada</strong> ({rascunho.modelo.codigo} v{rascunho.modelo.versao}). Falta
              anexar a evidência dos itens reprovados. Descartar o rascunho não apaga a APR bloqueada: a nova será outra APR.
            </>
          ) : (
            <>
              <strong>Você tem uma APR em andamento nesta OS</strong> ({rascunho.modelo.codigo} v{rascunho.modelo.versao}). Continue de onde parou (o
              modelo ainda pode ser trocado no checklist) ou descarte o rascunho para começar uma APR nova, sem nenhuma resposta aproveitada.
            </>
          )}
        </Notice>
        <div className="row g8 wrap">
          <LinkButton variant="p" href={continuaNasAssinaturas(rascunho) ? rotas.app.aprovada(os.id) : rotas.app.checklist(os.id)}>
            {bloqueada ? "Registrar a evidência" : "Continuar APR"}
          </LinkButton>
          <Button variant="line" onClick={() => window.confirm(avisoAoDescartar(rascunho)) && descartar()}>
            Descartar e começar de novo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <EtapasApr />
      {janelaAberta && (
        <JanelaDeModelos
          escolha={escolha}
          erro={erro}
          atual={modelo?.codigo ?? null}
          carregando={carregandoModelo}
          aoSelecionar={escolherModelo}
          aoFechar={() => setJanela("fechada")}
        />
      )}
      <form ref={ref} noValidate onSubmit={comecar}>
      <Colunas
        principal={
          <>
            {!modelo && (
              <div className="card stack g8" data-treino="apr-modelo" data-erro={erros.modelo ? "" : undefined}>
                <strong>Escolha o modelo da APR</strong>
                <span className="muted">Veja o que cada modelo atende e selecione o que cobre o serviço desta OS. O sistema recomenda um, mas a escolha é sua.</span>
                {erros.modelo?.message && <MensagemDeErro>{erros.modelo.message}</MensagemDeErro>}
                <div>
                  <Button variant="p" onClick={() => setJanela("aberta")}>
                    Escolher o modelo
                  </Button>
                </div>
              </div>
            )}
            {erro && !janelaAberta && (
              <Notice tone="blq" icon="alert">
                {erro}
              </Notice>
            )}
            <ParticipantesApr equipe={equipe} usuarioId={usuarioId} marcados={marcados} responsavelId={responsavelId} aoAlternar={alternarParticipante} aoTornarResponsavel={os.reservada ? undefined : setResponsavelId} erro={erros.participantes?.message} />
            {modelo && <RiscosApr riscos={modelo.riscos} itens={modelo.itens} marcados={riscos} aoAlternar={alternarRisco} />}
          </>
        }
        lateral={
          <>
            {modelo && <ModeloAprCard modelo={modelo} recomendado={escolha.recomendado} aoTrocar={() => setJanela("aberta")} />}
            <OsDaAprCard os={os} />
            <PainelAcoes>
              <div className="row g8" style={{ fontSize: 13, color: modelo ? "var(--enc)" : "var(--ink3)" }}>
                <Icon name="check" size={16} />
                {os.rotulo} · {marcados.length} {marcados.length === 1 ? "participante" : "participantes"} · {riscos.length} {riscos.length === 1 ? "risco marcado" : "riscos marcados"}
              </div>
              <ErroDeEnvio mensagem={erroEnvio} />
              <Button type="submit" variant="p" block disabled={Boolean(carregandoModelo)} data-treino="apr-comecar">
                {modelo ? `Começar checklist · ${total} ${total === 1 ? "item" : "itens"}` : "Começar checklist"}
              </Button>
            </PainelAcoes>
          </>
        }
      />
      </form>
    </>
  );
}
