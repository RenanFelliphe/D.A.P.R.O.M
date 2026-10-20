import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { dataHora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { rotuloDoEstadoDeSugestao, rotuloDoTipoDeSugestao, type SugestaoResumo } from "@/lib/sugestao-materiais";

const TOM_DO_ESTADO = { pendente: "al", aceita: "enc", recusada: "blq", cancelada: "neu" } as const;

/** Uma sugestão ou contestação na lista: o serviço, quem enviou, o estado e um trecho do motivo. O cartão inteiro leva à sugestão. */
export function CartaoDeSugestao({ sugestao, mostrarAutor }: { sugestao: SugestaoResumo; mostrarAutor: boolean }) {
  return (
    <Link href={rotas.app.sugestaoDeMateriais(sugestao.atividade_codigo, sugestao.id)} className="panel sg-cartao">
      <span className="row wrap g8">
        <Badge tone={sugestao.tipo === "contestacao" ? "al" : "brand"}>{rotuloDoTipoDeSugestao[sugestao.tipo]}</Badge>
        <Badge tone={TOM_DO_ESTADO[sugestao.estado]}>{rotuloDoEstadoDeSugestao[sugestao.estado]}</Badge>
        {sugestao.posso_avaliar && <Badge tone="dark">Você avalia</Badge>}
      </span>
      <strong className="sg-cartao-titulo">{sugestao.atividade_descricao}</strong>
      <span className="small sg-cartao-meta">
        <span className="mono">{sugestao.atividade_codigo}</span>
        {mostrarAutor ? ` · ${sugestao.autor_nome}` : ""} · {dataHora(sugestao.criada_em)}
        {sugestao.tem_lista ? ` · ${sugestao.itens_total === 1 ? "1 item" : `${sugestao.itens_total} itens`}` : " · só o motivo"}
      </span>
      {sugestao.motivo && <span className="sg-cartao-motivo">{sugestao.motivo}</span>}
    </Link>
  );
}
