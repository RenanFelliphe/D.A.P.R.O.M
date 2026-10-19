import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { dataHora, duracao, hora } from "@shared/api/formatar";
import { aprAprovadaDisponivel, situacaoDaApr, type AprDaOs, type ExecucaoDaOs, type OsDetalhada } from "@shared/api/os-app";
import type { Paginacao } from "@shared/api/tipos";
import { cliente } from "@/api/api";
import { mensagemDoErro } from "@/api/erros";
import { cores, espaco, raio } from "@/tema/tema";
import { Botao } from "@/ui/Botao";
import { Carregando } from "@/ui/Estados";
import { Selo } from "@/ui/Selo";
import { Recolhivel } from "./Blocos";

/**
 * As APRs desta OS (da mais recente para a mais antiga), com o resultado de cada uma e, nas aprovadas, quem assinou (com a hora),
 * quem ainda não assinou e quem recusou (com o motivo). Só consulta: a evidência dos itens reprovados abre na pendência 2.
 */
export function HistoricoAprs({ aprs, execucoes }: { aprs: AprDaOs[]; execucoes: ExecucaoDaOs[] }) {
  if (aprs.length === 0) return null;
  const disponivel = aprAprovadaDisponivel(aprs, execucoes);
  const usadas = new Set(execucoes.filter((e) => e.resultado !== "cancelada").map((e) => e.apr_id));
  return (
    <Recolhivel titulo="APRs desta OS" resumo={`${aprs.length} ${aprs.length === 1 ? "APR" : "APRs"}`}>
      {[...aprs].reverse().map((apr) => {
        const aprovada = apr.resultado === "aprovada";
        const situacao = situacaoDaApr(apr);
        const detalhe = aprovada
          ? apr.id === disponivel?.id
            ? situacao.pronta
              ? " · assinada por todos, ampara a execução de hoje"
              : " · aguardando assinaturas"
            : usadas.has(apr.id)
              ? " · usada numa execução"
              : situacao.inviavel
                ? " · não serve mais (recusa)"
                : " · de outro dia, não vale para executar"
          : ` · ${apr.itens_reprovados.length} item(ns) reprovado(s)`;
        return (
          <View key={apr.id} style={estilos.item}>
            <Selo tom={aprovada ? "enc" : "blq"}>{aprovada ? "Aprovada" : "Bloqueada"}</Selo>
            <Text style={estilos.texto}>{`${dataHora(apr.concluida_em)} · ${apr.modelo.codigo} v${apr.modelo.versao}`}</Text>
            <Text style={estilos.pequeno}>{`${apr.preenchida_por.nome}${detalhe}`}</Text>
            {aprovada
              ? apr.participantes.map((p) => (
                  <Text key={p.usuario_id} style={[estilos.pequeno, p.recusou_em ? estilos.recusa : null]}>
                    {p.recusou_em
                      ? `${p.nome} recusou a APR em ${dataHora(p.recusou_em)}: ${p.recusa_motivo ?? "sem motivo registrado"}`
                      : p.assinada_em
                        ? `${p.nome} assinou às ${hora(p.assinada_em)}${p.assinatura_presencial ? " (no aparelho do responsável)" : ""}`
                        : `${p.nome} ainda não assinou`}
                  </Text>
                ))
              : null}
          </View>
        );
      })}
    </Recolhivel>
  );
}

interface ExecucaoDoHistorico {
  id: string;
  os: { id: string; numero_ordem: string | null; titulo: string; equipamento: string | null };
  executor: { id: string; nome: string };
  inicio: string;
  fim: string | null;
  descricao_atividade: string | null;
  tempo_liquido_min: number | null;
}
interface RespostaHistorico extends Paginacao {
  execucoes: ExecucaoDoHistorico[];
}

const TAMANHO_DO_HISTORICO = 10;

/**
 * As execuções encerradas do equipamento da OS ou de todo o local (`GET /historico`), da mais recente para a mais antiga: o que já
 * foi feito ali antes. Só carrega quando o bloco é aberto.
 */
export function HistoricoDoLocal({ os }: { os: OsDetalhada }) {
  const [aberto, setAberto] = useState(false);
  const [escopo, setEscopo] = useState<"equipamento" | "local">(os.equipamento ? "equipamento" : "local");
  const consulta = useInfiniteQuery({
    queryKey: ["os", os.id, "historico", escopo],
    enabled: aberto,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      cliente.chamar<RespostaHistorico>("/historico", { consulta: { local_instalacao_id: os.local_instalacao.id, equipamento: escopo === "equipamento" ? os.equipamento : null, pagina: pageParam, tamanho: TAMANHO_DO_HISTORICO } }),
    getNextPageParam: (ultima) => (ultima.pagina * ultima.tamanho < ultima.total ? ultima.pagina + 1 : undefined),
  });
  const execucoes = consulta.data?.pages.flatMap((p) => p.execucoes) ?? [];
  const total = consulta.data?.pages[0]?.total;

  return (
    <Recolhivel titulo={`Histórico ${escopo === "equipamento" ? "do equipamento" : "do local"}`} resumo={os.local_instalacao.codigo + (escopo === "equipamento" && os.equipamento ? ` · ${os.equipamento}` : "")} aoAbrir={() => setAberto(true)}>
      {os.equipamento ? (
        <View style={estilos.escopos}>
          {(["equipamento", "local"] as const).map((e) => (
            <Pressable key={e} accessibilityRole="button" accessibilityState={{ selected: escopo === e }} onPress={() => setEscopo(e)} style={[estilos.escopo, escopo === e && estilos.escopoAtivo]}>
              <Text style={[estilos.escopoTexto, escopo === e && estilos.escopoTextoAtivo]}>{e === "equipamento" ? "Do equipamento" : "De todo o local"}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {consulta.isPending ? <Carregando texto="Buscando o histórico…" /> : null}
      {consulta.isError ? <Text style={estilos.recusa}>{mensagemDoErro(consulta.error)}</Text> : null}
      {consulta.isSuccess && execucoes.length === 0 ? <Text style={estilos.pequeno}>Nenhuma execução encerrada por aqui ainda.</Text> : null}
      {execucoes.map((e) => (
        <View key={e.id} style={estilos.item}>
          <Text style={estilos.texto}>{`${e.os.numero_ordem ? `OS ${e.os.numero_ordem}` : "OS sem número"} · ${e.os.titulo}`}</Text>
          <Text style={estilos.pequeno}>{`${dataHora(e.inicio)} · ${e.executor.nome}${e.tempo_liquido_min !== null ? ` · ${duracao(e.tempo_liquido_min)}` : ""}`}</Text>
          {e.descricao_atividade ? <Text style={estilos.pequeno}>{e.descricao_atividade}</Text> : null}
        </View>
      ))}
      {consulta.hasNextPage ? <Botao titulo={`Ver mais${total ? ` (${execucoes.length} de ${total})` : ""}`} variante="secundario" enviando={consulta.isFetchingNextPage} aoPressionar={() => void consulta.fetchNextPage()} /> : null}
    </Recolhivel>
  );
}

const estilos = StyleSheet.create({
  item: { gap: 3, paddingTop: espaco.m, borderTopWidth: 1, borderTopColor: cores.linha2 },
  texto: { fontSize: 14, color: cores.tinta2, lineHeight: 20 },
  pequeno: { fontSize: 12, color: cores.tinta4, lineHeight: 17 },
  recusa: { color: cores.perigo },
  escopos: { flexDirection: "row", gap: espaco.s },
  escopo: { paddingHorizontal: 12, minHeight: 36, justifyContent: "center", borderRadius: raio.pilula, backgroundColor: cores.chip },
  escopoAtivo: { backgroundColor: cores.marca },
  escopoTexto: { fontSize: 13, fontWeight: "600", color: cores.tinta3 },
  escopoTextoAtivo: { color: cores.branco },
});
