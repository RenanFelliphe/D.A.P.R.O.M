import { StyleSheet, Text, View } from "react-native";
import { dataHora } from "@shared/api/formatar";
import { rotuloDaOs, rotuloDoTipo, statusDaOs, tomDaPrioridade, type AprDaOs, type OsDetalhada } from "@shared/api/os-app";
import { execucaoJaTerminou } from "@shared/api/tipos";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Cartao } from "@/ui/Cartao";
import { Icone } from "@/ui/Icone";
import { Selo } from "@/ui/Selo";

/** O número da ordem, o título e os selos que decidem como olhar a OS: status, tipo, criticidade, prioridade e atraso. */
export function CabecalhoDaOs({ os }: { os: OsDetalhada }) {
  const status = statusDaOs[os.status];
  return (
    <View style={estilos.cabecalho}>
      <Text style={estilos.numero}>{rotuloDaOs(os)}</Text>
      <Text style={estilos.titulo}>{os.titulo}</Text>
      <View style={estilos.selos}>
        <Selo tom={status.tone}>{status.rotulo}</Selo>
        <Selo>{rotuloDoTipo[os.tipo]}</Selo>
        {os.local_instalacao.critico ? <Selo tom="crit">Local crítico</Selo> : null}
        {os.prioridade ? <Selo tom={tomDaPrioridade(os.prioridade)}>{`Prioridade: ${os.prioridade}`}</Selo> : null}
        {os.atrasada ? <Selo tom="blq">Atrasada</Selo> : null}
      </View>
    </View>
  );
}

/**
 * As faixas que explicam a situação da OS: cancelada, devolvida ao SAP, reservada para a própria pessoa, relógio do aparelho errado
 * e execução aberta há muitas horas. (A reserva para outra pessoa é explicada no painel de ação, no lugar do botão.)
 */
export function FaixasDaOs({ os, usuarioId }: { os: OsDetalhada; usuarioId: string }) {
  const reservadaParaMim = os.responsavel?.id === usuarioId && (os.status === "liberada" || os.status === "pendente");
  return (
    <>
      {os.status === "cancelada" ? <Aviso tom="al" icone="close-circle-outline" titulo="OS cancelada." /> : null}
      {os.status === "devolvida" && os.devolucao ? (
        <Aviso tom="info" icone="arrow-undo-outline" titulo={`Esta OS foi devolvida ao SAP${os.devolucao.por_nome ? ` por ${os.devolucao.por_nome}` : ""}.`}>
          {dataHora(os.devolucao.em)}
        </Aviso>
      ) : null}
      {reservadaParaMim ? (
        <Aviso tom="info" icone="person-outline" titulo="Esta OS foi reservada para você.">
          {`${os.responsavel!.reservada_por_nome ? `Reservada por ${os.responsavel!.reservada_por_nome}. ` : ""}Só você inicia a APR e a execução.`}
        </Aviso>
      ) : null}
      {os.eventos_com_relogio_suspeito ? (
        <Aviso tom="al" icone="time-outline" titulo="Relógio do aparelho suspeito.">
          {os.eventos_com_relogio_suspeito === 1 ? "1 registro desta OS traz um horário à frente do servidor." : `${os.eventos_com_relogio_suspeito} registros desta OS trazem horários à frente do servidor.`} Acerte a data e a hora do aparelho
          para ligar o ajuste automático.
        </Aviso>
      ) : null}
      {os.execucao_aberta_ha_horas ? (
        <Aviso tom="al" icone="alert-circle-outline" titulo={`Execução aberta há ${os.execucao_aberta_ha_horas} h.`}>
          Pode ter ficado esquecida em andamento.
        </Aviso>
      ) : null}
    </>
  );
}

/** Explica a APR exigida antes de executar: o técnico escolhe o modelo ao iniciar, com a recomendação do sistema. Some depois da execução. */
export function AprExigidaCard({ aprs, status }: { aprs: AprDaOs[]; status: OsDetalhada["status"] }) {
  // Depois da execução (encerrando, aguardando o supervisor, concluída) a APR já cumpriu o papel dela.
  if (execucaoJaTerminou(status) || status === "cancelada" || status === "devolvida") return null;
  const bloqueadas = aprs.filter((a) => a.resultado === "bloqueada");
  const ultima = bloqueadas[bloqueadas.length - 1];
  return (
    <Cartao>
      <View style={estilos.titulo2}>
        <Icone nome="clipboard-outline" tamanho={18} cor={cores.marca} />
        <Text style={estilos.tituloDoCartao}>APR exigida antes de executar</Text>
      </View>
      <Text style={estilos.texto}>
        Você escolhe o modelo ao iniciar a APR, entre os publicados; o sistema recomenda um pelo que a OS descreve. Esta OS tem uma APR própria: ela não vale para outras OS do mesmo local. Todos os participantes assinam a APR, cada um na própria
        conta, antes de executar, e são ao menos 2.
      </Text>
      {status === "pendente" && ultima ? (
        <Text style={estilos.texto}>
          {`${bloqueadas.length === 1 ? "Há 1 APR anterior negativa" : `Há ${bloqueadas.length} APR anteriores negativas`} (última em ${dataHora(ultima.concluida_em)}): qualquer pessoa da equipe pode fazer a nova.`}
        </Text>
      ) : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { gap: espaco.s },
  numero: { fontSize: 13, fontWeight: "700", color: cores.tinta4 },
  titulo: { fontSize: 20, fontWeight: "700", color: cores.tinta, lineHeight: 26 },
  selos: { flexDirection: "row", flexWrap: "wrap", gap: espaco.s },
  titulo2: { flexDirection: "row", alignItems: "center", gap: espaco.s },
  tituloDoCartao: { fontSize: 15, fontWeight: "600", color: cores.tinta },
  texto: { fontSize: 14, color: cores.tinta3, lineHeight: 20 },
});
