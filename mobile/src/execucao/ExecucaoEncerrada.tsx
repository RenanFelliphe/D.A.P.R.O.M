import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import type { RespostaComPontos } from "@shared/api/gamificacao";
import { mensagemDoErro } from "@/api/erros";
import { AvisoDePontos } from "@/campo/AvisoDePontos";
import { abrirPdfDaOs } from "@/os/detalhe/pdf";
import { espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";

interface ExecucaoEncerradaProps {
  osId: string;
  /**
   * Em que ponto a OS está: `aguardando_supervisor` (o responsável assinou; falta o supervisor ler o relatório e assinar) ou `encerrada`
   * (o supervisor assinou: concluída, com o PDF).
   */
  status: "aguardando_supervisor" | "encerrada";
  /** Os pontos que a assinatura do encerramento acabou de dar ("+N pontos"). */
  pontos?: RespostaComPontos | null;
}

/**
 * A tela final do técnico. Depois da assinatura do responsável a OS aguarda o supervisor: ele lê o relatório da execução e assina por
 * último (na web), e só então a OS está concluída e o PDF existe. Com a OS já concluída, o botão abre o PDF no leitor do aparelho (a `api`
 * o gera na hora, se ainda não estiver pronto).
 */
export function ExecucaoEncerrada({ osId, status, pontos }: ExecucaoEncerradaProps) {
  const router = useRouter();
  const concluida = status === "encerrada";
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function abrirPdf() {
    setErro(null);
    setAbrindo(true);
    try {
      await abrirPdfDaOs(osId);
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setAbrindo(false);
    }
  }

  return (
    <View style={estilos.tela}>
      {concluida ? (
        <Aviso tom="ok" icone="checkmark-circle-outline" titulo="OS concluída.">
          O supervisor leu o relatório e assinou: a OS está concluída. Ao abrir o PDF, ele é preparado na hora, se ainda não estiver pronto.
        </Aviso>
      ) : (
        <Aviso tom="ok" icone="checkmark-circle-outline" titulo="Encerramento assinado. Agora a OS aguarda o supervisor.">
          Ele lê o relatório da execução e assina por último; só então a OS está concluída e o PDF fica pronto. Você não precisa fazer mais nada.
        </Aviso>
      )}
      <AvisoDePontos resposta={pontos} />
      {erro ? <Aviso tom="blq">{erro}</Aviso> : null}
      {concluida ? <Botao titulo="Abrir o PDF" icone="document-text-outline" enviando={abrindo} aoPressionar={() => void abrirPdf()} /> : null}
      <Botao titulo="Voltar à lista" variante={concluida ? "secundario" : "primario"} aoPressionar={() => router.dismissTo("/lista")} />
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { gap: espaco.m },
});
