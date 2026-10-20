import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { ESCOLHA_DESCARTAR, ROTULO_DE_DESCARTAR, descreverEscolha, descreverOpcao, quemDecideOCampo, rotuloDaOpcao, type CampoDaConferencia, type ConferenciaDaApi } from "@/lib/conferencia";
import { dataHora } from "@/lib/formatar";

interface Props {
  conferencia: Pick<ConferenciaDaApi, "versoes" | "decisoes">;
  campo: CampoDaConferencia;
  /** Quem olha escolhe este campo agora: cada versão ganha o botão de valer. */
  podeEscolher: boolean;
  /** A escolha marcada (o padrão sugerido, a escolha já gravada ou a troca da pessoa). */
  marcada: string;
  aoMarcar: (escolha: string) => void;
  desabilitado?: boolean;
}

/**
 * Uma diferença da conferência: o que cada aparelho (autor) registrou lado a lado, com o padrão sugerido e o que está valendo agora.
 * Quem decide o campo marca a versão certa (ou descarta a pausa de um aparelho só); os demais veem o que foi escolhido, ou de quem é a escolha.
 */
export function CampoDaConferenciaCard({ conferencia, campo, podeEscolher, marcada, aoMarcar, desabilitado }: Props) {
  const decisao = conferencia.decisoes.find((d) => d.campo === campo.campo) ?? null;
  const titulo = `cf-${campo.campo.replace(/[^a-z0-9]/gi, "-")}`;
  return (
    <article className={cx("cf-campo", campo.divergente && "divergente")} aria-labelledby={titulo} data-campo={campo.campo}>
      <header className="cf-campo-cab">
        <h3 id={titulo}>{campo.rotulo}</h3>
        <div className="row g6 wrap">
          {campo.so_um ? <Badge tone="al">Registrada em um aparelho só</Badge> : campo.divergente ? <Badge tone="al">Divergente</Badge> : <Badge tone="enc">Confere</Badge>}
        </div>
      </header>
      {decisao && (
        <div className="cf-resultado">
          <strong>
            {decisao.escolha === ESCOLHA_DESCARTAR ? "Pausa descartada" : `Vale o registro de ${descreverEscolha(conferencia, decisao.escolha)}`}
          </strong>
          <span>
            Escolha {quemDecideOCampo(campo)}
            {decisao.decidida_por ? `: ${decisao.decidida_por.nome}` : ""} · {dataHora(decisao.decidida_em)}
          </span>
        </div>
      )}
      <div className="cf-opcoes" role={podeEscolher ? "radiogroup" : undefined} aria-label={podeEscolher ? `Versão que vale: ${campo.rotulo}` : undefined}>
        {campo.opcoes.map((o) => {
          const vale = podeEscolher ? marcada === o.autor_id : decisao?.escolha === o.autor_id;
          return (
            <div key={o.autor_id} className={cx("cf-opcao", vale && "marcada")}>
              <span className="cf-opcao-autor">Registro de {o.autor_nome}</span>
              <span className="cf-opcao-valor">{descreverOpcao(campo.campo, o)}</span>
              <div className="cf-opcao-selos">
                {campo.sugerido === o.autor_id && <Badge tone="brand">Padrão sugerido</Badge>}
                {campo.valendo_de === o.autor_id && <Badge tone="exe">Valendo agora</Badge>}
                {decisao?.escolha === o.autor_id && <Badge tone="enc">Escolhida</Badge>}
              </div>
              {podeEscolher && (
                <Button variant={vale ? "p" : "line"} aria-pressed={vale} disabled={desabilitado} onClick={() => aoMarcar(o.autor_id)}>
                  {vale && <Icon name="check" size={16} />}
                  {rotuloDaOpcao(campo, o)}
                </Button>
              )}
            </div>
          );
        })}
        {podeEscolher && campo.so_um && (
          <div className={cx("cf-opcao descartada", marcada === ESCOLHA_DESCARTAR && "marcada")}>
            <span className="cf-opcao-autor">Sem a pausa</span>
            <span className="cf-opcao-valor">A execução segue sem esta pausa</span>
            <div className="cf-opcao-selos" />
            <Button variant={marcada === ESCOLHA_DESCARTAR ? "p" : "line"} aria-pressed={marcada === ESCOLHA_DESCARTAR} disabled={desabilitado} onClick={() => aoMarcar(ESCOLHA_DESCARTAR)}>
              {marcada === ESCOLHA_DESCARTAR && <Icon name="check" size={16} />}
              {ROTULO_DE_DESCARTAR}
            </Button>
          </div>
        )}
      </div>
      {!podeEscolher && !decisao && campo.divergente && <p className="small muted">Escolha {quemDecideOCampo(campo)}. Enquanto ninguém escolhe, vale o padrão sugerido.</p>}
    </article>
  );
}
