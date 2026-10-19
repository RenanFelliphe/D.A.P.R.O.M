import { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { faltaNoMotivo, type OpcaoDeMotivo } from "@shared/api/execucao-motivos";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { CampoDeFormulario } from "@/ui/Campo";
import { ListaDeOpcoes, Opcao } from "@/ui/Opcao";
import { useValorDoForm } from "@/ui/useFormulario";

/** Os campos do motivo obrigatório: a escolha e o complemento que alguns motivos abrem. */
export interface ValoresDoMotivo {
  motivo: string;
  complemento: string;
}

/** O esquema do motivo: obrigatório e, nos que abrem um campo (aguardando, outro), o complemento também. A mensagem diz o que falta, no campo certo. */
export const esquemaDoMotivo = (opcoes: OpcaoDeMotivo[], deQue: string) =>
  z.object({ motivo: z.string(), complemento: z.string() }).superRefine((valores, ctx) => {
    const falta = faltaNoMotivo(opcoes, deQue, valores);
    if (falta) ctx.addIssue({ code: "custom", path: [falta.campo], message: falta.mensagem });
  });

interface CamposDoMotivoProps<T extends ValoresDoMotivo> {
  /** O formulário da tela; pode ter outros campos além do motivo (a execução esquecida pede também a hora do fim). */
  form: UseFormReturn<T>;
  opcoes: OpcaoDeMotivo[];
  /** "da pausa", "da suspensão": entra na mensagem de erro e no nome do grupo. */
  deQue: string;
  desabilitado?: boolean;
}

/**
 * A lista de motivos como opções, o campo que alguns abrem ("o que ou quem", "descrição") e, para lesão e enfermidade, o aviso de que o
 * supervisor é avisado na hora.
 */
export function CamposDoMotivo<T extends ValoresDoMotivo>({ form: formularioDaTela, opcoes, deQue, desabilitado }: CamposDoMotivoProps<T>) {
  const form = formularioDaTela as unknown as UseFormReturn<ValoresDoMotivo>;
  const [motivo, setMotivo] = useValorDoForm(form, "motivo");
  const escolhido = useMemo(() => opcoes.find((o) => o.valor === motivo), [opcoes, motivo]);
  const erros = form.formState.errors;
  return (
    <View style={estilos.campos}>
      <View style={estilos.grupo} accessibilityRole="radiogroup" accessibilityLabel={`Motivo ${deQue}`}>
        <Text style={estilos.rotulo}>Motivo</Text>
        <ListaDeOpcoes>
          {opcoes.map((o) => (
            <Opcao key={o.valor} tipo="radio" rotulo={o.rotulo} marcada={motivo === o.valor} desabilitada={desabilitado} aoPressionar={() => setMotivo(o.valor)} />
          ))}
        </ListaDeOpcoes>
        {erros.motivo?.message ? (
          <Text accessibilityRole="alert" style={estilos.erro}>
            {erros.motivo.message}
          </Text>
        ) : null}
      </View>
      {escolhido?.complemento ? (
        <CampoDeFormulario control={form.control} nome="complemento" rotulo={escolhido.complemento.rotulo} placeholder={escolhido.complemento.dica} multiline numberOfLines={3} maxLength={300} textAlignVertical="top" style={estilos.areaDeTexto} editable={!desabilitado} />
      ) : null}
      {escolhido?.avisaSupervisor ? (
        <Aviso tom="al" titulo="O supervisor será avisado na hora" >
          {`(no sino e por e-mail), porque ${escolhido.valor === "lesao" ? "a lesão no trabalho, mesmo leve, é acidente de trabalho" : "a enfermidade no serviço precisa ser registrada"}. O motivo também consta no relatório da execução.`}
        </Aviso>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  campos: { gap: espaco.m },
  grupo: { gap: espaco.s },
  rotulo: { fontSize: 14, fontWeight: "600", color: cores.tinta2 },
  erro: { fontSize: 13, color: cores.perigo },
  areaDeTexto: { minHeight: 80, paddingTop: espaco.m },
});
