import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import type { AprDaOs, ExecucaoDaOs, OsDetalhada } from "@shared/api/os-app";
import { mensagemDoErro } from "@/api/erros";
import { cores } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { Cartao } from "@/ui/Cartao";
import { irParaAcao } from "../rotas";
import { decidirAcao } from "./acao";
import { abrirPdfDaOs } from "./pdf";

interface Props {
  os: OsDetalhada;
  usuarioId: string;
  aprs: AprDaOs[];
  execucoes: ExecucaoDaOs[];
  /** O rótulo da ausência de quem olha; o ausente só visualiza. */
  ausencia: string | null;
}

/**
 * O que o técnico pode fazer agora na OS: o botão certo para a situação (`decidirAcao`) ou, para quem não pode agir, o motivo no
 * lugar do botão. As telas de APR e execução chegam na pendência 2; até lá o botão leva a "em breve". O PDF da OS encerrada abre
 * no leitor do aparelho.
 */
export function AcoesDaOs({ os, usuarioId, aprs, execucoes, ausencia }: Props) {
  const router = useRouter();
  const [abrindoPdf, setAbrindoPdf] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const decisao = decidirAcao({ os, usuarioId, aprs, execucoes, ausencia });

  const abrirPdf = async () => {
    setErro(null);
    setAbrindoPdf(true);
    try {
      await abrirPdfDaOs(os.id);
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setAbrindoPdf(false);
    }
  };

  if (decisao.avisos.length === 0 && !decisao.nota && decisao.botoes.length === 0) return null;
  return (
    <Cartao>
      {decisao.avisos.map((a, i) => (
        <Aviso key={i} tom={a.tom} titulo={a.titulo}>
          {a.texto}
        </Aviso>
      ))}
      {decisao.nota ? <Text style={estilos.nota}>{decisao.nota}</Text> : null}
      {erro ? <Aviso tom="blq" titulo={erro} /> : null}
      {decisao.botoes.map((b) => (
        <Botao
          key={b.acao}
          titulo={b.titulo}
          variante={b.variante}
          icone={b.acao === "abrir-pdf" ? "document-text-outline" : undefined}
          enviando={b.acao === "abrir-pdf" && abrindoPdf}
          aoPressionar={() => (b.acao === "abrir-pdf" ? void abrirPdf() : irParaAcao(router, b.acao, os.id))}
        />
      ))}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  nota: { fontSize: 14, color: cores.tinta3, lineHeight: 20 },
});
