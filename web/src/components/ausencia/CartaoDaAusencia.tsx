"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { descreverPeriodo, detalheDoAto, ROTULO_DO_ATO, rotuloDaForma, rotuloDaSituacao, tomDaSituacao, type Ausencia, type AtoDaAusencia } from "@/lib/ausencia";
import { chamar } from "@/lib/cliente-api";
import { dataDoDia, dataHora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { AcoesDaAusencia, type QuemAge } from "./AcoesDaAusencia";

/** A linha do tempo da ausência, buscada só quando a pessoa a abre. */
function HistoricoDaAusencia({ id }: { id: string }) {
  const [atos, setAtos] = useState<AtoDaAusencia[] | null>(null);
  const [erro, setErro] = useState(false);

  function aoAbrir(e: React.SyntheticEvent<HTMLDetailsElement>) {
    if (!e.currentTarget.open || atos) return;
    chamar<{ ausencia: { atos: AtoDaAusencia[] } }>("GET", `/ausencias/${id}`)
      .then((r) => setAtos(r.ausencia.atos))
      .catch(() => setErro(true));
  }

  return (
    <details className="aus-historico" onToggle={aoAbrir}>
      <summary className="small">Histórico</summary>
      {erro ? (
        <span className="small muted">Não foi possível carregar o histórico.</span>
      ) : !atos ? (
        <span className="small muted">Carregando…</span>
      ) : (
        <ol className="aus-atos">
          {atos.map((a) => {
            const detalhe = detalheDoAto(a);
            return (
              <li key={a.id}>
                <span className="small muted">{dataHora(a.em)}</span>
                <span>
                  <strong>{ROTULO_DO_ATO[a.tipo] ?? a.tipo}</strong>
                  {a.autor_nome ? ` · ${a.autor_nome}` : " · sistema"}
                  {a.assinado && <span className="small muted"> · assinado</span>}
                  {detalhe && <span className="small muted"> — {detalhe}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </details>
  );
}

interface CartaoDaAusenciaProps {
  ausencia: Ausencia;
  eu: QuemAge;
  /** Quem olha supervisiona a equipe da ausência. */
  supervisaEquipe: boolean;
  /** Mostra o nome da pessoa (na tela da equipe); no perfil de cada um, só os dados da ausência. */
  comPessoa?: boolean;
}

const ORIGEM: Record<Ausencia["origem"], string> = {
  pedido: "Pedida pelo funcionário",
  supervisor: "Registrada pelo supervisor",
  propria: "Registrada pelo próprio supervisor",
};

/** Uma ausência: quem, o período, o motivo, como está e o que cada pessoa pode fazer agora. */
export function CartaoDaAusencia({ ausencia: a, eu, supervisaEquipe, comPessoa = false }: CartaoDaAusenciaProps) {
  return (
    <article className="card stack g8 aus-cartao" id={`ausencia-${a.id}`}>
      <div className="row between wrap g8">
        <div className="stack g4" style={{ minWidth: 0 }}>
          {comPessoa && (
            <Link href={rotas.app.perfilDe(a.usuario_id)} style={{ fontWeight: 600 }}>
              {a.usuario_nome}
            </Link>
          )}
          <span style={{ fontWeight: comPessoa ? 400 : 600 }}>{descreverPeriodo(a)}</span>
        </div>
        <Badge tone={tomDaSituacao[a.situacao]}>{rotuloDaSituacao[a.situacao]}</Badge>
      </div>
      <p>{a.motivo}</p>
      <span className="small muted">
        {ORIGEM[a.origem]}
        {a.supervisor_nome && a.origem !== "propria" ? ` · supervisor ${a.supervisor_nome}` : ""}
        {a.encerrada_em ? ` · ${a.forma_encerramento ? rotuloDaForma[a.forma_encerramento] : rotuloDaSituacao[a.situacao]} em ${dataHora(a.encerrada_em)}` : ""}
      </span>
      {a.situacao === "vencida" && (
        <Notice tone="blq" icon="clock">
          A data de retorno chegou ({dataDoDia(a.retorno)}) e o retorno ainda não foi confirmado: {a.usuario_id === eu.id ? "confirme o retorno" : "o funcionário confirma o retorno, ou você altera a data ou encerra a ausência"}.
        </Notice>
      )}
      {a.fim_pedido_em && a.fim_pedido_data && (
        <Notice tone="al" icon="clock">
          <Icon name="refresh" size={13} /> Fim antecipado pedido: voltar em {dataDoDia(a.fim_pedido_data)}. Aguarda a resposta do supervisor.
        </Notice>
      )}
      <AcoesDaAusencia ausencia={a} eu={eu} supervisaEquipe={supervisaEquipe} />
      <HistoricoDaAusencia id={a.id} />
    </article>
  );
}
