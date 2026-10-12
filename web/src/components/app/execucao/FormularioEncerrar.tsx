"use client";

import { useState } from "react";
import { AssinaturasExecutantes } from "@/components/app/execucao/AssinaturasExecutantes";
import { FotosExecucao, comoEvidencia, type FotoDaExecucao } from "@/components/app/execucao/FotosExecucao";
import { Button } from "@/components/ui/Button";
import { Field, Req } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { enviarEvento } from "@/lib/cliente-api";
import type { ParticipanteDaApr } from "./tempo";
import { useAcao } from "./useAcao";

interface FormularioEncerrarProps {
  osId: string;
  execucaoId: string;
  participantes: ParticipanteDaApr[];
  usuarioId: string;
  assinaturaDoUsuario: string | null;
  onEncerrada: () => void;
  onCancelar: () => void;
}

/** Encerramento: descrição da atividade, de 1 a 10 fotos e a assinatura de todos os participantes da APR. */
export function FormularioEncerrar({ osId, execucaoId, participantes, usuarioId, assinaturaDoUsuario, onEncerrada, onCancelar }: FormularioEncerrarProps) {
  const { ocupado, erro, executar } = useAcao();
  const [descricao, setDescricao] = useState("");
  const [fotos, setFotos] = useState<FotoDaExecucao[]>([]);
  const [minhaAssinatura, setMinhaAssinatura] = useState(assinaturaDoUsuario);
  /** usuário → instante em que confirmou a assinatura. */
  const [assinadas, setAssinadas] = useState<Record<string, string>>({});

  const semAssinatura = participantes.filter((p) => !(p.usuario_id === usuarioId ? minhaAssinatura : p.assinatura_path));
  const faltas = [
    !descricao.trim() && "a descrição da atividade",
    fotos.length === 0 && "ao menos 1 foto",
    semAssinatura.length === 0 && participantes.some((p) => !assinadas[p.usuario_id]) && "a assinatura de todos os participantes",
  ].filter(Boolean) as string[];
  const podeEncerrar = faltas.length === 0 && semAssinatura.length === 0 && participantes.length > 0;

  function alternar(id: string) {
    setAssinadas((atual) => {
      const { [id]: existente, ...resto } = atual;
      return existente ? resto : { ...atual, [id]: new Date().toISOString() };
    });
  }

  const encerrar = () =>
    executar(async () => {
      await enviarEvento({
        tipo: "execucao_encerrada",
        os_id: osId,
        payload: {
          execucao_id: execucaoId,
          fim: new Date().toISOString(),
          descricao_atividade: descricao.trim(),
          evidencias: fotos.map(comoEvidencia),
          assinaturas: participantes.map((p) => ({ usuario_id: p.usuario_id, assinada_em: assinadas[p.usuario_id] })),
        },
      });
      onEncerrada();
    });

  return (
    <>
      <div className="panel" data-treino="enc-descricao">
        <Field
          label={
            <>
              Descrição da atividade <Req style={{ color: "var(--exe)" }}>· obrigatória</Req>
            </>
          }
          htmlFor="descricao"
        >
          <textarea className="textarea" id="descricao" rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que foi feito, o que foi encontrado e o que ficou pendente." />
        </Field>
      </div>
      <div className="panel" data-treino="enc-fotos">
        <FotosExecucao fotos={fotos} onChange={setFotos} desabilitado={ocupado} />
      </div>
      <div className="panel" data-treino="enc-assinaturas">
        <AssinaturasExecutantes
          participantes={participantes}
          usuarioId={usuarioId}
          minhaAssinatura={minhaAssinatura}
          onMinhaAssinatura={setMinhaAssinatura}
          confirmadas={new Set(Object.keys(assinadas))}
          onAlternar={alternar}
          desabilitado={ocupado}
        />
      </div>
      {semAssinatura.length > 0 && (
        <Notice tone="blq" icon="alert">
          Não dá para encerrar: {semAssinatura.map((p) => p.nome).join(", ")} ainda não {semAssinatura.length > 1 ? "cadastraram" : "cadastrou"} a assinatura no perfil.
        </Notice>
      )}
      {erro && (
        <Notice tone="blq" icon="alert">
          {erro.mensagem}
        </Notice>
      )}
      <div className="panel stack g8">
        {!podeEncerrar && faltas.length > 0 && <span className="small">Falta: {faltas.join(", ")}.</span>}
        <div className="row g8">
          <Button variant="p" onClick={encerrar} disabled={!podeEncerrar || ocupado} data-treino="enc-confirmar">
            <Icon name="check" size={18} />
            {ocupado ? "Encerrando…" : "Encerrar OS"}
          </Button>
          <Button variant="line" onClick={onCancelar} disabled={ocupado}>
            Voltar à execução
          </Button>
        </div>
      </div>
    </>
  );
}
