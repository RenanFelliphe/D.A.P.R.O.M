import { StyleSheet, Text, View } from "react-native";
import type { Colega } from "@shared/api/apr";
import { CadastrarAssinatura } from "@/assinatura/CadastrarAssinatura";
import { cores, espaco, raio } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";

interface AssinaturasFaltandoProps {
  /** Participantes sem assinatura no perfil, quem está logado incluso. */
  semAssinatura: Colega[];
  usuarioId: string;
  aoRetirar: (usuarioId: string) => void;
}

/**
 * Antes de validar, todo participante precisa ter a assinatura no perfil: a `api` confere isso junto com o resto, antes de dizer o
 * resultado. Quem não está presente para cadastrar pode sair da APR; quem está logado desenha a sua ali mesmo.
 */
export function AssinaturasFaltando({ semAssinatura, usuarioId, aoRetirar }: AssinaturasFaltandoProps) {
  const euSem = semAssinatura.some((c) => c.id === usuarioId);
  const outros = semAssinatura.filter((c) => c.id !== usuarioId);
  if (!euSem && outros.length === 0) return null;
  return (
    <View style={estilos.bloco}>
      {euSem ? (
        <Aviso tom="al" titulo="Você ainda não cadastrou a sua assinatura." rodape={<CadastrarAssinatura />}>
          Desenhe-a abaixo: ela fica no seu perfil.
        </Aviso>
      ) : null}
      {outros.length > 0 ? (
        <>
          <Aviso tom="al" titulo={`${outros.map((c) => c.nome).join(", ")} ${outros.length > 1 ? "ainda não cadastraram" : "ainda não cadastrou"} a assinatura no perfil.`}>
            Peça que cadastrem em Perfil e atualize a tela, ou retire da APR quem não está presente.
          </Aviso>
          {outros.map((c) => (
            <View key={c.id} style={estilos.linha}>
              <Text style={estilos.nome}>{c.nome}</Text>
              <Botao titulo="Retirar da APR" variante="secundario" bloco={false} aoPressionar={() => aoRetirar(c.id)} />
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco.s },
  linha: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: espaco.m, padding: espaco.m, borderRadius: raio.m, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.superficie },
  nome: { flex: 1, fontSize: 14, color: cores.tinta },
});
