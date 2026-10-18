import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/web/Panel";
import { ajudaParticipantesComAssinatura, rotuloParticipantesComAssinatura, type ModeloCompleto } from "@/data/modelos";
import { data, dataDoDia } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { NovaVersao } from "./NovaVersao";
import { PaeGrade } from "./PaeGrade";
import { TabelaPerguntas } from "./TabelaPerguntas";

interface VisaoModeloProps {
  modelo: ModeloCompleto;
  /** Administrador: pode criar a próxima versão. */
  podeEditar: boolean;
  /** Versão do rascunho que já existe para este código, se houver. */
  rascunho?: number;
  /** É a versão publicada mais recente (a que as APRs novas usam). */
  emUso: boolean;
}

/** Versão publicada em leitura: título, PAE, itens e a ação "Nova versão" (de quem edita, num modelo não excluído). */
export function VisaoModelo({ modelo, podeEditar, rascunho, emUso }: VisaoModeloProps) {
  const excluido = Boolean(modelo.arquivado_em);
  const editavel = podeEditar && emUso && !excluido;
  return (
    <Panel style={{ padding: "20px 22px", gap: 16 }}>
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack g4">
          <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)" }}>
            {`${modelo.codigo} · v${modelo.versao}`}{" "}
            {excluido ? <Badge tone="neu">Modelo excluído</Badge> : emUso ? <Badge tone="enc">Em uso</Badge> : <Badge tone="neu">Versão anterior</Badge>}
          </span>
          <h2 style={{ fontSize: 22, lineHeight: 1.2 }}>{modelo.titulo}</h2>
          <span className="small">{`Publicada em ${data(modelo.publicado_em)} · documento de ${dataDoDia(modelo.data_documento)} · somente leitura`}</span>
        </div>
        {editavel && !rascunho && <NovaVersao codigo={modelo.codigo} />}
        {editavel && rascunho && (
          <Link className="btn btn-p btn-sm" href={rotas.web.modelo(modelo.codigo, rascunho)}>
            {`Abrir o rascunho v${rascunho}`}
          </Link>
        )}
      </div>
      <Notice tone="info" icon="info">
        Uma versão publicada não muda.{" "}
        {excluido
          ? "Este modelo foi excluído: a versão fica guardada para o histórico."
          : podeEditar
            ? "Para alterar, crie uma nova versão: ela nasce como rascunho, copiada desta."
            : "Só o administrador cria novas versões."}{" "}
        As APRs já preenchidas continuam ligadas à versão que usaram.
      </Notice>
      <div className="stack g4">
        <span style={{ fontSize: 14.5 }}>
          <Icon name={modelo.participantes_com_assinatura ? "check" : "x"} size={16} /> {rotuloParticipantesComAssinatura}:{" "}
          <strong>{modelo.participantes_com_assinatura ? "sim" : "não"}</strong>
        </span>
        <span className="small">{ajudaParticipantesComAssinatura}</span>
      </div>
      <TabelaPerguntas itens={modelo.itens} riscos={modelo.riscos} />
      <div className="stack g8">
        <h3 style={{ fontSize: 15 }}>Plano de atendimento a emergências (PAE)</h3>
        <PaeGrade pae={modelo.pae} />
      </div>
    </Panel>
  );
}
