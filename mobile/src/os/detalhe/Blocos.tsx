import * as Linking from "expo-linking";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { dataDoDia } from "@shared/api/formatar";
import { porCategoria, quantidadeDoItem, tituloDaCategoria, type ServicoDaOs } from "@shared/api/catalogo";
import type { PerguntaDoChecklist } from "@shared/api/checklist-inspecao";
import type { LocalDaOs, OsDetalhada } from "@shared/api/os-app";
import { cores, espaco } from "@/tema/tema";
import { Botao } from "@/ui/Botao";
import { Cartao, TituloDeCartao } from "@/ui/Cartao";
import { Icone } from "@/ui/Icone";
import { Selo } from "@/ui/Selo";

/** O local da OS (código, cliente, endereço e plus code) e o botão "Mapa", que abre o aplicativo de mapas do aparelho. */
export function LocalCard({ local }: { local: LocalDaOs }) {
  const consulta = local.plus_code ?? local.endereco ?? local.codigo;
  return (
    <Cartao>
      <View style={estilos.linha}>
        <Icone nome="location-outline" tamanho={22} cor={cores.marca} />
        <View style={estilos.grow}>
          <Text style={estilos.forte}>{local.codigo}</Text>
          {local.cliente ? <Text style={estilos.suave}>{local.cliente}</Text> : null}
          {local.endereco ? <Text style={estilos.suave}>{local.endereco}</Text> : null}
          {local.plus_code ? <Text style={estilos.pequeno}>{`Plus code ${local.plus_code}`}</Text> : null}
        </View>
      </View>
      <Botao titulo="Abrir no mapa" icone="map-outline" variante="secundario" aoPressionar={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`)} />
    </Cartao>
  );
}

/** Os dados do SAP, sempre abertos; o campo que o SAP não trouxe não aparece. */
export function DadosSapCard({ os }: { os: OsDetalhada }) {
  const campos: { rotulo: string; valor: string | null }[] = [
    { rotulo: "Ordem", valor: os.numero_ordem },
    { rotulo: "Nota", valor: os.numero_nota },
    { rotulo: "Centro de trabalho", valor: os.equipe.centro_trabalho },
    { rotulo: "Equipamento", valor: os.equipamento },
    { rotulo: "Tipo de atividade", valor: os.tipo_atividade },
    { rotulo: "Plano de manutenção", valor: os.plano_manutencao },
    { rotulo: "Item de manutenção", valor: os.item_manutencao },
    { rotulo: "Início programado", valor: os.data_inicio_prog ? dataDoDia(os.data_inicio_prog) : null },
    { rotulo: "Fim programado", valor: os.data_fim_prog ? dataDoDia(os.data_fim_prog) : null },
    { rotulo: "Status no SAP", valor: os.status_sap },
  ];
  return (
    <Cartao>
      <TituloDeCartao>Dados</TituloDeCartao>
      <View style={estilos.dados}>
        {campos
          .filter((c) => c.valor)
          .map((c) => (
            <View key={c.rotulo} style={estilos.dado}>
              <Text style={estilos.pequeno}>{c.rotulo}</Text>
              <Text style={estilos.valor}>{c.valor}</Text>
            </View>
          ))}
      </View>
    </Cartao>
  );
}

/** As instruções (descrição) da OS; sem descrição, o título. */
export function InstrucoesCard({ descricao, titulo }: { descricao: string | null; titulo: string }) {
  return (
    <Cartao>
      <TituloDeCartao>Instruções</TituloDeCartao>
      <Text style={estilos.texto}>{descricao?.trim() || titulo}</Text>
    </Cartao>
  );
}

/** O checklist de inspeção da OS preventiva: o que o técnico vai marcar no encerramento. Some quando a OS não tem checklist. */
export function ChecklistDaOsCard({ perguntas }: { perguntas: PerguntaDoChecklist[] }) {
  if (perguntas.length === 0) return null;
  return (
    <Cartao>
      <View style={estilos.entre}>
        <TituloDeCartao>Checklist de inspeção</TituloDeCartao>
        <Text style={estilos.pequeno}>{perguntas.length === 1 ? "1 pergunta" : `${perguntas.length} perguntas`}</Text>
      </View>
      <Text style={estilos.pequeno}>Você vai marcar cada item ao encerrar a OS. O item não marcado pede uma observação e avisa o supervisor.</Text>
      {perguntas.map((p, i) => (
        <Text key={p.id} style={estilos.texto}>{`${i + 1}. ${p.texto}`}</Text>
      ))}
    </Cartao>
  );
}

/** O que levar para o campo: materiais, ferramentas e EPIs do serviço do catálogo. Só consulta. */
export function MateriaisCard({ servico }: { servico: ServicoDaOs | null }) {
  return (
    <Cartao>
      <TituloDeCartao>Materiais recomendados</TituloDeCartao>
      {!servico ? (
        <Text style={estilos.suave}>Esta OS não tem serviço do catálogo, então não há materiais recomendados. Confira as instruções.</Text>
      ) : servico.materiais.length === 0 ? (
        <Text style={estilos.suave}>{`O catálogo ainda não lista materiais para o serviço ${servico.descricao}. Confira as instruções.`}</Text>
      ) : (
        <>
          <Text style={estilos.pequeno}>{`Recomendado para o serviço ${servico.descricao}, por execução. É só para consulta: leve o que a situação no local pedir.`}</Text>
          {porCategoria(servico.materiais).map((grupo) => (
            <View key={grupo.categoria} style={estilos.grupo}>
              <Text style={estilos.grupoTitulo}>{tituloDaCategoria[grupo.categoria]}</Text>
              {grupo.itens.map((m) => (
                <View key={m.material_id} style={estilos.material}>
                  <View style={estilos.grow}>
                    <Text style={estilos.texto}>{m.codigo ? `${m.descricao} · ${m.codigo}` : m.descricao}</Text>
                    {m.observacao ? <Text style={estilos.pequeno}>{m.observacao}</Text> : null}
                  </View>
                  {!m.ativo ? <Selo>Desativado</Selo> : null}
                  <Text style={estilos.quantidade}>{quantidadeDoItem(m)}</Text>
                </View>
              ))}
            </View>
          ))}
        </>
      )}
    </Cartao>
  );
}

/** Um bloco que abre e fecha (APRs desta OS, histórico do local): o título e o resumo ficam à vista. */
export function Recolhivel({ titulo, resumo, aberto = false, aoAbrir, children }: { titulo: string; resumo?: string; aberto?: boolean; aoAbrir?: () => void; children: React.ReactNode }) {
  const [aberta, setAberta] = useState(aberto);
  return (
    <Cartao>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: aberta }} onPress={() => {
          if (!aberta) aoAbrir?.();
          setAberta((a) => !a);
        }} style={estilos.entre}>
        <View style={estilos.grow}>
          <TituloDeCartao>{titulo}</TituloDeCartao>
          {resumo ? <Text style={estilos.pequeno}>{resumo}</Text> : null}
        </View>
        <Icone nome={aberta ? "chevron-up" : "chevron-down"} tamanho={20} cor={cores.tinta4} />
      </Pressable>
      {aberta ? <View style={estilos.conteudo}>{children}</View> : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: "row", alignItems: "flex-start", gap: espaco.m },
  grow: { flex: 1, gap: 2 },
  entre: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: espaco.m },
  forte: { fontSize: 15, fontWeight: "700", color: cores.tinta },
  suave: { fontSize: 14, color: cores.tinta3, lineHeight: 20 },
  texto: { fontSize: 14, color: cores.tinta2, lineHeight: 20 },
  pequeno: { fontSize: 12, color: cores.tinta4, lineHeight: 17 },
  valor: { fontSize: 14, color: cores.tinta },
  dados: { flexDirection: "row", flexWrap: "wrap", rowGap: espaco.m, columnGap: espaco.l },
  dado: { minWidth: "44%", gap: 2 },
  grupo: { gap: espaco.s, marginTop: espaco.s },
  grupoTitulo: { fontSize: 13, fontWeight: "700", color: cores.tinta3 },
  material: { flexDirection: "row", alignItems: "flex-start", gap: espaco.s, paddingVertical: 6, borderTopWidth: 1, borderTopColor: cores.linha2 },
  quantidade: { fontSize: 13, color: cores.tinta3, textAlign: "right", maxWidth: 110 },
  conteudo: { gap: espaco.m, marginTop: espaco.s },
});
