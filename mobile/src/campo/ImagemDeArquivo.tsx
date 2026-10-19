import { useQuery } from "@tanstack/react-query";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { cliente } from "@/api/api";
import { cores, raio } from "@/tema/tema";

/** O endereço assinado de um arquivo guardado (foto, assinatura); a `api` o dá por 10 minutos, então o app o pede de novo antes disso. */
export function useUrlDoArquivo(id: string | null | undefined) {
  return useQuery({
    queryKey: ["arquivo", id],
    enabled: Boolean(id),
    staleTime: 8 * 60_000,
    queryFn: async () => (await cliente.chamar<{ url: string }>(`/arquivos/${id}/url`)).url,
  });
}

/** Mostra uma imagem guardada pelo id (a assinatura do perfil, a foto de uma APR); sem id ou com falha, deixa o espaço vazio. */
export function ImagemDeArquivo({ id, alt, altura = 56, estilo }: { id: string | null | undefined; alt: string; altura?: number; estilo?: StyleProp<ViewStyle> }) {
  const { data } = useUrlDoArquivo(id);
  return (
    <View style={[estilos.caixa, { height: altura }, estilo]}>
      {data ? <Image accessibilityLabel={alt} source={{ uri: data }} resizeMode="contain" style={estilos.imagem} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { borderWidth: 1, borderColor: cores.linha, borderRadius: raio.s, backgroundColor: cores.superficie, padding: 4, alignSelf: "stretch" },
  imagem: { flex: 1, width: "100%" },
});
