import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { descreverPeriodo, type Ausencia } from "@shared/api/ausencia";
import { dataDoDia, hoje } from "@shared/api/formatar";
import { cliente } from "@/api/api";
import { JanelaDeAssinatura } from "@/campo/JanelaDeAssinatura";
import { espaco } from "@/tema/tema";
import { Botao } from "@/ui/Botao";
import { Campo } from "@/ui/Campo";
import { botoesDaAusencia, faltaNoFimAntecipado, faltaNoNovoRetorno, diaDoCampo, LIMITE_DO_MOTIVO, type AcaoDaAusencia } from "./regras";

const post = (id: string, acao: string, corpo: object = {}) => cliente.chamar(`/ausencias/${id}/${acao}`, { metodo: "POST", corpo: { assinar: true, ...corpo } });

/** O que o ato mudou além da lista de ausências: o `GET /me` (a faixa e o destino do ausente), as OS (reservas desfeitas) e os avisos. */
function useAtualizarDepoisDaAusencia() {
  const consultas = useQueryClient();
  return () => Promise.all(["ausencias", "eu", "os", "me", "avisos"].map((k) => consultas.invalidateQueries({ queryKey: [k] })));
}

/**
 * Os botões de uma ausência da própria pessoa, por como ela está (`botoesDaAusencia`): cancelar o pedido, confirmar o que o
 * supervisor aprovou, recusar as datas, pedir o fim antecipado e confirmar o retorno; o supervisor titular também altera o retorno e
 * encerra a que registrou para si. Toda ação é assinada com a assinatura do perfil. A `api` confere tudo de novo.
 */
export function AcoesDaAusencia({ ausencia: a, titular }: { ausencia: Ausencia; titular: boolean }) {
  const [aberta, setAberta] = useState<AcaoDaAusencia | null>(null);
  const atualizarDepois = useAtualizarDepoisDaAusencia();
  const botoes = botoesDaAusencia(a, titular);
  if (botoes.length === 0) return null;

  const fechar = () => setAberta(null);
  const enviar = async (acao: string, corpo?: object) => {
    await post(a.id, acao, corpo);
    await atualizarDepois();
  };
  const periodo = descreverPeriodo(a);

  return (
    <>
      <View style={estilos.botoes}>
        {botoes.map((b) => (
          <Botao key={b.acao} titulo={b.rotulo} variante={b.variante} aoPressionar={() => setAberta(b.acao)} />
        ))}
      </View>

      {aberta === "cancelar" ? (
        <JanelaDeAssinatura titulo="Cancelar o pedido" tom="perigo" resumo={`Cancelar o pedido de ausência ${periodo}?`} rotuloConfirmar="Cancelar o pedido e assinar" aoConfirmar={() => enviar("cancelar")} aoFechar={fechar} />
      ) : null}
      {aberta === "confirmar" ? (
        <JanelaDeAssinatura titulo="Confirmar a ausência" resumo={`O supervisor aprovou: ${periodo}. Ao confirmar, a ausência passa a valer.`} rotuloConfirmar="Confirmar e assinar" aoConfirmar={() => enviar("confirmar")} aoFechar={fechar} />
      ) : null}
      {aberta === "recusar-ajuste" ? <JanelaRecusarDatas resumo={`O supervisor aprovou: ${periodo}. Recusando, o pedido termina e você pode pedir de novo.`} aoEnviar={(motivo) => enviar("recusar-ajuste", { motivo: motivo || undefined })} aoFechar={fechar} /> : null}
      {aberta === "pedir-fim" ? <JanelaPedirFim ausencia={a} aoEnviar={(data) => enviar("pedir-fim", { data })} aoFechar={fechar} /> : null}
      {aberta === "confirmar-retorno" ? (
        <JanelaDeAssinatura titulo="Confirmar o retorno" resumo={`A sua ausência terminou em ${dataDoDia(a.retorno)}. Ao confirmar, a sua conta volta ao normal.`} rotuloConfirmar="Confirmar e assinar" aoConfirmar={() => enviar("confirmar-retorno")} aoFechar={fechar} />
      ) : null}
      {aberta === "prorrogar" ? <JanelaProrrogar ausencia={a} aoEnviar={(retorno, motivo) => enviar("prorrogar", { retorno, motivo: motivo || undefined })} aoFechar={fechar} /> : null}
      {aberta === "encerrar" ? (
        <JanelaEncerrar
          emergencia={a.situacao !== "agendada"}
          aoEnviar={(motivo) => enviar("encerrar", { motivo: motivo || undefined })}
          aoFechar={fechar}
        />
      ) : null}
    </>
  );
}

function CampoDoMotivo({ valor, aoMudar, rotulo }: { valor: string; aoMudar: (v: string) => void; rotulo: string }) {
  return <Campo rotulo={rotulo} value={valor} onChangeText={aoMudar} multiline numberOfLines={3} textAlignVertical="top" maxLength={LIMITE_DO_MOTIVO} ajuda={`${valor.length}/${LIMITE_DO_MOTIVO}`} style={estilos.areaDeTexto} />;
}

function JanelaRecusarDatas({ resumo, aoEnviar, aoFechar }: { resumo: string; aoEnviar: (motivo: string) => Promise<void>; aoFechar: () => void }) {
  const [motivo, setMotivo] = useState("");
  return (
    <JanelaDeAssinatura titulo="Recusar as datas" tom="perigo" resumo={resumo} rotuloConfirmar="Recusar e assinar" aoConfirmar={() => aoEnviar(motivo.trim())} aoFechar={aoFechar}>
      <CampoDoMotivo valor={motivo} aoMudar={setMotivo} rotulo="Motivo (opcional)" />
    </JanelaDeAssinatura>
  );
}

function JanelaPedirFim({ ausencia, aoEnviar, aoFechar }: { ausencia: Ausencia; aoEnviar: (data: string) => Promise<void>; aoFechar: () => void }) {
  const [dia, setDia] = useState("");
  const falta = faltaNoFimAntecipado(dia, ausencia, hoje());
  return (
    <JanelaDeAssinatura
      titulo="Pedir o fim antecipado"
      resumo={`O retorno previsto é ${dataDoDia(ausencia.retorno)}. Informe o dia em que você quer voltar ao trabalho; o supervisor aprova ou recusa.`}
      rotuloConfirmar="Pedir e assinar"
      faltaNosCampos={falta}
      aoConfirmar={() => aoEnviar(diaDoCampo(dia)!)}
      aoFechar={aoFechar}
    >
      <Campo rotulo="Quero voltar em" value={dia} onChangeText={setDia} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" maxLength={10} />
    </JanelaDeAssinatura>
  );
}

function JanelaProrrogar({ ausencia, aoEnviar, aoFechar }: { ausencia: Ausencia; aoEnviar: (retorno: string, motivo: string) => Promise<void>; aoFechar: () => void }) {
  const [retorno, setRetorno] = useState("");
  const [motivo, setMotivo] = useState("");
  const falta = faltaNoNovoRetorno(retorno, ausencia, hoje());
  return (
    <JanelaDeAssinatura
      titulo="Alterar a data de retorno"
      resumo={`${descreverPeriodo(ausencia)}.`}
      rotuloConfirmar="Alterar e assinar"
      faltaNosCampos={falta}
      aoConfirmar={() => aoEnviar(diaDoCampo(retorno)!, motivo.trim())}
      aoFechar={aoFechar}
    >
      <Campo rotulo="Novo retorno (primeiro dia de volta)" value={retorno} onChangeText={setRetorno} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" maxLength={10} />
      <CampoDoMotivo valor={motivo} aoMudar={setMotivo} rotulo="Motivo (opcional)" />
    </JanelaDeAssinatura>
  );
}

function JanelaEncerrar({ emergencia, aoEnviar, aoFechar }: { emergencia: boolean; aoEnviar: (motivo: string) => Promise<void>; aoFechar: () => void }) {
  const [motivo, setMotivo] = useState("");
  return (
    <JanelaDeAssinatura
      titulo={emergencia ? "Encerrar a minha ausência" : "Encerrar a ausência"}
      tom="perigo"
      resumo={emergencia ? "Encerrar em emergência: você volta a agir pela equipe na hora." : "A ausência é encerrada antes de começar."}
      rotuloConfirmar="Encerrar e assinar"
      aoConfirmar={() => aoEnviar(motivo.trim())}
      aoFechar={aoFechar}
    >
      <CampoDoMotivo valor={motivo} aoMudar={setMotivo} rotulo="Motivo (opcional)" />
    </JanelaDeAssinatura>
  );
}

const estilos = StyleSheet.create({
  botoes: { gap: espaco.s },
  areaDeTexto: { minHeight: 84, paddingTop: espaco.m },
});
