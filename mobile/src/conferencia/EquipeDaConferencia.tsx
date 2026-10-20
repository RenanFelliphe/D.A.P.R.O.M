import { StyleSheet, Text, View } from "react-native";
import type { ConferenciaDaApi, VersaoDeAutor } from "@shared/api/conferencia-execucao";
import { ROTULO_DO_RESULTADO } from "@shared/api/conferencia-execucao";
import { dataHora, hora } from "@shared/api/formatar";
import { useSessao } from "@/sessao/SessaoProvider";
import { cores, espaco, raio } from "@/tema/tema";
import { Cartao, TituloDeCartao } from "@/ui/Cartao";
import { Selo } from "@/ui/Selo";

/** Quem participa da conferência e em que pé está cada um: sincronizou, deu a ciência ou assinou (e a ressalva, se houve). */
export function EquipeDaConferencia({ c }: { c: ConferenciaDaApi }) {
  const { eu } = useSessao();
  return (
    <>
      <Cartao>
        <TituloDeCartao>Quem participa</TituloDeCartao>
        {c.participantes.map((p) => (
          <View key={p.usuario.id} style={estilos.pessoa}>
            <View style={estilos.linha}>
              <Text style={estilos.nome}>{p.usuario.id === eu?.usuario.id ? `${p.usuario.nome} (você)` : p.usuario.nome}</Text>
              {c.responsavel?.id === p.usuario.id ? <Selo tom="exe">Responsável</Selo> : null}
            </View>
            <View style={estilos.linha}>
              {p.sincronizou ? (
                <Selo tom="enc" icone="checkmark">
                  Sincronizou
                </Selo>
              ) : (
                <Selo tom="al" icone="time-outline">
                  Falta sincronizar
                </Selo>
              )}
              {p.assinatura ? (
                <Selo tom="enc" icone="create-outline">
                  {p.assinatura.tipo === "ciencia" ? "Deu a ciência" : "Assinou"}
                </Selo>
              ) : p.deve_assinar ? (
                <Selo tom="al">{c.tipo === "resumo" ? "Falta a ciência" : "Falta assinar"}</Selo>
              ) : null}
            </View>
            {p.assinatura?.ressalva ? <Text style={estilos.ressalva}>{`Ressalva: ${p.assinatura.ressalva}`}</Text> : null}
          </View>
        ))}
        {c.fechada_em ? <Text style={estilos.suave}>{`Fechada em ${dataHora(c.fechada_em)}.`}</Text> : null}
      </Cartao>

      {c.versoes.length > 0 ? (
        <Cartao>
          <TituloDeCartao>O que cada aparelho registrou</TituloDeCartao>
          {c.versoes.map((v) => (
            <View key={v.autor_id} style={estilos.pessoa}>
              <Text style={estilos.nome}>{v.autor_nome}</Text>
              <Text style={estilos.texto}>{resumoDaVersao(v)}</Text>
            </View>
          ))}
        </Cartao>
      ) : null}
    </>
  );
}

/** A versão de um aparelho numa frase: começou às…, terminou às…, o resultado, as pausas e as fotos. */
function resumoDaVersao(v: VersaoDeAutor): string {
  const partes = [
    v.inicio ? `Início ${hora(v.inicio)}` : "Sem início registrado",
    v.fim ? `fim ${hora(v.fim)}` : "sem fim registrado",
    v.resultado ? ROTULO_DO_RESULTADO[v.resultado] : null,
    v.pausas.length > 0 ? `${v.pausas.length} ${v.pausas.length === 1 ? "pausa" : "pausas"}` : "sem pausas",
    v.evidencias > 0 ? `${v.evidencias} ${v.evidencias === 1 ? "foto ou PDF" : "fotos ou PDFs"}` : null,
    v.sem_sinal ? "registrado sem sinal" : null,
  ].filter(Boolean);
  return `${partes.join(" · ")}.`;
}

const estilos = StyleSheet.create({
  pessoa: { gap: espaco.xs, padding: espaco.s, borderRadius: raio.s, backgroundColor: cores.superficie2 },
  linha: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: espaco.s },
  nome: { fontSize: 14, fontWeight: "700", color: cores.tinta },
  texto: { fontSize: 13, lineHeight: 19, color: cores.tinta3 },
  suave: { fontSize: 13, color: cores.tinta4 },
  ressalva: { fontSize: 13, lineHeight: 19, color: cores.alertaTinta },
});
