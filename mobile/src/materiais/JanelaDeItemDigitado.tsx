import { Controller } from "react-hook-form";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { CATEGORIAS, rotuloDaCategoria, UNIDADES_SUGERIDAS, type CategoriaMaterial } from "@shared/api/catalogo";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { CampoDeFormulario } from "@/ui/Campo";
import { JanelaDeFormulario } from "@/ui/JanelaDeFormulario";
import { Segmentos } from "@/ui/Segmentos";
import { useFormulario } from "@/ui/useFormulario";

interface ValoresDoItem {
  descricao: string;
  unidade: string;
  categoria: CategoriaMaterial;
}

const esquema: z.ZodType<ValoresDoItem> = z.object({
  descricao: z.string().trim().min(2, "Diga o que é o item.").max(200, "A descrição passa de 200 caracteres."),
  unidade: z.string().trim().min(1, "Diga a unidade (un, par, m…).").max(20, "A unidade passa de 20 caracteres."),
  categoria: z.enum(CATEGORIAS),
});

interface JanelaDeItemDigitadoProps {
  /** Confere se o item já está na lista; lança um `Error` com a mensagem para a janela mostrar. */
  aoAdicionar: (item: ValoresDoItem) => void;
  aoFechar: () => void;
}

/**
 * O "Não achei": a pessoa digita o item que não está no catálogo (descrição, unidade e categoria). Quem avalia a sugestão o liga a um
 * material que já existe ou o cadastra, para o catálogo não se encher de variações do mesmo nome.
 */
export function JanelaDeItemDigitado({ aoAdicionar, aoFechar }: JanelaDeItemDigitadoProps) {
  const { form, enviar, erroEnvio } = useFormulario<ValoresDoItem>(esquema, { descricao: "", unidade: "", categoria: "material" });
  const unidade = form.watch("unidade");

  return (
    <JanelaDeFormulario titulo="Não achei o item" aoFechar={aoFechar}>
      <Text style={estilos.resumo}>Digite o item como você o conhece. Quem avalia a sugestão liga o item a um material do catálogo ou o cadastra.</Text>
      <CampoDeFormulario control={form.control} nome="descricao" rotulo="O que é" placeholder="Chave inglesa 12 pol." maxLength={200} autoCapitalize="sentences" />
      <View style={estilos.grupo}>
        <CampoDeFormulario control={form.control} nome="unidade" rotulo="Unidade" placeholder="un, par, m, kg…" maxLength={20} autoCapitalize="none" />
        <Segmentos rolavel opcoes={UNIDADES_SUGERIDAS.map((u) => ({ id: u, rotulo: u }))} valor={unidade} aoMudar={(u) => form.setValue("unidade", u, { shouldDirty: true, shouldValidate: Boolean(form.getFieldState("unidade").error) })} />
      </View>
      <Controller
        control={form.control}
        name="categoria"
        render={({ field }) => (
          <View style={estilos.grupo}>
            <Text style={estilos.rotulo}>Tipo</Text>
            <Segmentos opcoes={CATEGORIAS.map((c) => ({ id: c, rotulo: rotuloDaCategoria[c] }))} valor={field.value} aoMudar={field.onChange} />
          </View>
        )}
      />
      {erroEnvio ? <Aviso tom="blq">{erroEnvio}</Aviso> : null}
      <Botao titulo="Adicionar à lista" icone="add" aoPressionar={enviar((v) => aoAdicionar(v))} />
      <Botao titulo="Voltar" variante="texto" aoPressionar={aoFechar} />
    </JanelaDeFormulario>
  );
}

const estilos = StyleSheet.create({
  resumo: { fontSize: 15, lineHeight: 22, color: cores.tinta2 },
  grupo: { gap: espaco.s },
  rotulo: { fontSize: 14, fontWeight: "600", color: cores.tinta2 },
});
