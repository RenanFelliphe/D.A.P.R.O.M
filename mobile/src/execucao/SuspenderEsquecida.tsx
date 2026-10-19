import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { complementoDoMotivo, faltaNoMotivo, MOTIVOS_DA_SUSPENSAO } from "@shared/api/execucao-motivos";
import type { ExecucaoAberta } from "@shared/api/execucao-tempo";
import { dataHora } from "@shared/api/formatar";
import { enviarEvento } from "@/offline/app";
import { useAtualizarDepoisDoEvento } from "@/campo/useAcao";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { CampoDeFormulario } from "@/ui/Campo";
import { useFormulario } from "@/ui/useFormulario";
import { CamposDoMotivo } from "./CamposDoMotivo";
import { dataEHoraComoInstante, faltaNoFim, paraCampoDeData, paraCampoDeHora } from "./data-e-hora";

/**
 * A execução esquecida de outro dia: antes de qualquer coisa o técnico a suspende, informando a hora real do fim e o motivo (é uma
 * suspensão, então o motivo é obrigatório como na janela de suspender). A `api` recusa iniciar outra enquanto isso. Nada é encerrado
 * sozinho. Esta suspensão não grava a localização: o aparelho não está mais onde a execução parou.
 */
export function SuspenderEsquecida({ execucao }: { execucao: ExecucaoAberta }) {
  const atualizarDepois = useAtualizarDepoisDoEvento();
  const inicio = useMemo(() => new Date(execucao.inicio), [execucao.inicio]);

  const esquema = useMemo(
    () =>
      z.object({ dia: z.string(), hora: z.string(), motivo: z.string(), complemento: z.string() }).superRefine((valores, ctx) => {
        const faltaOFim = faltaNoFim(valores.dia, valores.hora, inicio);
        if (faltaOFim) ctx.addIssue({ code: "custom", path: ["hora"], message: faltaOFim });
        const falta = faltaNoMotivo(MOTIVOS_DA_SUSPENSAO, "da suspensão", valores);
        if (falta) ctx.addIssue({ code: "custom", path: [falta.campo], message: falta.mensagem });
      }),
    [inicio],
  );
  const [agora] = useState(() => new Date());
  const { form, enviar, enviando, erroEnvio } = useFormulario(esquema, { dia: paraCampoDeData(agora), hora: paraCampoDeHora(agora), motivo: "", complemento: "" });

  const suspender = enviar(async (valores) => {
    const fim = dataEHoraComoInstante(valores.dia, valores.hora)!;
    await enviarEvento({
      tipo: "execucao_suspensa",
      os_id: execucao.os_id,
      payload: { execucao_id: execucao.id, fim: fim.toISOString(), motivo: valores.motivo, ...complementoDoMotivo(MOTIVOS_DA_SUSPENSAO, valores) },
    });
    await atualizarDepois();
  });

  return (
    <View style={estilos.tela}>
      <Aviso tom="al" icone="time-outline" titulo="Suspender a execução de outro dia.">
        {`A OS ${execucao.numero_ordem ?? execucao.titulo} ficou em execução desde ${dataHora(execucao.inicio)} e não foi suspensa. Informe a hora real em que você parou e o motivo para poder seguir; a OS fica pendente e uma nova APR retoma o trabalho.`}
      </Aviso>
      <Text style={estilos.rotulo}>Hora real do fim · obrigatória</Text>
      <View style={estilos.linha}>
        <View style={estilos.dia}>
          <CampoDeFormulario control={form.control} nome="dia" rotulo="Data" placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" maxLength={10} editable={!enviando} />
        </View>
        <View style={estilos.hora}>
          <CampoDeFormulario control={form.control} nome="hora" rotulo="Hora" placeholder="hh:mm" keyboardType="numbers-and-punctuation" maxLength={5} editable={!enviando} />
        </View>
      </View>
      <CamposDoMotivo form={form} opcoes={MOTIVOS_DA_SUSPENSAO} deQue="da suspensão" desabilitado={enviando} />
      {erroEnvio ? <Aviso tom="blq">{erroEnvio}</Aviso> : null}
      <Botao titulo={enviando ? "Suspendendo…" : "Suspender a execução"} enviando={enviando} aoPressionar={() => void suspender()} />
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { gap: espaco.m },
  rotulo: { fontSize: 14, fontWeight: "600", color: cores.tinta2 },
  linha: { flexDirection: "row", gap: espaco.m },
  dia: { flex: 3 },
  hora: { flex: 2 },
});
