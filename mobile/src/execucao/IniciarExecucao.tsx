import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { hora } from "@shared/api/formatar";
import { participantesAtivos, type AprDaApi } from "@shared/api/execucao-tempo";
import { comPosicao } from "@shared/api/localizacao";
import { novoUuid } from "@shared/api/uuid";
import { enviarEvento } from "@/offline/app";
import { obterPosicao } from "@/campo/localizacao";
import { useAtualizarDepoisDoEvento } from "@/campo/useAcao";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { CampoDeFormulario } from "@/ui/Campo";
import { useFormulario } from "@/ui/useFormulario";
import { AvisoDeLocalizacao } from "./AvisoDeLocalizacao";

const esquema = z.object({
  pessoas: z
    .string()
    .trim()
    .min(1, "Informe quantas pessoas vão executar o serviço.")
    .refine((v) => /^\d+$/.test(v) && Number(v) >= 1, "O número de pessoas precisa ser um número inteiro, de 1 em diante."),
});

/**
 * O início da execução, amparada pela APR aprovada e assinada por todos: informa o número de pessoas (o padrão são os participantes
 * que ficaram na APR). A localização é registrada aqui (sem bloquear, se não houver).
 */
export function IniciarExecucao({ osId, apr }: { osId: string; apr: Pick<AprDaApi, "id" | "concluida_em" | "participantes"> }) {
  const atualizarDepois = useAtualizarDepoisDoEvento();
  const ativos = participantesAtivos(apr.participantes);
  const { form, enviar, enviando, erroEnvio } = useFormulario(esquema, { pessoas: String(ativos.length) });

  const iniciar = enviar(async ({ pessoas }) => {
    const posicao = await obterPosicao();
    await enviarEvento({
      tipo: "execucao_iniciada",
      os_id: osId,
      payload: { id: novoUuid(), apr_id: apr.id, numero_pessoas: Number(pessoas), inicio: new Date().toISOString(), ...comPosicao(posicao) },
    });
    await atualizarDepois();
  });

  return (
    <View style={estilos.tela}>
      <Aviso tom="ok" icone="checkmark-circle-outline" titulo={`APR aprovada às ${hora(apr.concluida_em)} e assinada por todos.`}>
        Ela ampara esta execução, só hoje.
      </Aviso>
      <Text style={estilos.suave}>{`Participantes da APR: ${ativos.map((p) => p.nome).join(", ")}.`}</Text>
      <CampoDeFormulario control={form.control} nome="pessoas" rotulo="Número de pessoas" keyboardType="number-pad" editable={!enviando} />
      <AvisoDeLocalizacao />
      {erroEnvio ? <Aviso tom="blq">{erroEnvio}</Aviso> : null}
      <Botao titulo={enviando ? "Iniciando…" : "Iniciar a execução"} icone="play" enviando={enviando} aoPressionar={() => void iniciar()} />
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { gap: espaco.m },
  suave: { fontSize: 13, lineHeight: 19, color: cores.tinta3 },
});
