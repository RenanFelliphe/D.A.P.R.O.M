import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { rotuloDaCategoria, type Material } from "@shared/api/catalogo";
import { mensagemDoErro } from "@/api/erros";
import { cores, espaco, raio } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Campo } from "@/ui/Campo";
import { Carregando } from "@/ui/Estados";
import { Icone } from "@/ui/Icone";
import { JanelaDeFormulario } from "@/ui/JanelaDeFormulario";
import { useBuscaDeMateriais } from "./consultas";

interface BuscaDeMaterialProps {
  titulo: string;
  /** O material que já está na lista (ou já foi escolhido): aparece, mas não dá para escolher de novo. */
  jaEscolhido?: (m: Material) => boolean;
  aoEscolher: (m: Material) => void;
  aoFechar: () => void;
  /** O que vem abaixo dos resultados (o "Não achei o item"). */
  rodape?: React.ReactNode;
}

const ESPERA_DA_DIGITACAO_MS = 300;

/** A janela de busca no catálogo de materiais: a pessoa digita, a lista filtra, um toque escolhe e fecha. */
export function BuscaDeMaterial({ titulo, jaEscolhido, aoEscolher, aoFechar, rodape }: BuscaDeMaterialProps) {
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  // A busca só sai depois de uma pausa na digitação: cada letra não vira uma chamada à api.
  useEffect(() => {
    const espera = setTimeout(() => setBusca(texto.trim()), ESPERA_DA_DIGITACAO_MS);
    return () => clearTimeout(espera);
  }, [texto]);
  const materiais = useBuscaDeMateriais(busca);

  return (
    <JanelaDeFormulario titulo={titulo} aoFechar={aoFechar}>
      <Campo rotulo="Buscar no catálogo" value={texto} onChangeText={setTexto} placeholder="Nome ou código do material" autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
      {materiais.isPending ? (
        <Carregando texto="Buscando…" />
      ) : materiais.isError ? (
        <Aviso tom="blq">{mensagemDoErro(materiais.error)}</Aviso>
      ) : materiais.data.length === 0 ? (
        <Text style={estilos.vazio}>{busca ? `Nenhum material encontrado para “${busca}”.` : "O catálogo ainda não tem materiais."}</Text>
      ) : (
        <View style={estilos.lista}>
          {materiais.data.map((m) => {
            const escolhido = jaEscolhido?.(m) ?? false;
            return (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                accessibilityLabel={`${m.descricao}${escolhido ? ", já escolhido" : ""}`}
                onPress={escolhido ? undefined : () => aoEscolher(m)}
                style={({ pressed }) => [estilos.linha, escolhido && estilos.escolhida, { opacity: pressed ? 0.85 : 1 }]}
              >
                <View style={estilos.texto}>
                  <Text style={estilos.descricao}>{m.descricao}</Text>
                  <Text style={estilos.detalhe}>{[m.codigo, m.unidade, rotuloDaCategoria[m.categoria]].filter(Boolean).join(" · ")}</Text>
                </View>
                {escolhido ? <Text style={estilos.detalhe}>Já está</Text> : <Icone nome="add-circle-outline" tamanho={24} cor={cores.marca} />}
              </Pressable>
            );
          })}
        </View>
      )}
      {rodape}
    </JanelaDeFormulario>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco.s },
  linha: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: espaco.m, paddingHorizontal: espaco.m, paddingVertical: espaco.s, borderRadius: raio.m, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.superficie },
  escolhida: { backgroundColor: cores.superficie2 },
  texto: { flex: 1, gap: 2 },
  descricao: { fontSize: 15, color: cores.tinta, lineHeight: 21 },
  detalhe: { fontSize: 12, color: cores.tinta4 },
  vazio: { fontSize: 14, color: cores.tinta4, textAlign: "center", paddingVertical: espaco.l },
});
