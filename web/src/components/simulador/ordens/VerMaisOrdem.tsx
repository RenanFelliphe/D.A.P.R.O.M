"use client";

import { JanelaVerMais } from "@/components/simulador/JanelaVerMais";
import { dataDoDia, dataHora } from "@/lib/formatar";
import { efeitoDaEdicao, rotuloDaSituacaoNoDaprom, rotuloDoStatus, type CatalogoDeOrdens, type Ordem } from "./tipos";

const intervalo = (i: Ordem["intervalo_ciclo"]) => (typeof i === "string" ? i : i ? `${i.quantidade} ${i.unidade}` : null);

/** "Ver mais" da ordem: todos os campos do contrato e o que o DAPROM fez com ela. */
export function VerMaisOrdem({ ordem: o, catalogo, aoFechar }: { ordem: Ordem; catalogo: CatalogoDeOrdens; aoFechar: () => void }) {
  const centro = catalogo.centros_de_trabalho.find((c) => c.centro_trabalho === o.centro_trabalho);
  const atividade = catalogo.atividades.find((a) => a.codigo === o.codigo_atividade);
  const efeito = efeitoDaEdicao(o.no_daprom.situacao);
  return (
    <JanelaVerMais
      titulo={`Ordem ${o.numero_ordem}`}
      aoFechar={aoFechar}
      secoes={[
        {
          titulo: "No SAP",
          itens: [
            { rotulo: "Número da ordem", valor: <span className="mono">{o.numero_ordem}</span> },
            { rotulo: "Nota", valor: o.numero_nota },
            { rotulo: "Tipo da ordem", valor: o.tipo_ordem === "YBA1" ? "YBA1 · Corretiva" : "YBA2 · Preventiva" },
            { rotulo: "Tipo de atividade", valor: o.tipo_atividade },
            { rotulo: "Título", valor: o.titulo },
            { rotulo: "Atividade", valor: o.codigo_atividade ? `${o.codigo_atividade}${atividade ? " (cadastrada no DAPROM)" : " (o DAPROM não a conhece)"}` : null },
            { rotulo: "Status SAP", valor: `${o.status_sap ?? "—"}${o.status_sap ? ` · ${rotuloDoStatus(o.status_sap, catalogo.status_prontos)}` : ""}` },
            { rotulo: "Prioridade", valor: o.prioridade },
            { rotulo: "Centro de trabalho", valor: `${o.centro_trabalho}${centro ? ` · ${centro.nome}` : ""}` },
            { rotulo: "Equipamento", valor: o.equipamento },
            { rotulo: "Início programado", valor: dataDoDia(o.data_inicio_prog) },
            { rotulo: "Fim programado", valor: dataDoDia(o.data_fim_prog) },
            { rotulo: "Local de instalação", valor: o.local_instalacao.codigo },
            { rotulo: "Endereço", valor: o.local_instalacao.endereco },
            { rotulo: "Plus code", valor: o.local_instalacao.plus_code },
            { rotulo: "Cliente", valor: o.local_instalacao.cliente },
            { rotulo: "Solicitante", valor: o.solicitante },
            { rotulo: "Criado por", valor: o.criado_por },
            { rotulo: "Criada em", valor: o.criada_em ? dataHora(o.criada_em) : null },
            ...(o.tipo_ordem === "YBA2"
              ? [
                  { rotulo: "Plano de manutenção", valor: o.plano_manutencao },
                  { rotulo: "Item de manutenção", valor: o.item_manutencao },
                  { rotulo: "Intervalo entre ciclos", valor: intervalo(o.intervalo_ciclo) },
                ]
              : []),
            { rotulo: "Última alteração", valor: dataHora(o.alterada_em) },
          ],
        },
        {
          titulo: "No DAPROM",
          itens: [
            { rotulo: "Situação", valor: rotuloDaSituacaoNoDaprom[o.no_daprom.situacao] },
            ...(o.no_daprom.motivo ? [{ rotulo: "Motivo", valor: o.no_daprom.motivo }] : []),
            { rotulo: "Próxima leitura", valor: o.alterada_depois_da_leitura ? "Vai pegar a alteração desta ordem" : "Nada novo nesta ordem" },
            ...(efeito ? [{ rotulo: "O que acontece se mudar", valor: efeito }] : []),
          ],
        },
      ]}
    />
  );
}
