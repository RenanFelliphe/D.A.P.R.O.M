import { CadastrarAssinatura } from "@/components/app/aprovada/CadastrarAssinatura";
import { EvidenciaCard } from "@/components/app/checklist/EvidenciaCard";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { reprovadosSemEvidencia, type Colega, type FotoDoRascunho, type RascunhoApr } from "@/lib/apr";

interface EvidenciaDosReprovadosProps {
  rascunho: RascunhoApr;
  /** Participantes sem assinatura no perfil (a `api` recusa a APR enquanto faltar). */
  semAssinatura: Colega[];
  /** O técnico logado está sem assinatura e pode desenhá-la aqui. */
  euSemAssinatura: boolean;
  aoObservar: (itemId: string, texto: string) => void;
  aoFotoEnviada: (itemId: string, foto: { arquivoId: string; previa: string }) => void;
  aoRemoverFoto: (itemId: string, fotoId: string) => void;
  aoErroDeFoto: (mensagem: string) => void;
  aoAssinaturaSalva: (arquivoId: string) => void;
  aoRegistrar: () => void;
  registrando: boolean;
  erro: string | null;
}

/**
 * Passo seguinte à validação quando a `api` reprovou a APR: só agora o técnico fica sabendo quais itens reprovaram, e
 * cada um pede a sua evidência. As respostas não mudam mais; falta registrar o impedimento.
 */
export function EvidenciaDosReprovados({
  rascunho,
  semAssinatura,
  euSemAssinatura,
  aoObservar,
  aoFotoEnviada,
  aoRemoverFoto,
  aoErroDeFoto,
  aoAssinaturaSalva,
  aoRegistrar,
  registrando,
  erro,
}: EvidenciaDosReprovadosProps) {
  const reprovados = rascunho.avaliacao?.reprovados ?? [];
  const varios = reprovados.length > 1;
  const faltando = reprovadosSemEvidencia(rascunho);
  const outrosSemAssinatura = semAssinatura.filter((c) => c.id !== rascunho.usuarioId);
  const faltaAssinatura = euSemAssinatura || outrosSemAssinatura.length > 0;
  const fotosDe = (itemId: string): FotoDoRascunho[] => rascunho.fotos[itemId] ?? [];

  return (
    <>
      <div className="res-banner rb-blq" data-treino="ck-reprovada">
        <span className="ic">
          <Icon name="octagon" size={24} />
        </span>
        <div className="stack g4">
          <h2>{varios ? `${reprovados.length} itens reprovaram` : "Um item reprovou"}</h2>
          <p>
            Ao registrar, a atividade fica impedida e a OS continua pendente. Para cada item abaixo, registre o motivo
            {reprovados.some((x) => x.evidencia === "foto") ? " e anexe a foto" : ""}. As respostas não podem mais ser alteradas.
          </p>
        </div>
      </div>

      {reprovados.map((item) => (
        <EvidenciaCard
          key={item.itemId}
          item={item}
          observacao={rascunho.respostas[item.itemId]?.observacao ?? ""}
          fotos={fotosDe(item.itemId)}
          aoObservar={(texto) => aoObservar(item.itemId, texto)}
          aoFotoEnviada={(foto) => aoFotoEnviada(item.itemId, foto)}
          aoRemoverFoto={(fotoId) => aoRemoverFoto(item.itemId, fotoId)}
          aoErroDeFoto={aoErroDeFoto}
        />
      ))}

      {euSemAssinatura && (
        <div className="card stack g8">
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Sua assinatura</h2>
          <CadastrarAssinatura aoSalvar={aoAssinaturaSalva} />
        </div>
      )}
      {outrosSemAssinatura.length > 0 && (
        <Notice tone="al" icon="alert">
          <strong>
            {outrosSemAssinatura.map((c) => c.nome).join(", ")} {outrosSemAssinatura.length > 1 ? "ainda não cadastraram" : "ainda não cadastrou"} a assinatura no perfil.
          </strong>{" "}
          Peça que cadastrem em Perfil antes de registrar.
        </Notice>
      )}

      {erro && (
        <Notice tone="blq" icon="alert">
          {erro}
        </Notice>
      )}

      <div className="nav2" style={{ maxWidth: 560 }}>
        <Button variant="p" disabled={faltando.length > 0 || faltaAssinatura || registrando} onClick={aoRegistrar} data-treino="ck-registrar-bloqueio">
          {registrando ? "Enviando…" : "Registrar impedimento"}
        </Button>
      </div>
      {faltando.length > 0 && <p className="small">Falta evidência em {faltando.length} item(ns).</p>}
    </>
  );
}
