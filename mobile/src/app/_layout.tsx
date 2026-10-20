import "@/polyfills";

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { clienteDeConsultas, ligarGerentesDoAparelho } from "@/estado/consultas";
import { SincronizacaoProvider } from "@/offline/SincronizacaoProvider";
import { SessaoProvider, useSessao } from "@/sessao/SessaoProvider";
import { cores } from "@/tema/tema";
import { AvisoRapidoHost } from "@/ui/AvisoRapido";
import { TelaDeErro } from "@/ui/TelaDeErro";
import { Vitoria } from "@/vitoria/Vitoria";

SplashScreen.preventAutoHideAsync();

/** A tela de erro geral: qualquer erro de uma tela cai aqui, nunca num app em branco. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <TelaDeErro erro={error} tentarDeNovo={retry} />;
}

export default function RaizLayout() {
  useEffect(() => ligarGerentesDoAparelho(), []);
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={clienteDeConsultas}>
        <SessaoProvider>
          <SincronizacaoProvider>
            <StatusBar style="dark" />
            <Rotas />
            <AvisoRapidoHost />
          </SincronizacaoProvider>
        </SessaoProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/**
 * Cada situação da conta abre só as telas dela (`Stack.Protected`): sem sessão, a entrada; com a senha provisória, a troca de senha; e
 * assim por diante até as abas. Quando a situação muda (o login, a senha trocada, a liberação), o `index` leva ao destino novo.
 */
function Rotas() {
  const { fase, destino } = useSessao();

  useEffect(() => {
    if (fase !== "carregando") void SplashScreen.hideAsync();
  }, [fase]);

  const ativa = fase === "ativa";
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cores.fundo } }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={fase === "sem-sessao"}>
          <Stack.Screen name="entrar" />
        </Stack.Protected>
        <Stack.Protected guard={ativa && destino === "trocar-senha"}>
          <Stack.Screen name="trocar-senha" />
        </Stack.Protected>
        <Stack.Protected guard={ativa && destino === "aguardando"}>
          <Stack.Screen name="aguardando" />
        </Stack.Protected>
        <Stack.Protected guard={ativa && destino === "somente-web"}>
          <Stack.Screen name="somente-web" />
        </Stack.Protected>
        <Stack.Protected guard={ativa && destino === "assinatura"}>
          <Stack.Screen name="assinatura" />
        </Stack.Protected>
        <Stack.Protected guard={ativa && destino === "abas"}>
          <Stack.Screen name="(abas)" />
          <Stack.Screen name="os/[id]" options={{ headerShown: true, title: "Ordem de serviço", headerStyle: { backgroundColor: cores.escuro }, headerTintColor: cores.branco, headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="os/[id]/apr" options={{ headerShown: true, title: "Nova APR", headerStyle: { backgroundColor: cores.escuro }, headerTintColor: cores.branco, headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="os/[id]/checklist" options={{ headerShown: true, title: "Checklist da APR", headerStyle: { backgroundColor: cores.escuro }, headerTintColor: cores.branco, headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="os/[id]/aprovada" options={{ headerShown: true, title: "APR aprovada", headerStyle: { backgroundColor: cores.escuro }, headerTintColor: cores.branco, headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="os/[id]/bloqueio" options={{ headerShown: true, title: "Impedimento", headerStyle: { backgroundColor: cores.escuro }, headerTintColor: cores.branco, headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="os/[id]/execucao" options={{ headerShown: true, title: "Execução", headerStyle: { backgroundColor: cores.escuro }, headerTintColor: cores.branco, headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="os/[id]/conferencia" options={{ headerShown: true, title: "Conferência da execução", headerStyle: { backgroundColor: cores.escuro }, headerTintColor: cores.branco, headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="ausencias" options={{ headerShown: true, title: "Minhas ausências", headerStyle: { backgroundColor: cores.escuro }, headerTintColor: cores.branco, headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="materiais/index" options={{ headerShown: true, title: "Sugestões de materiais", headerStyle: { backgroundColor: cores.escuro }, headerTintColor: cores.branco, headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="materiais/nova" options={{ headerShown: true, title: "Sugerir lista", headerStyle: { backgroundColor: cores.escuro }, headerTintColor: cores.branco, headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="materiais/[id]" options={{ headerShown: true, title: "Sugestão de materiais", headerStyle: { backgroundColor: cores.escuro }, headerTintColor: cores.branco, headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="historico" options={{ headerShown: true, title: "OS que encerrei", headerStyle: { backgroundColor: cores.escuro }, headerTintColor: cores.branco, headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="emails" options={{ headerShown: true, title: "Preferências de e-mail", headerStyle: { backgroundColor: cores.escuro }, headerTintColor: cores.branco, headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="recusados" options={{ headerShown: true, title: "Registros recusados", headerStyle: { backgroundColor: cores.escuro }, headerTintColor: cores.branco, headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="senha" options={{ headerShown: true, title: "Trocar a senha", headerStyle: { backgroundColor: cores.escuro }, headerTintColor: cores.branco, headerBackButtonDisplayMode: "minimal" }} />
        </Stack.Protected>
      </Stack>
      {ativa && destino === "abas" ? <Vitoria /> : null}
    </>
  );
}
