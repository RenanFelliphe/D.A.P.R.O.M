import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ExigenciaDoClima, PrevisaoDoTempo } from "@shared/api/clima";
import { instrucaoDoModal, podeConfirmar } from "@/apr/clima-da-apr";
import { CampoDeFotos, type FotoEnviada } from "@/campo/Evidencias";
import { cores } from "@/tema/tema";
import { Botao } from "@/ui/Botao";
import { JanelaDeFormulario } from "@/ui/JanelaDeFormulario";
import { CartaoDePrevisao } from "./CartaoDePrevisao";

interface JanelaDoClimaProps {
  previsao: PrevisaoDoTempo;
  exigencia: Exclude<ExigenciaDoClima, "nada">;
  /** As fotos do local já tiradas (do rascunho da APR). */
  fotos: { id: string; uri: string; capturadaEm: string; comGps?: boolean }[];
  aoFotoEnviada: (foto: FotoEnviada) => void;
  aoRemoverFoto: (fotoId: string) => void;
  /** "Confirmar e continuar": a resposta "Sim" vale, com o aviso confirmado. */
  aoConfirmar: () => void;
  /** "Revisar a minha resposta": fecha sem registrar o "Sim". */
  aoRevisar: () => void;
}

/**
 * O aviso do clima na pergunta da APR: o técnico respondeu que o tempo está favorável, mas a previsão aponta risco. Mostra o nível, as
 * horas e a orientação; ele pode revisar a resposta ou confirmar e seguir (a previsão é regional e é só uma probabilidade). No risco
 * extremo, confirmar pede uma foto do local, e o supervisor é avisado na hora pela `api`. O texto não fala do que bloqueia a APR.
 */
export function JanelaDoClima({ previsao, exigencia, fotos, aoFotoEnviada, aoRemoverFoto, aoConfirmar, aoRevisar }: JanelaDoClimaProps) {
  const [faltaFoto, setFaltaFoto] = useState(false);
  const extremo = exigencia === "confirmar_com_foto";

  const confirmar = () => {
    if (!podeConfirmar(exigencia, fotos.length)) {
      setFaltaFoto(true);
      return;
    }
    aoConfirmar();
  };

  return (
    <JanelaDeFormulario titulo={extremo ? "Risco climático extremo" : "Atenção ao clima"} aoFechar={aoRevisar}>
      <Text style={estilos.texto}>Você respondeu que as condições climáticas estão favoráveis, mas a previsão para o seu local diz outra coisa.</Text>
      <CartaoDePrevisao previsao={previsao} titulo="Previsão para as próximas horas" />
      <Text style={estilos.texto}>{instrucaoDoModal(exigencia)}</Text>
      {extremo ? (
        <View style={estilos.foto}>
          <CampoDeFotos
            rotulo="Foto do local"
            exigencia="obrigatória"
            obrigatoria
            fotos={fotos}
            maximo={3}
            erro={faltaFoto && fotos.length === 0 ? "Tire a foto do local para continuar." : undefined}
            aoEnviada={(foto) => {
              setFaltaFoto(false);
              aoFotoEnviada(foto);
            }}
            aoRemover={aoRemoverFoto}
          />
        </View>
      ) : null}
      <Botao titulo="Revisar a minha resposta" variante="secundario" aoPressionar={aoRevisar} />
      <Botao titulo="Confirmar e continuar" aoPressionar={confirmar} />
    </JanelaDeFormulario>
  );
}

const estilos = StyleSheet.create({
  texto: { fontSize: 14, lineHeight: 20, color: cores.tinta3 },
  foto: { gap: 8 },
});
