import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { dataHora, hora } from "@shared/api/formatar";
import { ImagemDeArquivo } from "@/campo/ImagemDeArquivo";
import { cores, espaco, raio } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { CampoDeFormulario } from "@/ui/Campo";
import { Icone } from "@/ui/Icone";
import { JanelaDeFormulario } from "@/ui/JanelaDeFormulario";
import { useFormulario } from "@/ui/useFormulario";

export interface LinhaDeAssinatura {
  usuarioId: string;
  nome: string;
  funcao: "responsavel" | "executor";
  /** Id do arquivo da assinatura copiada do perfil para a APR; `null` = ainda não assinou. */
  assinaturaPath: string | null;
  /** Quando assinou; `null` = pendente. */
  assinadaEm: string | null;
  /** Assinou no aparelho do responsável (contingência offline). */
  presencial?: boolean;
  /** O direito de recusa: quando saiu da APR e por quê. */
  recusouEm?: string | null;
  recusaMotivo?: string | null;
  eu: boolean;
}

/**
 * O estado da assinatura de um participante da APR: assinou (com a hora e a imagem), está pendente (aguardando a pessoa assinar na
 * própria conta) ou recusou (com o motivo). Só mostra: quem assina é cada um, na própria conta.
 */
export function CartaoDeAssinatura({ linha }: { linha: LinhaDeAssinatura }) {
  const recusou = Boolean(linha.recusouEm);
  const assinou = !recusou && linha.assinadaEm !== null;
  return (
    <View style={[estilos.cartao, assinou && estilos.assinou, recusou && estilos.recusou]}>
      <Text style={estilos.nome}>
        {`${linha.nome}${linha.eu ? " (você)" : ""}`} <Text style={estilos.funcao}>{`· ${linha.funcao === "responsavel" ? "Responsável" : "Executor"}`}</Text>
      </Text>
      {assinou ? (
        <View style={estilos.estado}>
          <Icone nome="checkmark-circle" tamanho={16} cor={cores.ok} />
          <Text style={[estilos.estadoTexto, { color: cores.ok }]}>{`Assinou às ${hora(linha.assinadaEm!)}${linha.presencial ? " · no aparelho do responsável" : ""}`}</Text>
        </View>
      ) : recusou ? (
        <View style={estilos.estado}>
          <Icone nome="close-circle" tamanho={16} cor={cores.perigo} />
          <Text style={[estilos.estadoTexto, { color: cores.perigo }]}>Recusou a APR</Text>
        </View>
      ) : (
        <View style={estilos.estado}>
          <Icone nome="time-outline" tamanho={16} cor={cores.tinta4} />
          <Text style={[estilos.estadoTexto, { color: cores.tinta4 }]}>Aguardando a assinatura</Text>
        </View>
      )}
      {assinou && linha.assinaturaPath ? <ImagemDeArquivo id={linha.assinaturaPath} alt={`Assinatura de ${linha.nome}`} altura={56} /> : null}
      {recusou ? <Text style={estilos.pequeno}>{`Saiu da APR em ${dataHora(linha.recusouEm!)}: ${linha.recusaMotivo ?? "sem motivo registrado"}`}</Text> : null}
      {!assinou && !recusou ? <Text style={estilos.pequeno}>{linha.eu ? "Falta a sua assinatura: use “Assinar a APR” ou recuse, se não concorda." : `${linha.nome.split(" ")[0]} assina na própria conta e esta tela se atualiza sozinha.`}</Text> : null}
    </View>
  );
}

const esquemaDaRecusa = z.object({ motivo: z.string().trim().min(1, "Diga por que você recusa a APR: o motivo é obrigatório.") });

/**
 * O direito de recusa: quem não concorda com a APR (ou não está em condições de fazer o serviço) sai dela, deixando o motivo, que fica
 * registrado e é avisado ao supervisor. O motivo é obrigatório: sem ele, a mensagem aparece junto do campo.
 */
export function JanelaDeRecusa({ aoRecusar, aoFechar }: { aoRecusar: (motivo: string) => Promise<void>; aoFechar: () => void }) {
  const { form, enviar, enviando, erroEnvio } = useFormulario(esquemaDaRecusa, { motivo: "" });
  return (
    <JanelaDeFormulario titulo="Recusar a APR" aoFechar={enviando ? () => undefined : aoFechar}>
      <Aviso tom="al" titulo="Direito de recusa.">
        Você sai desta APR e não assina. O supervisor é avisado na hora, com o seu motivo. Se o responsável recusar, ou sobrarem menos de 2 participantes, será preciso fazer uma APR nova.
      </Aviso>
      <CampoDeFormulario control={form.control} nome="motivo" rotulo="Motivo da recusa" placeholder="Por que você não concorda com esta APR?" multiline numberOfLines={4} maxLength={500} textAlignVertical="top" style={estilos.areaDeTexto} editable={!enviando} />
      {erroEnvio ? <Aviso tom="blq">{erroEnvio}</Aviso> : null}
      <Botao titulo={enviando ? "Enviando…" : "Recusar a APR"} variante="perigo" enviando={enviando} aoPressionar={() => void enviar(({ motivo }) => aoRecusar(motivo.trim()))()} />
      <Botao titulo="Voltar" variante="texto" aoPressionar={enviando ? () => undefined : aoFechar} />
    </JanelaDeFormulario>
  );
}

const estilos = StyleSheet.create({
  cartao: { gap: espaco.s, padding: espaco.m, borderRadius: raio.m, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.superficie },
  assinou: { borderColor: cores.okBorda, backgroundColor: cores.okFundo },
  recusou: { borderColor: cores.perigoBorda, backgroundColor: cores.perigoFundo },
  nome: { fontSize: 15, fontWeight: "700", color: cores.tinta },
  funcao: { fontWeight: "400", color: cores.tinta4 },
  estado: { flexDirection: "row", alignItems: "center", gap: espaco.s },
  estadoTexto: { fontSize: 13, fontWeight: "600" },
  pequeno: { fontSize: 13, lineHeight: 19, color: cores.tinta3 },
  areaDeTexto: { minHeight: 100, paddingTop: espaco.m },
});
