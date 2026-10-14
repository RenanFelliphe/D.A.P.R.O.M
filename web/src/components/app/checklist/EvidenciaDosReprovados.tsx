import { EvidenciaCard } from "@/components/app/checklist/EvidenciaCard";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { documentosDe, materiaisFaltandoDe, reprovadosSemEvidencia, type FotoDoRascunho, type RascunhoApr } from "@/lib/apr";

interface EvidenciaDosReprovadosProps {
  rascunho: RascunhoApr;
  aoObservar: (itemId: string, texto: string) => void;
  aoFotoEnviada: (itemId: string, foto: { arquivoId: string; previa: string }) => void;
  aoRemoverFoto: (itemId: string, fotoId: string) => void;
  aoPdfEnviado: (itemId: string, pdf: { arquivoId: string; nome: string }) => void;
  aoRemoverPdf: (itemId: string, documentoId: string) => void;
  /** Falha ao enviar uma foto ou um PDF. */
  aoErroDeFoto: (mensagem: string) => void;
  aoRegistrar: () => void;
  registrando: boolean;
  erro: string | null;
}

/**
 * Passo seguinte à validação quando a `api` reprovou a APR: só agora o técnico fica sabendo quais itens reprovaram. A
 * APR bloqueada já está registrada (a OS ficou pendente e o supervisor foi avisado); cada item reprovado pede a sua
 * evidência, que completa o registro. As respostas não mudam mais. A APR bloqueada só por material obrigatório sem
 * comprovação não tem evidência a completar: a tela mostra o que faltou e o técnico conclui.
 */
export function EvidenciaDosReprovados({
  rascunho,
  aoObservar,
  aoFotoEnviada,
  aoRemoverFoto,
  aoPdfEnviado,
  aoRemoverPdf,
  aoErroDeFoto,
  aoRegistrar,
  registrando,
  erro,
}: EvidenciaDosReprovadosProps) {
  const reprovados = rascunho.avaliacao?.reprovados ?? [];
  const materiais = materiaisFaltandoDe(rascunho);
  const varios = reprovados.length > 1;
  const faltando = reprovadosSemEvidencia(rascunho);
  const fotosDe = (itemId: string): FotoDoRascunho[] => rascunho.fotos[itemId] ?? [];

  return (
    <>
      <div className="res-banner rb-blq" data-treino="ck-reprovada">
        <span className="ic">
          <Icon name="octagon" size={24} />
        </span>
        <div className="stack g4">
          <h2>
            {reprovados.length === 0
              ? materiais.length > 1
                ? "Materiais obrigatórios sem comprovação"
                : "Material obrigatório sem comprovação"
              : varios
                ? `${reprovados.length} itens reprovaram`
                : "Um item reprovou"}
          </h2>
          <p>
            A atividade está impedida: a APR ficou registrada como bloqueada, a OS está pendente e o supervisor foi avisado.
            {reprovados.length > 0 && (
              <>
                {" "}
                Para cada item abaixo, registre o motivo{reprovados.some((x) => x.evidencia !== "texto") ? " e anexe o que ele pede (foto ou PDF)" : ""}. As respostas não
                podem mais ser alteradas.
              </>
            )}
          </p>
        </div>
      </div>

      {materiais.length > 0 && (
        <section className="card stack g6" aria-label="Materiais obrigatórios sem comprovação" data-treino="ck-materiais-faltando">
          <strong style={{ fontSize: 14 }}>{materiais.length > 1 ? "Materiais obrigatórios sem comprovação" : "Material obrigatório sem comprovação"}</strong>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
            {materiais.map((m) => (
              <li key={m.materialId}>
                {m.descricao} · <b style={{ color: "var(--blq)" }}>{m.levou ? "levado, mas sem a foto do item" : "não levado"}</b>
              </li>
            ))}
          </ul>
          <p className="muted">Com {materiais.length > 1 ? "os itens" : "o item"} em mãos, faça uma nova APR e envie a foto.</p>
        </section>
      )}

      {reprovados.map((item) => (
        <EvidenciaCard
          key={item.itemId}
          item={item}
          observacao={rascunho.respostas[item.itemId]?.observacao ?? ""}
          fotos={fotosDe(item.itemId)}
          documentos={documentosDe(rascunho, item.itemId)}
          aoObservar={(texto) => aoObservar(item.itemId, texto)}
          aoFotoEnviada={(foto) => aoFotoEnviada(item.itemId, foto)}
          aoRemoverFoto={(fotoId) => aoRemoverFoto(item.itemId, fotoId)}
          aoPdfEnviado={(pdf) => aoPdfEnviado(item.itemId, pdf)}
          aoRemoverPdf={(documentoId) => aoRemoverPdf(item.itemId, documentoId)}
          aoErroDeFoto={aoErroDeFoto}
        />
      ))}

      {erro && (
        <Notice tone="blq" icon="alert">
          {erro}
        </Notice>
      )}

      <div className="nav2" style={{ maxWidth: 560 }}>
        <Button variant="p" disabled={faltando.length > 0 || registrando} onClick={aoRegistrar} data-treino="ck-registrar-bloqueio">
          {registrando ? "Enviando…" : reprovados.length > 0 ? "Registrar impedimento" : "Concluir"}
        </Button>
      </div>
      {faltando.length > 0 && <p className="small">Falta evidência em {faltando.length} item(ns).</p>}
    </>
  );
}
