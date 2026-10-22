import * as Linking from "expo-linking";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ROTULO_DA_SITUACAO_DA_ASSINATURA_JURIDICA, type AssinaturaJuridicaDaOs, type SituacaoDaAssinaturaJuridica } from "@shared/api/assinatura-juridica";
import { dataHora } from "@shared/api/formatar";
import type { TomDoSelo } from "@shared/api/tipos";
import { urlDoPdfAssinado } from "@/assinatura/api-juridica";
import { useAssinaturaJuridicaLigada, useAssinaturasDaOs } from "@/assinatura/consultas";
import { mensagemDoErro } from "@/api/erros";
import { cores, espaco } from "@/tema/tema";
import { mostrarAviso } from "@/ui/AvisoRapido";
import { Botao } from "@/ui/Botao";
import { Selo } from "@/ui/Selo";
import { Recolhivel } from "./Blocos";

const TOM_DA_SITUACAO: Record<SituacaoDaAssinaturaJuridica, TomDoSelo> = { pendente_offline: "al", aguardando: "exe", assinada: "enc", recusada: "blq", falhou: "blq" };

/**
 * As assinaturas com validade jurídica dos atos desta OS: quem assinou, o quê, quando e o PDF assinado pelo provedor. É consulta, online:
 * sem sinal, ou quando a `api` não a entrega a quem pergunta, o bloco não aparece. Sem o provedor ligado só aparece se já houver alguma.
 */
export function AssinaturasJuridicasDaOs({ osId }: { osId: string }) {
  const ligada = useAssinaturaJuridicaLigada();
  const consulta = useAssinaturasDaOs(osId);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const lista = consulta.data ?? [];
  if (lista.length === 0 && !(ligada && consulta.isSuccess)) return null;

  async function verPdf(a: AssinaturaJuridicaDaOs) {
    setAbrindo(a.id);
    try {
      await Linking.openURL(await urlDoPdfAssinado(a.id));
    } catch (e) {
      mostrarAviso(mensagemDoErro(e));
    } finally {
      setAbrindo(null);
    }
  }

  return (
    <Recolhivel titulo="Assinaturas com validade jurídica" resumo={lista.length === 0 ? "Nenhuma ainda" : `${lista.length} ${lista.length === 1 ? "assinatura" : "assinaturas"}`}>
      {lista.length === 0 ? <Text style={estilos.pequeno}>Os atos assinados desta OS aparecem aqui, com o PDF assinado pelo provedor.</Text> : null}
      {lista.map((a) => (
        <View key={a.id} style={estilos.item}>
          <Selo tom={TOM_DA_SITUACAO[a.situacao]}>{ROTULO_DA_SITUACAO_DA_ASSINATURA_JURIDICA[a.situacao]}</Selo>
          <Text style={estilos.texto}>{a.titulo}</Text>
          <Text style={estilos.pequeno}>{`${a.usuario.nome} · ${a.assinada_em ? `assinou em ${dataHora(a.assinada_em)}` : `criada em ${dataHora(a.criada_em)}`}${a.origem_offline ? " · ato feito sem sinal" : ""}`}</Text>
          {a.pdf_pronto ? <Botao titulo="Ver PDF assinado" icone="document-text-outline" variante="secundario" bloco={false} enviando={abrindo === a.id} aoPressionar={() => void verPdf(a)} /> : null}
        </View>
      ))}
    </Recolhivel>
  );
}

const estilos = StyleSheet.create({
  item: { gap: 4, paddingTop: espaco.m, borderTopWidth: 1, borderTopColor: cores.linha2 },
  texto: { fontSize: 14, color: cores.tinta2, lineHeight: 20 },
  pequeno: { fontSize: 12, color: cores.tinta4, lineHeight: 17 },
});
