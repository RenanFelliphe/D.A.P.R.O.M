import * as Linking from "expo-linking";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type { AssinaturaJuridica } from "@shared/api/assinatura-juridica";
import { mostrarAviso } from "@/ui/AvisoRapido";
import { consultarAssinaturaJuridica } from "./api-juridica";
import { AssinaturaNaoConcluida, criarEspera, type Espera } from "./juridica";

/** Abre a página de assinatura do provedor no navegador do aparelho. */
export function abrirPaginaDeAssinatura(url: string): void {
  void Linking.openURL(url).catch(() => mostrarAviso("Não consegui abrir a página de assinatura neste aparelho."));
}

/**
 * Leva a pessoa a assinar na página do provedor e espera a confirmação. `assinar` recebe o que **inicia** a assinatura (cria o documento, ou
 * envia o ato feito sem sinal) e devolve a assinatura já `assinada`; enquanto espera, `espera` traz a assinatura que aguarda (a janela mostra
 * "Aguardando a sua assinatura…"). Ao voltar para o app a consulta se antecipa, e `cancelar` (ou sair da tela) encerra a espera com
 * `AssinaturaCancelada`.
 */
export function useAssinaturaNoProvedor() {
  const [espera, setEspera] = useState<AssinaturaJuridica | null>(null);
  const atual = useRef<Espera | null>(null);

  useEffect(() => {
    const ouvinte = AppState.addEventListener("change", (estado) => {
      if (estado === "active") atual.current?.conferirJa();
    });
    return () => {
      ouvinte.remove();
      atual.current?.cancelar();
    };
  }, []);

  const assinar = useCallback(async (iniciar: () => Promise<AssinaturaJuridica>): Promise<AssinaturaJuridica> => {
    const inicial = await iniciar();
    if (inicial.situacao === "assinada") return inicial;
    if (!inicial.url_assinatura) throw new AssinaturaNaoConcluida("O provedor não devolveu a página de assinatura. Tente de novo.");
    const nova = criarEspera({ consultar: () => consultarAssinaturaJuridica(inicial.id) });
    atual.current = nova;
    setEspera(inicial);
    abrirPaginaDeAssinatura(inicial.url_assinatura);
    try {
      return await nova.aguardar();
    } finally {
      atual.current = null;
      setEspera(null);
    }
  }, []);

  const abrirDeNovo = useCallback(() => {
    if (espera?.url_assinatura) abrirPaginaDeAssinatura(espera.url_assinatura);
  }, [espera]);

  const cancelar = useCallback(() => atual.current?.cancelar(), []);

  return { espera, assinar, abrirDeNovo, cancelar };
}
