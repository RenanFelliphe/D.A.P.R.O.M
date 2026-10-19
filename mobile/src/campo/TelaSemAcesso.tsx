import { useRouter } from "expo-router";
import type { TomDoAviso } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import type { NomeDeIcone } from "@/ui/Icone";
import { Tela } from "@/ui/Tela";

interface TelaSemAcessoProps {
  tom?: TomDoAviso;
  icone?: NomeDeIcone;
  titulo: string;
  texto?: string;
  /** O texto do botão; o padrão leva de volta à OS (`router.back`). */
  voltar?: string;
}

/** A tela de uma ação que a pessoa não pode fazer agora (OS reservada, em execução, ausência): o motivo e o caminho de volta. */
export function TelaSemAcesso({ tom = "info", icone, titulo, texto, voltar = "Voltar à OS" }: TelaSemAcessoProps) {
  const router = useRouter();
  return (
    <Tela bordas={["bottom"]}>
      <Aviso tom={tom} icone={icone} titulo={titulo}>
        {texto}
      </Aviso>
      <Botao titulo={voltar} variante="secundario" aoPressionar={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
    </Tela>
  );
}
