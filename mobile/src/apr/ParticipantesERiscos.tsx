import { StyleSheet, Text, View } from "react-native";
import { MIN_PARTICIPANTES, type Colega, type ItemDoModelo, type RiscoDoModelo } from "@shared/api/apr";
import { PRAZO_DO_CONVITE_MIN, type ConviteFeito } from "@shared/api/apr-convite";
import { seloDoConvite } from "@/convites/regras";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { ListaDeOpcoes, Opcao } from "@/ui/Opcao";
import { Selo } from "@/ui/Selo";

interface ParticipantesAprProps {
  equipe: Colega[];
  usuarioId: string;
  marcados: string[];
  responsavelId: string;
  aoAlternar: (id: string) => void;
  /** Ausente quando o responsável é fixo (a OS foi reservada a quem aplica a APR). */
  aoTornarResponsavel?: (id: string) => void;
  /** Por que não dá para continuar (menos de 2 participantes), junto da lista. */
  erro?: string;
  /**
   * Os convites que o responsável fez nesta OS hoje, com a situação de cada um; `undefined` sem sinal (o convite é do servidor, e sem
   * ele vale o presencial de sempre). Cada participante convidado leva o selo da resposta dele.
   */
  convites?: ConviteFeito[];
  /** Convidar as pessoas marcadas que ainda não têm convite em aberto; `paraConvidar` diz quantas são. */
  aoConvidar?: () => void;
  paraConvidar?: number;
  convidando?: boolean;
}

/**
 * "Participantes · equipe da OS": você sempre participa; marque quem mais está presente. A APR exige ao menos 2 participantes
 * (ninguém executa sozinho) e não tem máximo. Equipe com só 1 pessoa disponível não consegue iniciar a APR, e a seção diz isso
 * sem esperar o toque.
 */
export function ParticipantesApr({ equipe, usuarioId, marcados, responsavelId, aoAlternar, aoTornarResponsavel, erro, convites, aoConvidar, paraConvidar = 0, convidando = false }: ParticipantesAprProps) {
  const sozinho = equipe.length < MIN_PARTICIPANTES;
  return (
    <View style={estilos.secao}>
      <Text accessibilityRole="header" style={estilos.titulo}>
        Participantes · equipe da OS
      </Text>
      {sozinho ? (
        <Aviso tom="blq" icone="people-outline" titulo="Não dá para iniciar a APR: só há 1 pessoa disponível na equipe desta OS.">
          {`A APR precisa de ao menos ${MIN_PARTICIPANTES} participantes, porque ninguém executa o serviço sozinho. Quem está ausente, desligado ou sem acesso não entra. Fale com o seu supervisor para incluir outra pessoa na equipe.`}
        </Aviso>
      ) : null}
      <ListaDeOpcoes>
        {equipe.map((c) => {
          const voce = c.id === usuarioId;
          const marcado = marcados.includes(c.id);
          const responsavel = c.id === responsavelId;
          const convite = marcado ? convites?.find((x) => x.convidado.id === c.id) : undefined;
          const selo = convite ? seloDoConvite(convite) : null;
          return (
            <Opcao
              key={c.id}
              rotulo={`${c.nome}${voce ? " (você)" : ""}`}
              detalhe={`mat. ${c.matricula}${c.cargo ? ` · ${c.cargo}` : ""}${c.assinatura_path ? "" : " · sem assinatura cadastrada"}${convite?.situacao === "recusado" && convite.motivo ? ` · Não pode: ${convite.motivo}` : ""}`}
              marcada={marcado}
              desabilitada={voce}
              aoPressionar={() => aoAlternar(c.id)}
              direita={
                marcado ? (
                  <View style={estilos.selos}>
                    {responsavel ? <Selo tom="dark">Responsável</Selo> : <Selo>Executor</Selo>}
                    {selo ? <Selo tom={selo.tom}>{selo.rotulo}</Selo> : null}
                  </View>
                ) : undefined
              }
            />
          );
        })}
      </ListaDeOpcoes>
      {aoTornarResponsavel ? (
        <View style={estilos.responsavel}>
          {marcados
            .filter((id) => id !== responsavelId)
            .map((id) => (
              <Botao key={id} titulo={`Tornar ${equipe.find((c) => c.id === id)?.nome.split(" ")[0] ?? "o colega"} responsável`} variante="texto" bloco={false} aoPressionar={() => aoTornarResponsavel(id)} />
            ))}
        </View>
      ) : null}
      {erro && !sozinho ? <Aviso tom="blq">{erro}</Aviso> : null}
      {aoConvidar && paraConvidar > 0 ? (
        <View style={estilos.convidar}>
          <Botao titulo={`Convidar ${paraConvidar} ${paraConvidar === 1 ? "pessoa" : "pessoas"}`} icone="paper-plane-outline" variante="secundario" enviando={convidando} bloco={false} aoPressionar={aoConvidar} />
          <Text style={estilos.nota}>{`Cada um recebe o convite agora (notificação) e responde em até ${PRAZO_DO_CONVITE_MIN} minutos: "Aceito" ou "Não posso". Com convite, o checklist só começa quando todos aceitam.`}</Text>
        </View>
      ) : null}
      <Text style={estilos.nota}>
        {aoTornarResponsavel
          ? `Você é o responsável por padrão e sempre participa. Marque ao menos mais um colega (a APR exige ${MIN_PARTICIPANTES} participantes, sem máximo); a APR precisa de um responsável.`
          : `Esta OS foi reservada para você: você é o responsável pela APR e sempre participa. Marque ao menos mais um colega (a APR exige ${MIN_PARTICIPANTES} participantes, sem máximo).`}
      </Text>
    </View>
  );
}

interface RiscosAprProps {
  riscos: RiscoDoModelo[];
  itens: ItemDoModelo[];
  marcados: string[];
  aoAlternar: (id: string) => void;
}

/** Os riscos do modelo agrupados por classificação: marque os que existem na atividade; só as medidas deles entram no checklist. */
export function RiscosApr({ riscos, itens, marcados, aoAlternar }: RiscosAprProps) {
  const grupos: { classificacao: string; riscos: RiscoDoModelo[] }[] = [];
  for (const risco of [...riscos].sort((a, b) => a.ordem - b.ordem)) {
    const grupo = grupos.find((g) => g.classificacao === risco.classificacao);
    if (grupo) grupo.riscos.push(risco);
    else grupos.push({ classificacao: risco.classificacao, riscos: [risco] });
  }
  const medidas = (riscoId: string) => itens.filter((i) => i.risco_id === riscoId).length;

  return (
    <View style={estilos.secao}>
      <Text accessibilityRole="header" style={estilos.titulo}>
        Riscos da atividade
      </Text>
      <Text style={estilos.nota}>Marque os riscos que existem nesta atividade. Só as medidas preventivas deles entram no checklist.</Text>
      {grupos.length === 0 ? <Text style={estilos.nota}>Este modelo não tem riscos: o checklist só tem os itens de verificação.</Text> : null}
      {grupos.map((g) => (
        <View key={g.classificacao} style={estilos.grupo}>
          <Text style={estilos.classificacao}>{g.classificacao}</Text>
          <ListaDeOpcoes>
            {g.riscos.map((r) => (
              <Opcao key={r.id} rotulo={r.nome} detalhe={`${medidas(r.id)} medida(s)`} marcada={marcados.includes(r.id)} aoPressionar={() => aoAlternar(r.id)} />
            ))}
          </ListaDeOpcoes>
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  secao: { gap: espaco.s },
  titulo: { fontSize: 16, fontWeight: "700", color: cores.tinta },
  nota: { fontSize: 13, lineHeight: 19, color: cores.tinta4 },
  grupo: { gap: espaco.s },
  classificacao: { fontSize: 12, fontWeight: "700", color: cores.tinta3, textTransform: "uppercase" },
  responsavel: { flexDirection: "row", flexWrap: "wrap", gap: espaco.s },
  convidar: { gap: espaco.s },
  selos: { flexDirection: "row", flexWrap: "wrap", gap: 4, justifyContent: "flex-end" },
});
