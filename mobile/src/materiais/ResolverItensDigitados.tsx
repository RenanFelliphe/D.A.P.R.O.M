import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { rotuloDaCategoria } from "@shared/api/catalogo";
import type { ItemDaSugestao } from "@shared/api/sugestao-materiais";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { Cartao, TituloDeCartao } from "@/ui/Cartao";
import { Selo } from "@/ui/Selo";
import { BuscaDeMaterial } from "./BuscaDeMaterial";
import type { Resolucao, Resolucoes } from "./lista";

interface ResolverItensDigitadosProps {
  itens: ItemDaSugestao[];
  resolucoes: Resolucoes;
  aoMudar: (resolucoes: Resolucoes) => void;
  /** Mensagem de que ainda falta decidir (quando a pessoa tentou aceitar). */
  pendencia?: string | null;
}

/**
 * Os itens que o autor digitou ("Não achei"): antes de aceitar, quem avalia liga cada um a um material que já está no catálogo ou o
 * cadastra como novo, para o catálogo não se encher de variações do mesmo nome. Some quando a proposta só tem itens do catálogo.
 */
export function ResolverItensDigitados({ itens, resolucoes, aoMudar, pendencia }: ResolverItensDigitadosProps) {
  const [ligando, setLigando] = useState<number | null>(null);
  const digitados = itens.filter((i) => !i.material_id);
  if (digitados.length === 0) return null;

  const decidir = (ordem: number, r: Resolucao) => aoMudar({ ...resolucoes, [ordem]: r });
  const jaLigados = new Set(Object.values(resolucoes).flatMap((r) => (r?.tipo === "ligar" ? [r.material.id] : [])));

  return (
    <Cartao>
      <TituloDeCartao>Itens digitados pelo autor</TituloDeCartao>
      <Text style={estilos.texto}>Estes itens não estão no catálogo. Antes de aceitar, ligue cada um a um material que já existe ou cadastre como novo.</Text>
      {pendencia ? <Aviso tom="al">{pendencia}</Aviso> : null}
      {digitados.map((i) => {
        const r = resolucoes[i.ordem];
        return (
          <View key={i.ordem} style={estilos.item}>
            <Text style={estilos.descricao}>{i.descricao}</Text>
            <Text style={estilos.detalhe}>{`${i.unidade} · ${rotuloDaCategoria[i.categoria]}`}</Text>
            {r ? <Selo tom="enc">{r.tipo === "ligar" ? `Ligado a: ${r.material.descricao}` : "Será cadastrado como novo"}</Selo> : <Selo tom="al">Falta decidir</Selo>}
            <Botao titulo={r?.tipo === "ligar" ? "Ligar a outro material" : "Ligar a um material do catálogo"} variante="secundario" aoPressionar={() => setLigando(i.ordem)} />
            <Botao titulo="Cadastrar como novo" variante={r?.tipo === "criar" ? "primario" : "secundario"} aoPressionar={() => decidir(i.ordem, { tipo: "criar" })} />
          </View>
        );
      })}
      {ligando !== null ? (
        <BuscaDeMaterial
          titulo="Ligar a um material"
          jaEscolhido={(m) => jaLigados.has(m.id)}
          aoEscolher={(m) => {
            decidir(ligando, { tipo: "ligar", material: m });
            setLigando(null);
          }}
          aoFechar={() => setLigando(null)}
        />
      ) : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  texto: { fontSize: 14, color: cores.tinta3, lineHeight: 20 },
  item: { gap: espaco.s, paddingTop: espaco.m, borderTopWidth: 1, borderTopColor: cores.linha2 },
  descricao: { fontSize: 15, fontWeight: "600", color: cores.tinta },
  detalhe: { fontSize: 12, color: cores.tinta4 },
});
