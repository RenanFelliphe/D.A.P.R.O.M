import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { hora } from "@shared/api/formatar";
import { rotuloDaOs } from "@shared/api/os-app";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { useAprsParaAssinar, useExecucoesAbertas } from "./consultas";
import { irParaAcao } from "./rotas";

/**
 * A faixa "APR aguardando a sua assinatura": uma linha por APR de hoje em que a pessoa participa e ainda não assinou nem recusou.
 * Com `osId`, só a APR dessa OS (o detalhe). É aviso de apoio: se a consulta falha, não aparece.
 */
export function FaixaDeAssinaturas({ osId }: { osId?: string }) {
  const router = useRouter();
  const { data } = useAprsParaAssinar();
  const aprs = (data ?? []).filter((a) => !osId || a.os_id === osId);
  if (aprs.length === 0) return null;
  return (
    <Aviso
      tom="al"
      icone="create-outline"
      titulo={aprs.length === 1 ? "APR aguardando a sua assinatura." : `${aprs.length} APRs aguardando a sua assinatura.`}
      rodape={
        <View style={estilos.itens}>
          {aprs.map((a) => (
            <View key={a.apr_id} style={estilos.item}>
              <Text style={estilos.itemTexto}>{`${rotuloDaOs(a)} · ${a.titulo} · ${a.local_codigo}\nAPR de ${a.preenchida_por_nome} às ${hora(a.concluida_em)}`}</Text>
              <Botao titulo="Assinar a APR" variante="secundario" bloco={false} aoPressionar={() => irParaAcao(router, "assinar-apr", a.os_id)} />
            </View>
          ))}
        </View>
      }
    >
      A execução só começa quando todos os participantes assinam, cada um na própria conta.
    </Aviso>
  );
}

/** O atalho para a execução aberta do técnico (a `api` só devolve as dele), inclusive a esquecida de outro dia. */
export function AtalhoDeExecucao() {
  const router = useRouter();
  const { data } = useExecucoesAbertas();
  return (
    <>
      {(data ?? []).map((e) => (
        <Aviso
          key={e.id}
          tom="info"
          icone="play-circle-outline"
          titulo={`Execução em andamento: ${rotuloDaOs(e)}.`}
          rodape={<Botao titulo="Continuar a execução" bloco={false} aoPressionar={() => irParaAcao(router, "continuar-execucao", e.os_id)} />}
        >
          {`${e.titulo} · iniciada às ${hora(e.inicio)}`}
        </Aviso>
      ))}
    </>
  );
}

const estilos = StyleSheet.create({
  itens: { gap: espaco.m },
  item: { gap: espaco.s, paddingTop: espaco.s, borderTopWidth: 1, borderTopColor: cores.alertaBorda },
  itemTexto: { fontSize: 13, color: cores.alertaTinta, lineHeight: 19 },
});
