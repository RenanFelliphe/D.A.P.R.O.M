import { StyleSheet, Text, View } from "react-native";
import { CadastrarAssinatura } from "@/assinatura/CadastrarAssinatura";
import { useSessao } from "@/sessao/SessaoProvider";
import { cores, espaco, raio } from "@/tema/tema";
import { Botao } from "@/ui/Botao";
import { Icone } from "@/ui/Icone";
import { Tela } from "@/ui/Tela";

/**
 * A assinatura é a primeira coisa depois da liberação: sem ela a `api` recusa tudo (`403 assinatura_pendente`). A pessoa a desenha com
 * o dedo; ao salvar, o `GET /me` é relido e o app a leva à lista de OS.
 */
export default function Assinatura() {
  const { sair } = useSessao();
  return (
    <Tela centralizada>
      <View style={estilos.cartao}>
        <Icone nome="create-outline" tamanho={40} cor={cores.marca} />
        <Text style={estilos.titulo}>Cadastre a sua assinatura</Text>
        <Text style={estilos.texto}>
          Ela valida as suas ações importantes: assinar a APR, encerrar a OS, pedir ausência. É o primeiro passo para usar o app. Desenhe com o dedo; você poderá refazê-la no perfil, e as ações já assinadas guardam a imagem que usaram.
        </Text>
        <View style={estilos.caixa}>
          <CadastrarAssinatura rotuloSalvar="Salvar e continuar" />
        </View>
        <Botao titulo="Sair" variante="texto" aoPressionar={() => void sair()} />
      </View>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cartao: { backgroundColor: cores.superficie, borderRadius: raio.l, borderWidth: 1, borderColor: cores.linha, padding: espaco.xl, gap: espaco.l, alignItems: "center" },
  caixa: { alignSelf: "stretch" },
  titulo: { fontSize: 20, fontWeight: "700", color: cores.tinta, textAlign: "center" },
  texto: { fontSize: 15, lineHeight: 22, color: cores.tinta3, textAlign: "center" },
});
