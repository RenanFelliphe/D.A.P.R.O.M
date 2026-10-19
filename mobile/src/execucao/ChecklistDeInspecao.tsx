import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { faltaObservacao, MAX_OBSERVACAO_DO_ITEM, type PerguntaDoChecklist, type RespostaDoItem } from "@shared/api/checklist-inspecao";
import { cores, espaco, raio } from "@/tema/tema";
import { Botao } from "@/ui/Botao";
import { Campo } from "@/ui/Campo";
import { Opcao } from "@/ui/Opcao";

interface ChecklistDeInspecaoProps {
  perguntas: PerguntaDoChecklist[];
  respostas: Record<string, RespostaDoItem>;
  onChange: (respostas: Record<string, RespostaDoItem>) => void;
  desabilitado?: boolean;
}

const vazia: RespostaDoItem = { marcado: false, observacao: "" };

/**
 * O checklist de inspeção da preventiva, no encerramento: cada pergunta é uma caixa de marcar. A não marcada pede uma observação (sem
 * ela o encerramento não é liberado, mas o item não marcado não impede encerrar: o supervisor é avisado); a marcada aceita uma
 * observação opcional.
 */
export function ChecklistDeInspecao({ perguntas, respostas, onChange, desabilitado }: ChecklistDeInspecaoProps) {
  /** As perguntas marcadas cuja observação opcional o técnico abriu. */
  const [comObservacao, setComObservacao] = useState<Set<string>>(new Set());
  const de = (id: string) => respostas[id] ?? vazia;
  const mudar = (id: string, parte: Partial<RespostaDoItem>) => onChange({ ...respostas, [id]: { ...de(id), ...parte } });
  const marcados = perguntas.filter((p) => de(p.id).marcado).length;

  return (
    <View style={estilos.tudo}>
      <Text accessibilityRole="header" style={estilos.titulo}>
        Checklist de inspeção
      </Text>
      <Text style={estilos.suave}>{`${marcados} de ${perguntas.length} marcados. Marque o que está conforme; o que não estiver pede uma observação.`}</Text>
      <Botao
        titulo="Marcar todos"
        variante="secundario"
        bloco={false}
        aoPressionar={desabilitado || marcados === perguntas.length ? () => undefined : () => onChange(Object.fromEntries(perguntas.map((p) => [p.id, { ...de(p.id), marcado: true }])))}
      />
      {perguntas.map((p) => {
        const r = de(p.id);
        const pendente = faltaObservacao(r);
        const mostraObservacao = !r.marcado || comObservacao.has(p.id) || r.observacao !== "";
        return (
          <View key={p.id} style={[estilos.item, pendente && estilos.pendente]}>
            <Opcao rotulo={p.texto} marcada={r.marcado} desabilitada={desabilitado} aoPressionar={() => mudar(p.id, { marcado: !r.marcado })} />
            {mostraObservacao ? (
              <Campo
                rotulo={r.marcado ? "Observação (opcional)" : "Observação · obrigatória: o supervisor será avisado"}
                placeholder={r.marcado ? "Observação (opcional)" : "O que foi encontrado?"}
                multiline
                numberOfLines={2}
                maxLength={MAX_OBSERVACAO_DO_ITEM}
                textAlignVertical="top"
                style={estilos.areaDeTexto}
                value={r.observacao}
                onChangeText={(texto) => mudar(p.id, { observacao: texto })}
                editable={!desabilitado}
              />
            ) : (
              <Botao titulo="Adicionar observação" variante="texto" bloco={false} aoPressionar={() => setComObservacao((a) => new Set(a).add(p.id))} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  tudo: { gap: espaco.m },
  titulo: { fontSize: 16, fontWeight: "700", color: cores.tinta },
  suave: { fontSize: 13, lineHeight: 19, color: cores.tinta4 },
  item: { gap: espaco.s, padding: espaco.s, borderRadius: raio.m },
  pendente: { backgroundColor: cores.alertaFundo },
  areaDeTexto: { minHeight: 64, paddingTop: espaco.s },
});
