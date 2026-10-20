import { PainelAcoes } from "@/components/app/AppChrome";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { avisoDaConferenciaNaOs, type ConferenciaDaOs } from "@/lib/conferencia";
import { rotas } from "@/lib/rotas";

const iconeDoTom = { al: "refresh", info: "clip", ok: "check" } as const;

/**
 * O aviso "Conferência da execução" do detalhe da OS: o estado da conferência do que a equipe registrou sem sinal e o botão para abri-la.
 * Sem conferência (a maioria das OS e o Campo de treino) não desenha nada. A regra do que dizer por estado é `avisoDaConferenciaNaOs`.
 */
export function ConferenciaDaOsCard({ osId, conferencias }: { osId: string; conferencias: readonly ConferenciaDaOs[] | undefined }) {
  const aviso = avisoDaConferenciaNaOs(conferencias);
  if (!aviso) return null;
  return (
    <PainelAcoes titulo="Conferência da execução">
      <Notice tone={aviso.tom} icon={iconeDoTom[aviso.tom]}>
        <strong>{aviso.titulo}.</strong> {aviso.texto}
      </Notice>
      <LinkButton variant={aviso.tom === "al" ? "p" : "line"} block href={rotas.app.conferencia(osId, aviso.conferenciaId)} data-treino="os-conferencia">
        <Icon name="checks" size={18} />
        {aviso.rotuloDoLink}
      </LinkButton>
    </PainelAcoes>
  );
}
