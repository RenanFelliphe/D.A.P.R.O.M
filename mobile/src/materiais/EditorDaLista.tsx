import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { rotuloDaCategoria, type Material } from "@shared/api/catalogo";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { Campo } from "@/ui/Campo";
import { Cartao } from "@/ui/Cartao";
import { Icone } from "@/ui/Icone";
import { Selo } from "@/ui/Selo";
import { BuscaDeMaterial } from "./BuscaDeMaterial";
import { JanelaDeItemDigitado } from "./JanelaDeItemDigitado";
import { itemDigitado, itemDoCatalogo, jaEstaNaLista, LIMITE_DA_OBSERVACAO, type ItemEditavel } from "./lista";

interface EditorDaListaProps {
  lista: ItemEditavel[];
  aoMudar: (lista: ItemEditavel[]) => void;
  /** Mostra o "Não achei o item". Quem avalia só escolhe do catálogo (o item digitado ele liga ou cadastra antes). */
  permitirDigitar?: boolean;
  /** A mensagem do esquema para o que está errado na lista. */
  erro?: string;
}

/**
 * O editor da lista de materiais, o mesmo na sugestão do técnico e no "Ajustar e aceitar" de quem avalia: cada item com quantidade e
 * observação e o botão de tirar, mais o de adicionar do catálogo (busca) ou, para quem sugere, o item digitado.
 */
export function EditorDaLista({ lista, aoMudar, permitirDigitar = true, erro }: EditorDaListaProps) {
  const [buscando, setBuscando] = useState(false);
  const [digitando, setDigitando] = useState(false);

  const mudar = (chave: string, parcial: Partial<ItemEditavel>) => aoMudar(lista.map((i) => (i.chave === chave ? { ...i, ...parcial } : i)));
  const tirar = (chave: string) => aoMudar(lista.filter((i) => i.chave !== chave));
  const escolher = (m: Material) => {
    aoMudar([...lista, itemDoCatalogo(m)]);
    setBuscando(false);
  };

  return (
    <View style={estilos.editor}>
      {lista.length === 0 ? <Text style={estilos.vazio}>A lista está vazia. Adicione os itens do serviço.</Text> : null}
      {lista.map((i) => (
        <Cartao key={i.chave}>
          <View style={estilos.topo}>
            <View style={estilos.texto}>
              <Text style={estilos.descricao}>{i.codigo ? `${i.descricao} · ${i.codigo}` : i.descricao}</Text>
              <Text style={estilos.detalhe}>{`${i.unidade} · ${rotuloDaCategoria[i.categoria]}`}</Text>
            </View>
            {!i.material_id ? <Selo tom="al">{i.criar_material ? "Novo no catálogo" : "Digitado"}</Selo> : null}
          </View>
          <Campo
            rotulo={`Quantidade (${i.unidade})`}
            value={i.quantidade}
            onChangeText={(quantidade) => mudar(i.chave, { quantidade })}
            keyboardType="decimal-pad"
            placeholder="Conforme a necessidade"
            maxLength={12}
          />
          <Campo rotulo="Observação (opcional)" value={i.observacao} onChangeText={(observacao) => mudar(i.chave, { observacao })} maxLength={LIMITE_DA_OBSERVACAO} placeholder="Tamanho, modelo, norma…" />
          <Pressable accessibilityRole="button" accessibilityLabel={`Tirar ${i.descricao} da lista`} onPress={() => tirar(i.chave)} style={estilos.tirar} hitSlop={8}>
            <Icone nome="trash-outline" tamanho={18} cor={cores.perigo} />
            <Text style={estilos.tirarTexto}>Tirar da lista</Text>
          </Pressable>
        </Cartao>
      ))}
      {erro ? <Aviso tom="blq">{erro}</Aviso> : null}
      <Botao titulo="Adicionar do catálogo" icone="add" variante="secundario" aoPressionar={() => setBuscando(true)} />
      {permitirDigitar ? <Botao titulo="Não achei o item" icone="create-outline" variante="texto" aoPressionar={() => setDigitando(true)} /> : null}

      {buscando ? (
        <BuscaDeMaterial
          titulo="Adicionar do catálogo"
          jaEscolhido={(m) => jaEstaNaLista(lista, { material_id: m.id, descricao: m.descricao, unidade: m.unidade })}
          aoEscolher={escolher}
          aoFechar={() => setBuscando(false)}
          rodape={
            permitirDigitar ? (
              <Botao
                titulo="Não achei o item"
                icone="create-outline"
                variante="texto"
                aoPressionar={() => {
                  setBuscando(false);
                  setDigitando(true);
                }}
              />
            ) : undefined
          }
        />
      ) : null}
      {digitando ? (
        <JanelaDeItemDigitado
          aoFechar={() => setDigitando(false)}
          aoAdicionar={(dados) => {
            const item = itemDigitado(dados);
            if (jaEstaNaLista(lista, item)) throw new Error(`“${item.descricao}” já está na lista.`);
            aoMudar([...lista, item]);
            setDigitando(false);
          }}
        />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  editor: { gap: espaco.m },
  vazio: { fontSize: 14, color: cores.tinta4, textAlign: "center", paddingVertical: espaco.l },
  topo: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: espaco.s },
  texto: { flex: 1, gap: 2 },
  descricao: { fontSize: 15, fontWeight: "600", color: cores.tinta, lineHeight: 21 },
  detalhe: { fontSize: 12, color: cores.tinta4 },
  tirar: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: espaco.s, alignSelf: "flex-start" },
  tirarTexto: { fontSize: 14, fontWeight: "600", color: cores.perigo },
});
