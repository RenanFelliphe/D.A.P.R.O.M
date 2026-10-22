import { useRouter } from "expo-router";
import { Text } from "react-native";
import { MinhaAssinatura } from "@/assinatura/MinhaAssinatura";
import { OpcaoAnonimato } from "@/perfil/OpcaoAnonimato";
import { useSessao } from "@/sessao/SessaoProvider";
import { cores } from "@/tema/tema";
import { Carregando } from "@/ui/Estados";
import { LinhaDeNavegacao } from "@/ui/LinhaDeNavegacao";
import { Tela } from "@/ui/Tela";

/**
 * Configurações: as preferências pessoais, juntas num lugar só (antes espalhadas pelo perfil): a assinatura, as preferências de e-mail, a
 * troca de senha e o anonimato no ranking. Cada assunto continua com a sua tela. O que é do sistema todo (a cidade padrão da previsão do
 * tempo, o controle da IA) é do admin e fica só na web: o admin não usa o app.
 */
export default function Configuracoes() {
  const router = useRouter();
  const { eu } = useSessao();
  if (!eu) return <Carregando />;
  return (
    <Tela bordas={["bottom"]}>
      <Text style={{ fontSize: 14, lineHeight: 20, color: cores.tinta4 }}>As suas preferências no SYNQ OS.</Text>
      <MinhaAssinatura />
      <LinhaDeNavegacao icone="mail-outline" titulo="Preferências de e-mail" detalhe="Quais avisos também vão para o seu e-mail" aoPressionar={() => router.push("/emails")} />
      <LinhaDeNavegacao icone="key-outline" titulo="Trocar a senha" aoPressionar={() => router.push("/senha")} />
      <OpcaoAnonimato />
    </Tela>
  );
}
