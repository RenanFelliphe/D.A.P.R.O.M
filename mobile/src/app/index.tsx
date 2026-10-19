import { Redirect } from "expo-router";
import { useState } from "react";
import { URL_DA_API } from "@/config";
import { useSessao } from "@/sessao/SessaoProvider";
import { rotaDoDestino } from "@/sessao/destino";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { Carregando, Vazio } from "@/ui/Estados";
import { Tela } from "@/ui/Tela";
import { mensagemDoErro } from "@/api/erros";

/**
 * A porta de entrada: espera a sessão e o `GET /me` e leva cada conta ao destino dela. É também para onde o roteador volta quando a
 * situação da conta muda (login, senha trocada, liberação).
 */
export default function Inicio() {
  const { fase, destino, carregandoEu, erroEu, recarregarEu, sair } = useSessao();
  const [semSair, setSemSair] = useState<string | null>(null);

  if (!URL_DA_API) {
    return (
      <Tela centralizada>
        <Vazio icone="construct-outline" titulo="App sem endereço da api" texto="Defina EXPO_PUBLIC_API_URL no build do app (veja o .env.example do mobile)." />
      </Tela>
    );
  }
  if (fase === "carregando" || carregandoEu) return <Carregando />;
  if (fase === "sem-sessao") return <Redirect href="/entrar" />;
  if (erroEu || !destino) {
    // Sem sinal na abertura e sem uma cópia da conta que sirva (nunca houve login com sinal, ou já passaram 7 dias): precisa se conectar.
    return (
      <Tela centralizada>
        <Vazio icone="cloud-offline-outline" titulo="Não foi possível abrir o app" texto={mensagemDoErro(erroEu)} acao={{ titulo: "Tentar de novo", aoPressionar: () => void recarregarEu() }} />
        {semSair ? <Aviso tom="al">{semSair}</Aviso> : null}
        <Botao titulo="Sair" variante="texto" aoPressionar={() => void sair().then(setSemSair)} />
      </Tela>
    );
  }
  return <Redirect href={rotaDoDestino[destino]} />;
}
