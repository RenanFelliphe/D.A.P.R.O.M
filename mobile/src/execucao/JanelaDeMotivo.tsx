import { useMemo } from "react";
import { Text } from "react-native";
import { complementoDoMotivo, type OpcaoDeMotivo } from "@shared/api/execucao-motivos";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { JanelaDeFormulario } from "@/ui/JanelaDeFormulario";
import { useFormulario } from "@/ui/useFormulario";
import { AvisoDeLocalizacao } from "./AvisoDeLocalizacao";
import { CamposDoMotivo, esquemaDoMotivo, type ValoresDoMotivo } from "./CamposDoMotivo";

export interface MotivoEscolhido {
  motivo: string;
  complemento?: string;
}

interface JanelaDeMotivoProps {
  titulo: string;
  /** "da pausa", "da suspensão": entra na mensagem de erro quando nenhum motivo foi escolhido. */
  deQue: string;
  resumo?: string;
  opcoes: OpcaoDeMotivo[];
  rotuloConfirmar: string;
  /** O texto do botão enquanto envia. */
  rotuloEnviando: string;
  /** Faz a chamada à `api`; uma falha vira o aviso da janela, acima do botão. Ao terminar, quem chamou fecha a janela. */
  aoConfirmar: (escolha: MotivoEscolhido) => Promise<void>;
  aoFechar: () => void;
}

/**
 * A janela do motivo obrigatório da pausa e da suspensão: a lista de motivos, o campo que alguns abrem e, para lesão e enfermidade, o
 * aviso de que o supervisor é avisado na hora. Sem motivo (ou sem o campo exigido), o botão não fica parado: a mensagem aparece junto
 * do campo. As duas ações gravam a localização, então a janela traz o aviso (LGPD).
 */
export function JanelaDeMotivo({ titulo, deQue, resumo, opcoes, rotuloConfirmar, rotuloEnviando, aoConfirmar, aoFechar }: JanelaDeMotivoProps) {
  const esquema = useMemo(() => esquemaDoMotivo(opcoes, deQue), [opcoes, deQue]);
  const { form, enviar, enviando, erroEnvio } = useFormulario<ValoresDoMotivo>(esquema, { motivo: "", complemento: "" });
  return (
    <JanelaDeFormulario titulo={titulo} aoFechar={enviando ? () => undefined : aoFechar}>
      {resumo ? <Text style={{ fontSize: 15, lineHeight: 22 }}>{resumo}</Text> : null}
      <CamposDoMotivo form={form} opcoes={opcoes} deQue={deQue} desabilitado={enviando} />
      <AvisoDeLocalizacao />
      {erroEnvio ? <Aviso tom="blq">{erroEnvio}</Aviso> : null}
      <Botao titulo={enviando ? rotuloEnviando : rotuloConfirmar} enviando={enviando} aoPressionar={() => void enviar(async (valores) => aoConfirmar({ motivo: valores.motivo, ...complementoDoMotivo(opcoes, valores) }))()} />
      <Botao titulo="Voltar" variante="texto" aoPressionar={enviando ? () => undefined : aoFechar} />
    </JanelaDeFormulario>
  );
}
