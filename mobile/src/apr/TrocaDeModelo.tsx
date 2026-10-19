import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { doModeloCompleto, riscosEquivalentes, trocarModelo, type ModeloDoRascunho, type RascunhoApr } from "@shared/api/apr";
import { mensagemDoErro } from "@/api/erros";
import { espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { JanelaDeFormulario } from "@/ui/JanelaDeFormulario";
import { carregarModeloPublicado, useEscolhaDoModelo } from "./consultas";
import { JanelaDeModelos } from "./JanelaDeModelos";
import { RiscosApr } from "./ParticipantesERiscos";

interface TrocaDeModeloProps {
  osId: string;
  rascunho: RascunhoApr;
  /** Aplica a troca: o modelo novo e os riscos marcados nele. */
  aoTrocar: (novo: ModeloDoRascunho, riscos: string[]) => void;
  aoFechar: () => void;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * A troca do modelo no meio do preenchimento: a mesma janela de escolha da Nova APR e, escolhido o modelo novo, a conferência dos
 * riscos (os de mesmo nome já vêm marcados) com o que acontece com as respostas: as perguntas iguais guardam a resposta, as demais
 * ficam em branco.
 */
export function TrocaDeModelo({ osId, rascunho, aoTrocar, aoFechar }: TrocaDeModeloProps) {
  const escolha = useEscolhaDoModelo(osId);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState<string | null>(null);
  const [novo, setNovo] = useState<ModeloDoRascunho | null>(null);
  const [riscos, setRiscos] = useState<string[]>([]);

  async function selecionar(codigo: string) {
    setErro(null);
    setCarregando(codigo);
    try {
      const completo = doModeloCompleto(await carregarModeloPublicado(codigo));
      setRiscos(riscosEquivalentes(rascunho.modelo, rascunho.riscos, completo));
      setNovo(completo);
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setCarregando(null);
    }
  }

  if (!novo) {
    return (
      <JanelaDeModelos
        escolha={escolha.data}
        carregandoEscolha={escolha.isPending}
        erro={erro ?? (escolha.isError ? mensagemDoErro(escolha.error) : null)}
        atual={rascunho.modelo.codigo}
        carregando={carregando}
        aoSelecionar={(c) => void selecionar(c)}
        aoFechar={aoFechar}
      />
    );
  }

  const { mantidas, perdidas, emBranco } = trocarModelo(rascunho, novo, riscos);
  const alternar = (id: string) => setRiscos((atuais) => (atuais.includes(id) ? atuais.filter((r) => r !== id) : [...atuais, id]));

  return (
    <JanelaDeFormulario titulo={`Trocar para ${novo.codigo} — ${novo.titulo}`} aoFechar={aoFechar}>
      <Aviso tom={perdidas > 0 ? "al" : "info"} titulo={`${plural(mantidas, "resposta continua", "respostas continuam")} (as perguntas iguais nos dois modelos) e ${plural(emBranco, "pergunta fica", "perguntas ficam")} em branco.`}>
        {perdidas === 1 ? "1 resposta do modelo atual não existe no novo e será apagada." : perdidas > 1 ? `${perdidas} respostas do modelo atual não existem no novo e serão apagadas.` : ""}
      </Aviso>
      <RiscosApr riscos={novo.riscos} itens={novo.itens} marcados={riscos} aoAlternar={alternar} />
      <View style={estilos.botoes}>
        <Botao titulo={`Trocar para ${novo.codigo}`} aoPressionar={() => aoTrocar(novo, riscos)} />
        <Botao titulo="Voltar aos modelos" variante="secundario" aoPressionar={() => setNovo(null)} />
      </View>
    </JanelaDeFormulario>
  );
}

const estilos = StyleSheet.create({
  botoes: { gap: espaco.s },
});
