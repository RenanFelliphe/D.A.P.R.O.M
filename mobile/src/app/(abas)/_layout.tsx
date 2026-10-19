import { Tabs } from "expo-router";
import { useAvisosNaoLidos } from "@/avisos/consultas";
import { AvisoDeConquista } from "@/gamificacao/AvisoDeConquista";
import { cores } from "@/tema/tema";
import { Icone, type NomeDeIcone } from "@/ui/Icone";
import { IndicadorDeConexao } from "@/ui/IndicadorDeConexao";

const aba = (nome: NomeDeIcone, ativo: NomeDeIcone) =>
  function IconeDaAba({ color, focused }: { color: unknown; focused: boolean }) {
    return <Icone nome={focused ? ativo : nome} tamanho={24} cor={typeof color === "string" ? color : cores.tinta4} />;
  };

/** As quatro abas do app: OS, Avisos, Pontos e Perfil; as telas de campo (detalhe da OS, APR, execução) empilham a partir da OS. */
export default function AbasLayout() {
  const { data: naoLidos } = useAvisosNaoLidos();
  return (
    <>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: cores.escuro },
          headerTintColor: cores.branco,
          headerTitleStyle: { fontWeight: "700" },
          headerRight: () => <IndicadorDeConexao />,
          tabBarActiveTintColor: cores.marca,
          tabBarInactiveTintColor: cores.tinta4,
          tabBarStyle: { backgroundColor: cores.superficie, borderTopColor: cores.linha },
          tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
          sceneStyle: { backgroundColor: cores.fundo },
        }}
      >
        <Tabs.Screen name="lista" options={{ title: "OS da equipe", tabBarLabel: "OS", tabBarIcon: aba("clipboard-outline", "clipboard") }} />
        <Tabs.Screen
          name="avisos"
          options={{ title: "Avisos", tabBarIcon: aba("notifications-outline", "notifications"), tabBarBadge: naoLidos ? (naoLidos > 99 ? "99+" : naoLidos) : undefined, tabBarBadgeStyle: { backgroundColor: cores.perigo, color: cores.branco } }}
        />
        <Tabs.Screen name="pontos" options={{ title: "Pontos", tabBarIcon: aba("trophy-outline", "trophy") }} />
        <Tabs.Screen name="perfil" options={{ title: "Perfil", tabBarIcon: aba("person-circle-outline", "person-circle") }} />
      </Tabs>
    <AvisoDeConquista />
    </>
  );
}
