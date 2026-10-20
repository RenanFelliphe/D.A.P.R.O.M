import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ROTULO_DO_ESTADO_DA_CONFERENCIA, ROTULO_DO_TIPO_DA_CONFERENCIA, type ConferenciaDaApi } from "@shared/api/conferencia-execucao";
import { passoDaConferencia, prazoDaConferencia } from "@shared/api/conferencia-texto";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Cartao } from "@/ui/Cartao";
import { Segmentos } from "@/ui/Segmentos";
import { Selo } from "@/ui/Selo";
import { Tela } from "@/ui/Tela";
import { AcoesDaConferencia } from "./AcoesDaConferencia";
import { CartaoDoCampo } from "./CartaoDoCampo";
import { EquipeDaConferencia } from "./EquipeDaConferencia";
import { FalaDaVitoria } from "./FalaDaVitoria";
import { diferencasSemEscolha, escolhasIniciais, tomDoPasso, tomDoSeloDoEstado } from "./regras";
import { Surgir } from "./Surgir";

type Pagina = "campos" | "equipe";

interface TelaDaConferenciaProps {
  c: ConferenciaDaApi;
  aoAtualizar: () => void;
  atualizando: boolean;
}

/**
 * A conferência da execução em duas páginas: as diferenças campo a campo (onde o responsável escolhe) e a equipe (quem sincronizou, deu a
 * ciência ou assinou). No alto ficam o passo em que a conferência está e o prazo; embaixo, o que a pessoa pode fazer agora.
 */
export function TelaDaConferencia({ c, aoAtualizar, atualizando }: TelaDaConferenciaProps) {
  const [pagina, setPagina] = useState<Pagina>("campos");
  /** O que a pessoa mexeu; o resto vale o padrão sugerido (`escolhasIniciais`), que a releitura da conferência pode ampliar. */
  const [toques, setToques] = useState<Record<string, string>>({});
  const escolhas = useMemo(() => ({ ...escolhasIniciais(c), ...toques }), [c, toques]);
  const passo = passoDaConferencia(c);
  const prazo = prazoDaConferencia(c, new Date());
  const faltaEscolher = c.estado === "aguardando_responsavel" ? diferencasSemEscolha(c) : 0;
  const linhaDoPrazo = prazo ? [prazo, faltaEscolher > 0 ? `Falta escolher ${faltaEscolher} ${faltaEscolher === 1 ? "diferença" : "diferenças"}` : null].filter(Boolean).join(". ") + "." : null;

  return (
    <Tela bordas={["bottom"]} aoAtualizar={aoAtualizar} atualizando={atualizando}>
      <View style={estilos.cabecalho}>
        <Text style={estilos.ordem}>{`OS ${c.os.numero_ordem ?? "—"}`}</Text>
        <Selo tom={tomDoSeloDoEstado(c.estado)}>{ROTULO_DO_ESTADO_DA_CONFERENCIA[c.estado]}</Selo>
        {c.tipo ? <Selo tom="neu">{ROTULO_DO_TIPO_DA_CONFERENCIA[c.tipo]}</Selo> : null}
      </View>
      <Text style={estilos.suave}>{c.os.titulo}</Text>

      <FalaDaVitoria />

      <Surgir>
        <Aviso tom={tomDoPasso(c)} icone={c.estado === "concluida" ? "checkmark-circle-outline" : "git-compare-outline"} titulo={passo.titulo}>
          {passo.texto}
        </Aviso>
      </Surgir>
      {linhaDoPrazo ? <Text style={estilos.suave}>{linhaDoPrazo}</Text> : null}

      <Segmentos
        opcoes={[
          { id: "campos", rotulo: c.tipo === "resumo" ? "Resumo" : "Diferenças" },
          { id: "equipe", rotulo: "Equipe" },
        ]}
        valor={pagina}
        aoMudar={setPagina}
      />

      {pagina === "campos" ? (
        c.campos.length === 0 ? (
          <Cartao>
            <Text style={estilos.texto}>As diferenças aparecem aqui quando todos os aparelhos da equipe sincronizarem. Quem registrou a execução sem sinal precisa abrir o app com conexão.</Text>
          </Cartao>
        ) : (
          c.campos.map((campo, i) => (
            <Surgir key={`${c.id}-${campo.campo}`} atraso={i * 40}>
              <CartaoDoCampo c={c} campo={campo} escolha={escolhas[campo.campo]} aoEscolher={(valor) => setToques((t) => ({ ...t, [campo.campo]: valor }))} />
            </Surgir>
          ))
        )
      ) : (
        <EquipeDaConferencia c={c} />
      )}

      <AcoesDaConferencia c={c} escolhas={escolhas} aoDecidir={() => setToques({})} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: espaco.s },
  ordem: { fontSize: 16, fontWeight: "700", color: cores.tinta },
  suave: { fontSize: 13, lineHeight: 19, color: cores.tinta4 },
  texto: { fontSize: 14, lineHeight: 20, color: cores.tinta3 },
});
