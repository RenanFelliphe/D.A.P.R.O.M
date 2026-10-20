import { useState } from "react";
import { StyleSheet, View } from "react-native";
import type { Sugestao } from "@shared/api/sugestao-materiais";
import { useAcao } from "@/campo/useAcao";
import { useConexao } from "@/estado/conexao";
import { espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { mostrarAviso } from "@/ui/AvisoRapido";
import { Botao } from "@/ui/Botao";
import { JanelaDeConfirmacao } from "@/ui/Janela";
import { avaliarSugestao, useAtualizarDepoisDaSugestao, type RespostaDaAvaliacao } from "./consultas";
import { MENSAGEM_SEM_SINAL } from "./erros";
import { JanelaDeResposta } from "./JanelaDeResposta";
import { corpoDoAceite, itensSemResolucao, type Resolucoes } from "./lista";

export type DesfechoDaAvaliacao = "aceita" | "recusada" | "retirada";

interface AcoesDaSugestaoProps {
  sugestao: Sugestao;
  resolucoes: Resolucoes;
  /** O aviso de que ainda falta ligar ou cadastrar itens digitados: quem chama o mostra junto dos itens. */
  aoFaltarDecisao: (mensagem: string | null) => void;
  /** Abre o editor do "Ajustar e aceitar" (a tela troca o conteúdo pelo editor). */
  aoAjustar: () => void;
  aoConcluir: (desfecho: DesfechoDaAvaliacao, resposta: RespostaDaAvaliacao) => void;
}

type Janela = "aceitar" | "recusar" | "retirar";

/**
 * O que a pessoa pode fazer com a sugestão (a `api` diz em `posso_avaliar` e `posso_retirar`): quem avalia aceita, ajusta e aceita ou
 * recusa; o autor retira a pendente. Tudo exige sinal: a sugestão não entra na fila do aparelho.
 */
export function AcoesDaSugestao({ sugestao: s, resolucoes, aoFaltarDecisao, aoAjustar, aoConcluir }: AcoesDaSugestaoProps) {
  const [janela, setJanela] = useState<Janela | null>(null);
  const semSinal = useConexao() === "offline";
  const atualizarDepois = useAtualizarDepoisDaSugestao();
  const retirando = useAcao();

  /** Confere o sinal e, para aceitar, se todo item digitado já foi ligado ou marcado para cadastro. */
  const exigir = (aceitando: boolean): boolean => {
    if (semSinal) {
      mostrarAviso(MENSAGEM_SEM_SINAL);
      return false;
    }
    if (aceitando) {
      const faltam = itensSemResolucao(s.itens, resolucoes).length;
      if (faltam > 0) {
        aoFaltarDecisao(faltam === 1 ? "Falta decidir 1 item digitado: ligue-o a um material do catálogo ou cadastre como novo." : `Faltam decidir ${faltam} itens digitados: ligue cada um a um material do catálogo ou cadastre como novo.`);
        return false;
      }
      aoFaltarDecisao(null);
    }
    return true;
  };

  const concluir = async (acao: "aceitar" | "recusar", corpo: object, desfecho: DesfechoDaAvaliacao) => {
    const resposta = await avaliarSugestao(s.id, acao, corpo);
    await atualizarDepois();
    setJanela(null);
    aoConcluir(desfecho, resposta);
  };

  // A janela fecha com sucesso ou não; a falha aparece na tela, acima dos botões (`executar` guarda o erro e não o relança).
  const retirar = () =>
    void retirando
      .executar(async () => {
        const resposta = await avaliarSugestao(s.id, "retirar");
        await atualizarDepois();
        aoConcluir("retirada", resposta);
      })
      .then(() => setJanela(null));

  return (
    <>
      {retirando.erro ? <Aviso tom="blq">{retirando.erro.mensagem}</Aviso> : null}
      {s.posso_avaliar || s.posso_retirar ? (
        <View style={estilos.botoes}>
          {s.posso_avaliar && s.tem_lista ? <Botao titulo="Aceitar" icone="checkmark" aoPressionar={() => exigir(true) && setJanela("aceitar")} /> : null}
          {s.posso_avaliar ? <Botao titulo={s.tem_lista ? "Ajustar e aceitar" : "Informar a lista e aceitar"} icone="create-outline" variante={s.tem_lista ? "secundario" : "primario"} aoPressionar={() => exigir(true) && aoAjustar()} /> : null}
          {s.posso_avaliar ? <Botao titulo="Recusar" icone="close" variante="secundario" aoPressionar={() => exigir(false) && setJanela("recusar")} /> : null}
          {s.posso_retirar ? <Botao titulo="Retirar a minha sugestão" icone="arrow-undo-outline" variante="secundario" aoPressionar={() => exigir(false) && setJanela("retirar")} /> : null}
        </View>
      ) : null}

      {janela === "aceitar" ? (
        <JanelaDeResposta
          titulo="Aceitar a sugestão"
          explicacao="A lista da proposta passa a ser a do serviço, e quem faz o serviço é avisado da mudança. O autor ganha pontos."
          obrigatoria={false}
          botao="Aceitar"
          aoEnviar={(resposta) => concluir("aceitar", corpoDoAceite({ itens: s.itens, resolucoes, lista: null, resposta }), "aceita")}
          aoFechar={() => setJanela(null)}
        />
      ) : null}
      {janela === "recusar" ? (
        <JanelaDeResposta
          titulo="Recusar a sugestão"
          explicacao="A lista do serviço não muda. O autor recebe o seu motivo."
          obrigatoria
          botao="Recusar"
          perigo
          aoEnviar={(resposta) => concluir("recusar", { resposta }, "recusada")}
          aoFechar={() => setJanela(null)}
        />
      ) : null}
      <JanelaDeConfirmacao
        visivel={janela === "retirar"}
        titulo="Retirar a sugestão?"
        mensagem="Ela deixa de esperar a avaliação. Depois você pode enviar outra para este serviço."
        confirmar="Retirar"
        perigo
        enviando={retirando.ocupado}
        aoConfirmar={retirar}
        aoCancelar={() => setJanela(null)}
      />
    </>
  );
}

const estilos = StyleSheet.create({
  botoes: { gap: espaco.s },
});
