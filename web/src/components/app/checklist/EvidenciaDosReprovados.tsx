import { useMemo } from "react";
import { z } from "zod";
import { EvidenciaCard } from "@/components/app/checklist/EvidenciaCard";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { ErroDeEnvio, useFormulario, useRevalidarQuando } from "@/components/ui/useFormulario";
import { documentosDe, type FotoDoRascunho, type RascunhoApr } from "@/lib/apr";

interface EvidenciaDosReprovadosProps {
  rascunho: RascunhoApr;
  aoObservar: (itemId: string, texto: string) => void;
  aoFotoEnviada: (itemId: string, foto: { arquivoId: string; previa: string }) => void;
  aoRemoverFoto: (itemId: string, fotoId: string) => void;
  aoPdfEnviado: (itemId: string, pdf: { arquivoId: string; nome: string }) => void;
  aoRemoverPdf: (itemId: string, documentoId: string) => void;
  /** Falha ao enviar uma foto ou um PDF. */
  aoErroDeFoto: (mensagem: string) => void;
  /** Envia a evidência; uma falha da `api` é lançada e aparece acima do botão. */
  aoRegistrar: () => Promise<void>;
  /** Falha ao anexar uma foto ou um PDF (mostrada acima do botão). */
  erro: string | null;
}

/**
 * Passo seguinte à validação quando a `api` reprovou a APR: só agora o técnico fica sabendo quais itens reprovaram. A
 * APR bloqueada já está registrada (a OS ficou pendente e o supervisor foi avisado); cada item reprovado pede a sua
 * evidência, que completa o registro. As respostas não mudam mais. A APR bloqueada só por material obrigatório sem
 * comprovação não tem evidência a completar: a tela mostra o que faltou e o técnico conclui. O botão não fica desativado: sem a
 * evidência, a mensagem aparece junto do campo que falta (observação, foto ou PDF) e o foco vai para o primeiro.
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
  erro,
}: EvidenciaDosReprovadosProps) {
  const avaliacao = rascunho.avaliacao;
  const reprovados = useMemo(() => avaliacao?.reprovados ?? [], [avaliacao]);
  const varios = reprovados.length > 1;

  // O que cada item reprovado ainda pede, por campo: o esquema é refeito a cada mudança do rascunho (as evidências vivem nele).
  const esquema = useMemo(
    () =>
      z
        .object({ obs: z.record(z.string(), z.string()), fotos: z.record(z.string(), z.string()), docs: z.record(z.string(), z.string()) })
        .superRefine((_, ctx) => {
          for (const item of reprovados) {
            if (!rascunho.respostas[item.itemId]?.observacao?.trim()) ctx.addIssue({ code: "custom", path: ["obs", item.itemId], message: "Descreva o motivo: a observação deste item é obrigatória." });
            if (item.evidencia === "foto" && (rascunho.fotos[item.itemId]?.length ?? 0) === 0) ctx.addIssue({ code: "custom", path: ["fotos", item.itemId], message: "Anexe ao menos 1 foto deste item." });
            if (item.evidencia === "pdf" && documentosDe(rascunho, item.itemId).length === 0) ctx.addIssue({ code: "custom", path: ["docs", item.itemId], message: "Anexe ao menos 1 documento em PDF deste item." });
          }
        }),
    [rascunho, reprovados],
  );
  const { form, ref, enviar, enviando, erroEnvio } = useFormulario(esquema, { obs: {}, fotos: {}, docs: {} });
  useRevalidarQuando(form, rascunho);
  const erros = form.formState.errors;
  const fotosDe = (itemId: string): FotoDoRascunho[] => rascunho.fotos[itemId] ?? [];

  return (
    <form ref={ref} noValidate onSubmit={enviar(() => aoRegistrar())} className="stack g12">
      <div className="res-banner rb-blq" data-treino="ck-reprovada">
        <span className="ic">
          <Icon name="octagon" size={24} />
        </span>
        <div className="stack g4">
          <h2>
            {varios ? `${reprovados.length} itens reprovaram` : "Um item reprovou"}
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
          erros={{ observacao: erros.obs?.[item.itemId]?.message, fotos: erros.fotos?.[item.itemId]?.message, documentos: erros.docs?.[item.itemId]?.message }}
        />
      ))}

      {erro && (
        <Notice tone="blq" icon="alert" role="alert">
          {erro}
        </Notice>
      )}
      <ErroDeEnvio mensagem={erroEnvio} />

      <div className="nav2" style={{ maxWidth: 560 }}>
        <Button type="submit" variant="p" disabled={enviando} aria-busy={enviando} data-treino="ck-registrar-bloqueio">
          {enviando ? "Enviando…" : reprovados.length > 0 ? "Registrar impedimento" : "Concluir"}
        </Button>
      </div>
    </form>
  );
}
