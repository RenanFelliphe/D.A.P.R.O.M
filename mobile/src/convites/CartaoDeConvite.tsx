import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LIMITE_DO_MOTIVO_DO_CONVITE, PRAZO_DO_CONVITE_MIN, type ConviteRecebido } from "@shared/api/apr-convite";
import { mensagemDoErro } from "@/api/erros";
import { useAgora } from "@/execucao/useAgora";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { Campo } from "@/ui/Campo";
import { Cartao } from "@/ui/Cartao";
import { Selo } from "@/ui/Selo";
import { useAcoesDeConvite } from "./consultas";
import { faltaNoMotivoDaRecusa, restanteDoConvite } from "./regras";

/**
 * Um convite que a pessoa recebeu: quem a convidou, a OS, quanto tempo falta e as duas respostas. "Aceito" é "eu vou" (a assinatura da APR
 * continua no fim); "Não posso" pede um motivo curto, que o responsável lê para trocar a pessoa. O convite aceito fica à vista até o
 * responsável registrar a APR.
 */
export function CartaoDeConvite({ convite }: { convite: ConviteRecebido }) {
  const { aceitar, recusar } = useAcoesDeConvite();
  const agora = useAgora(1000);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const restante = restanteDoConvite(convite.expira_em, agora);
  const aceito = convite.situacao === "aceito";

  const responder = async (tarefa: () => Promise<void>) => {
    setErro(null);
    setEnviando(true);
    try {
      await tarefa();
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setEnviando(false);
    }
  };

  const faltaMotivo = recusando ? faltaNoMotivoDaRecusa(motivo) : null;

  return (
    <Cartao>
      <View style={estilos.topo}>
        <Text style={estilos.numero}>{`OS ${convite.os.numero_ordem ?? "sem número"}`}</Text>
        {aceito ? <Selo tom="enc">Você aceitou</Selo> : <Selo tom="exe">{restante ? `Responda em ${restante}` : "Prazo acabando"}</Selo>}
      </View>
      <Text style={estilos.titulo}>{convite.os.titulo}</Text>
      <Text style={estilos.suave}>{convite.os.local}</Text>
      <Text style={estilos.texto}>
        {aceito
          ? `Aguardando ${convite.convidado_por.nome} registrar a APR. Você assina no fim, na sua conta.`
          : `${convite.convidado_por.nome} convidou você para participar da APR desta OS. Aceitar é confirmar que você vai; a sua assinatura vem no fim, depois de ler os riscos.`}
      </Text>
      {erro ? <Aviso tom="blq">{erro}</Aviso> : null}
      {!aceito && !recusando ? (
        <View style={estilos.botoes}>
          <Botao titulo="Aceito" icone="checkmark" enviando={enviando} aoPressionar={() => void responder(() => aceitar(convite.id))} />
          <Botao titulo="Não posso" variante="secundario" aoPressionar={() => setRecusando(true)} />
        </View>
      ) : null}
      {recusando ? (
        <View style={estilos.botoes}>
          <Campo rotulo="Por que você não pode?" value={motivo} onChangeText={setMotivo} maxLength={LIMITE_DO_MOTIVO_DO_CONVITE} placeholder="Ex.: estou em outro serviço" ajuda={`O responsável lê para trocar a pessoa (até ${LIMITE_DO_MOTIVO_DO_CONVITE} caracteres).`} />
          {faltaMotivo && motivo.length > 0 ? <Text style={estilos.suave}>{faltaMotivo}</Text> : null}
          <Botao titulo="Enviar a recusa" variante="perigo" enviando={enviando} aoPressionar={() => (faltaMotivo ? setErro(faltaMotivo) : void responder(() => recusar(convite.id, motivo.trim())))} />
          <Botao titulo="Voltar" variante="texto" aoPressionar={() => setRecusando(false)} />
        </View>
      ) : null}
      {!aceito ? <Text style={estilos.suave}>{`O convite vale por ${PRAZO_DO_CONVITE_MIN} minutos; sem resposta, o responsável pode trocar você.`}</Text> : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  topo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: espaco.s },
  numero: { fontSize: 14, fontWeight: "700", color: cores.tinta },
  titulo: { fontSize: 16, fontWeight: "700", color: cores.tinta, lineHeight: 22 },
  texto: { fontSize: 14, lineHeight: 20, color: cores.tinta3 },
  suave: { fontSize: 12, lineHeight: 17, color: cores.tinta4 },
  botoes: { gap: espaco.s },
});
