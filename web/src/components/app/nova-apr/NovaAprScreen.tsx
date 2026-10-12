"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Colunas, PainelAcoes } from "@/components/app/AppChrome";
import { EtapasApr } from "@/components/app/nova-apr/EtapasApr";
import { ModeloAprCard } from "@/components/app/nova-apr/ModeloAprCard";
import { OsDaAprCard } from "@/components/app/nova-apr/OsDaAprCard";
import { ParticipantesApr } from "@/components/app/nova-apr/ParticipantesApr";
import { RiscosApr } from "@/components/app/nova-apr/RiscosApr";
import { SeletorModelo } from "@/components/app/nova-apr/SeletorModelo";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { doModeloCompleto, novoRascunho, totalDePerguntas, type Colega, type Funcao, type ModeloCompleto, type ModeloResumo } from "@/lib/apr";
import { rotas } from "@/lib/rotas";
import { chamar, ErroCliente } from "@/lib/cliente-api";
import { gravarRascunho, useRascunhoApr } from "@/state/rascunho-apr";

interface NovaAprScreenProps {
  os: { id: string; rotulo: string; titulo: string; local: string };
  usuarioId: string;
  colegas: Colega[];
  /** Versão publicada mais recente do modelo da atividade da OS; `null` se a OS não tem atividade mapeada. */
  modeloDaAtividade: ModeloCompleto | null;
  codigoMapeado: string | null;
  /** Para escolher, quando não há modelo da atividade. */
  modelosPublicados: ModeloResumo[];
}

/** Etapa 1 da APR: modelo, participantes (a equipe da OS) e riscos da atividade. Cada APR nasce vazia. */
export function NovaAprScreen({ os, usuarioId, colegas, modeloDaAtividade, codigoMapeado, modelosPublicados }: NovaAprScreenProps) {
  const roteador = useRouter();
  const { rascunho, descartar } = useRascunhoApr(os.id, usuarioId);

  const [modelo, setModelo] = useState<ModeloCompleto | null>(modeloDaAtividade);
  const [carregandoModelo, setCarregandoModelo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<string[]>([usuarioId]);
  const [responsavelId, setResponsavelId] = useState(usuarioId);
  const [riscos, setRiscos] = useState<string[]>([]);

  // Eu primeiro, depois a equipe por nome (a `api` já ordena por nome).
  const equipe = useMemo(() => [...colegas].sort((a, b) => Number(b.id === usuarioId) - Number(a.id === usuarioId)), [colegas, usuarioId]);

  async function escolherModelo(codigo: string) {
    setErro(null);
    if (!codigo) {
      setModelo(null);
      return;
    }
    setCarregandoModelo(true);
    try {
      const completo = await chamar<ModeloCompleto>("GET", `/modelos-apr/${encodeURIComponent(codigo)}/versoes/publicada`);
      setModelo(completo);
      setRiscos([]);
    } catch (e) {
      setModelo(null);
      setErro(e instanceof ErroCliente ? e.message : "Não foi possível carregar o modelo.");
    } finally {
      setCarregandoModelo(false);
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

  function comecar() {
    if (!modelo) return;
    const participantes = marcados.map((id) => ({ usuarioId: id, funcao: (id === responsavelId ? "responsavel" : "executor") as Funcao }));
    gravarRascunho(novoRascunho({ osId: os.id, usuarioId, modelo: doModeloCompleto(modelo), participantes, riscos }));
    roteador.push(rotas.app.checklist(os.id));
  }

  if (rascunho) {
    const aprovada = rascunho.concluidaEm !== null;
    return (
      <div className="stack g12">
        <Notice tone="info" icon="save">
          <strong>Você tem uma APR em andamento nesta OS</strong> ({rascunho.modelo.codigo} v{rascunho.modelo.versao}). Continue de onde parou ou descarte o rascunho para
          começar uma APR nova, sem nenhuma resposta aproveitada.
        </Notice>
        <div className="row g8 wrap">
          <LinkButton variant="p" href={aprovada ? rotas.app.aprovada(os.id) : rotas.app.checklist(os.id)}>
            Continuar APR
          </LinkButton>
          <Button variant="line" onClick={descartar}>
            Descartar e começar de novo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <EtapasApr />
      <Colunas
        principal={
          <>
            {!modeloDaAtividade && (
              <SeletorModelo
                codigoMapeado={codigoMapeado}
                modelos={modelosPublicados}
                escolhido={modelo?.codigo ?? ""}
                carregando={carregandoModelo}
                aoEscolher={escolherModelo}
              />
            )}
            {erro && (
              <Notice tone="blq" icon="alert">
                {erro}
              </Notice>
            )}
            <ParticipantesApr equipe={equipe} usuarioId={usuarioId} marcados={marcados} responsavelId={responsavelId} aoAlternar={alternarParticipante} aoTornarResponsavel={setResponsavelId} />
            {modelo && <RiscosApr riscos={modelo.riscos} itens={modelo.itens} marcados={riscos} aoAlternar={alternarRisco} />}
          </>
        }
        lateral={
          <>
            {modelo && <ModeloAprCard modelo={modelo} daAtividade={Boolean(modeloDaAtividade)} />}
            <OsDaAprCard os={os} />
            <PainelAcoes>
              <div className="row g8" style={{ fontSize: 13, color: modelo ? "var(--enc)" : "var(--ink3)" }}>
                <Icon name="check" size={16} />
                {os.rotulo} · {marcados.length} {marcados.length === 1 ? "participante" : "participantes"} · {riscos.length} {riscos.length === 1 ? "risco marcado" : "riscos marcados"}
              </div>
              <Button variant="p" block disabled={!modelo || carregandoModelo} onClick={comecar} data-treino="apr-comecar">
                {modelo ? `Começar checklist · ${total} ${total === 1 ? "item" : "itens"}` : "Escolha o modelo para começar"}
              </Button>
            </PainelAcoes>
          </>
        }
      />
    </>
  );
}
