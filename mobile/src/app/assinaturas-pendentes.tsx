import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ROTULO_DA_SITUACAO_DA_ASSINATURA_JURIDICA, type AssinaturaJuridica, type SituacaoDaAssinaturaJuridica } from "@shared/api/assinatura-juridica";
import { dataHora } from "@shared/api/formatar";
import type { TomDoSelo } from "@shared/api/tipos";
import { mensagemDoErro } from "@/api/erros";
import { consultarAssinaturaJuridica, enviarAssinaturaPendente } from "@/assinatura/api-juridica";
import { useAssinaturaJuridicaLigada, useAssinaturasPendentes } from "@/assinatura/consultas";
import { EsperaDaAssinatura } from "@/assinatura/EsperaDaAssinatura";
import { AssinaturaCancelada } from "@/assinatura/juridica";
import { useAssinaturaNoProvedor } from "@/assinatura/useAssinaturaNoProvedor";
import { useSessao } from "@/sessao/SessaoProvider";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { mostrarAviso } from "@/ui/AvisoRapido";
import { Botao } from "@/ui/Botao";
import { Cartao, TituloDeCartao } from "@/ui/Cartao";
import { Carregando, Vazio } from "@/ui/Estados";
import { Selo } from "@/ui/Selo";
import { Tela } from "@/ui/Tela";

const TOM_DA_SITUACAO: Record<SituacaoDaAssinaturaJuridica, TomDoSelo> = { pendente_offline: "al", aguardando: "exe", assinada: "enc", recusada: "blq", falhou: "blq" };

/**
 * Os atos feitos sem sinal: valeram com a assinatura desenhada do perfil e agora esperam a assinatura com validade jurídica. Cada item
 * leva à página do provedor (`POST /assinaturas-juridicas/{id}/enviar`); o que já foi enviado e ficou sem assinar continua na lista e
 * retoma a mesma assinatura. Quando assina, o item sai da lista.
 */
export default function AssinaturasPendentes() {
  const consultas = useQueryClient();
  const { eu } = useSessao();
  const ligada = useAssinaturaJuridicaLigada();
  const lista = useAssinaturasPendentes();
  const provedor = useAssinaturaNoProvedor();
  const [emCurso, setEmCurso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function assinar(item: AssinaturaJuridica) {
    setErro(null);
    setEmCurso(item.id);
    try {
      // Ainda sem documento no provedor: envia agora. Já enviado e esperando: só retoma a página da mesma assinatura.
      await provedor.assinar(() => (item.situacao === "pendente_offline" ? enviarAssinaturaPendente(item.id) : consultarAssinaturaJuridica(item.id)));
      mostrarAviso("Assinatura registrada");
    } catch (e) {
      if (!(e instanceof AssinaturaCancelada)) setErro(mensagemDoErro(e));
    } finally {
      setEmCurso(null);
      void lista.refetch();
      void consultas.invalidateQueries({ queryKey: ["me"] });
    }
  }

  if (!eu) return <Carregando />;

  return (
    <Tela bordas={["bottom"]} aoAtualizar={() => void lista.refetch()} atualizando={lista.isRefetching}>
      {provedor.espera ? (
        <Cartao>
          <TituloDeCartao>{provedor.espera.titulo}</TituloDeCartao>
          <EsperaDaAssinatura simulada={eu.assinatura_juridica?.simulada} aoAbrirDeNovo={provedor.abrirDeNovo} aoCancelar={provedor.cancelar} />
        </Cartao>
      ) : null}
      {erro ? <Aviso tom="blq">{erro}</Aviso> : null}
      {!ligada ? (
        <Vazio icone="shield-outline" titulo="Assinatura com validade jurídica desligada" texto="Quando ela estiver ligada, os atos feitos sem sinal aparecem aqui para você assinar." />
      ) : lista.isPending && lista.fetchStatus === "idle" ? (
        <Vazio icone="cloud-offline-outline" titulo="Sem sinal" texto="Conecte-se para assinar os atos feitos sem sinal." />
      ) : lista.isPending ? (
        <Carregando texto="Buscando os atos…" />
      ) : lista.isError ? (
        <Vazio icone="cloud-offline-outline" titulo="Não foi possível carregar" texto={mensagemDoErro(lista.error)} acao={{ titulo: "Tentar de novo", aoPressionar: () => void lista.refetch() }} />
      ) : lista.data.length === 0 ? (
        <Vazio icone="checkmark-done-outline" titulo="Nada para assinar" texto="Todos os atos feitos sem sinal já foram assinados com validade jurídica." />
      ) : (
        lista.data.map((a) => (
          <Cartao key={a.id}>
            <View style={estilos.cabecalho}>
              <Text style={estilos.titulo}>{a.titulo}</Text>
              <Selo tom={TOM_DA_SITUACAO[a.situacao]}>{ROTULO_DA_SITUACAO_DA_ASSINATURA_JURIDICA[a.situacao]}</Selo>
            </View>
            {a.resumo ? <Text style={estilos.texto}>{a.resumo}</Text> : null}
            <Text style={estilos.pequeno}>{`Ato feito em ${dataHora(a.criada_em)}`}</Text>
            <Botao titulo={a.situacao === "pendente_offline" ? "Assinar" : "Continuar a assinatura"} icone="create-outline" enviando={emCurso === a.id} aoPressionar={() => {
              if (emCurso === null) void assinar(a);
            }}
          />
          </Cartao>
        ))
      )}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { gap: espaco.s },
  titulo: { fontSize: 15, fontWeight: "700", color: cores.tinta },
  texto: { fontSize: 14, lineHeight: 20, color: cores.tinta2 },
  pequeno: { fontSize: 12, color: cores.tinta4 },
});
