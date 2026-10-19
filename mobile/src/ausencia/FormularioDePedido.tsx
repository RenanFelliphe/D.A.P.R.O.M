import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { dataDoDia, hoje } from "@shared/api/formatar";
import { retornoDoPeriodo } from "@shared/api/ausencia-periodo";
import { cliente } from "@/api/api";
import { JanelaDeAssinatura } from "@/campo/JanelaDeAssinatura";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { CampoDeFormulario } from "@/ui/Campo";
import { JanelaDeFormulario } from "@/ui/JanelaDeFormulario";
import { Opcao } from "@/ui/Opcao";
import { useFormulario } from "@/ui/useFormulario";
import { campoDoDia, corpoDoPedido, faltaNoInicio, faltaNoRetornoDigitado, faltaNosDias, LIMITE_DO_MOTIVO, periodoDoTexto, type PeriodoEmTexto } from "./regras";

interface ValoresDoPedido extends PeriodoEmTexto {
  motivo: string;
}

/** As mensagens ficam junto de cada campo: o motivo, o primeiro dia e, conforme o modo, os dias ou a data de retorno. */
const esquema: z.ZodType<ValoresDoPedido> = z
  .object({
    motivo: z.string().trim().min(1, "Diga o motivo da ausência.").max(LIMITE_DO_MOTIVO, `O motivo passa de ${LIMITE_DO_MOTIVO} caracteres.`),
    inicio: z.string(),
    modo: z.enum(["dias", "retorno"]),
    dias: z.string(),
    retorno: z.string(),
  })
  .superRefine((v, ctx) => {
    const problema = (path: string, message: string | null) => message && ctx.addIssue({ code: "custom", path: [path], message });
    problema("inicio", faltaNoInicio(v.inicio, hoje()));
    if (v.modo === "dias") problema("dias", faltaNosDias(v.dias));
    else problema("retorno", faltaNoRetornoDigitado(v.retorno, v.inicio));
  });

/**
 * O pedido da ausência (o técnico) ou o registro da própria (o supervisor titular): o motivo e o período (`POST /ausencias`). O pedido
 * não é assinado, e o supervisor aprova, ajusta ou recusa; o registro do supervisor vale na hora e é assinado. As datas são digitadas
 * como `dd/mm/aaaa` (o aparelho não tem seletor de data nativo sem um módulo a mais).
 */
export function FormularioDePedido({ registrar, aoFechar }: { registrar: boolean; aoFechar: () => void }) {
  const consultas = useQueryClient();
  const [assinando, setAssinando] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);
  const { form, enviar, enviando, erroEnvio } = useFormulario<ValoresDoPedido>(esquema, { motivo: "", inicio: campoDoDia(hoje()), modo: "dias", dias: "", retorno: "" });
  const valores = form.watch();
  const retorno = retornoDoPeriodo(periodoDoTexto(valores));

  const atualizarDepois = () => Promise.all(["ausencias", "eu", "os", "me"].map((k) => consultas.invalidateQueries({ queryKey: [k] })));

  async function mandar(): Promise<string | void> {
    const v = form.getValues();
    const resposta = await cliente.chamar<{ execucao_aberta?: boolean }>("/ausencias", { metodo: "POST", corpo: corpoDoPedido(v.motivo, v, registrar) });
    await atualizarDepois();
    if (registrar) setEnviado("Ausência registrada e assinada. Ela vale a partir do primeiro dia informado.");
    // O início da ausência suspende a execução aberta da pessoa: ela fica sabendo agora.
    if (registrar && resposta.execucao_aberta) {
      return "Você está com uma execução aberta. Quando a ausência começar, a execução é suspensa e a OS fica pendente: a equipe a retoma com uma APR nova.";
    }
  }

  const resumo = registrar
    ? "A ausência registrada vale assim que você a assina. Quem está ausente só visualiza o sistema e não recebe reserva de OS."
    : "O supervisor da equipe aprova, ajusta as datas ou recusa. Se aprovar, você confirma, assinando, para a ausência valer.";

  // Registrar assina na hora: a janela da assinatura vem depois de o formulário estar certo. Pedir envia direto, sem assinatura.
  if (assinando) {
    return <JanelaDeAssinatura titulo="Registrar a minha ausência" resumo={`${resumo}\n\nMotivo: ${valores.motivo.trim()}`} rotuloConfirmar="Registrar e assinar" aoConfirmar={mandar} aoFechar={() => setAssinando(false)} />;
  }

  return (
    <JanelaDeFormulario titulo={registrar ? "Registrar a minha ausência" : "Pedir ausência"} aoFechar={enviando ? () => undefined : aoFechar}>
      {enviado ? (
        <>
          <Aviso tom="ok">{enviado}</Aviso>
          <Botao titulo="Entendi" aoPressionar={aoFechar} />
        </>
      ) : (
        <>
          <Text style={estilos.resumo}>{resumo}</Text>
          <CampoDeFormulario control={form.control} nome="motivo" rotulo="Motivo" placeholder="Férias, atestado, viagem, treinamento…" multiline numberOfLines={3} textAlignVertical="top" maxLength={LIMITE_DO_MOTIVO} style={estilos.areaDeTexto} />
          <CampoDeFormulario control={form.control} nome="inicio" rotulo="Primeiro dia de ausência" placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" maxLength={10} />
          <Controller
            control={form.control}
            name="modo"
            render={({ field }) => (
              <View style={estilos.modos}>
                <Text style={estilos.rotulo}>Até quando</Text>
                <Opcao tipo="radio" rotulo="Número de dias" marcada={field.value === "dias"} aoPressionar={() => field.onChange("dias")} />
                <Opcao tipo="radio" rotulo="Data de retorno" marcada={field.value === "retorno"} aoPressionar={() => field.onChange("retorno")} />
              </View>
            )}
          />
          {valores.modo === "dias" ? (
            <CampoDeFormulario control={form.control} nome="dias" rotulo="Dias corridos (1 a 365)" keyboardType="number-pad" maxLength={3} />
          ) : (
            <CampoDeFormulario control={form.control} nome="retorno" rotulo="Data de retorno" placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" maxLength={10} />
          )}
          <Text style={estilos.nota} accessibilityLiveRegion="polite">
            {retorno ? `Volta ao trabalho em ${dataDoDia(retorno)} (o retorno é o primeiro dia de volta).` : "O retorno é o primeiro dia de volta ao trabalho."}
          </Text>
          {erroEnvio ? <Aviso tom="blq">{erroEnvio}</Aviso> : null}
          <Botao
            titulo={registrar ? "Continuar para assinar" : "Enviar pedido"}
            enviando={enviando}
            aoPressionar={enviar(async () => {
              if (registrar) return setAssinando(true);
              await mandar();
              setEnviado("Pedido enviado. O supervisor da equipe foi avisado e vai aprovar, ajustar as datas ou recusar. Você acompanha aqui.");
            })}
          />
          <Botao titulo="Voltar" variante="texto" aoPressionar={enviando ? () => undefined : aoFechar} />
        </>
      )}
    </JanelaDeFormulario>
  );
}

const estilos = StyleSheet.create({
  resumo: { fontSize: 15, lineHeight: 22, color: cores.tinta2 },
  areaDeTexto: { minHeight: 84, paddingTop: espaco.m },
  modos: { gap: espaco.s },
  rotulo: { fontSize: 14, fontWeight: "600", color: cores.tinta2 },
  nota: { fontSize: 13, lineHeight: 18, color: cores.tinta4 },
});
