import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { MOTIVO_DO_AUSENTE } from "@shared/api/ausencia";
import { mensagemDoErro } from "@/api/erros";
import { useMinhasAusencias } from "@/ausencia/consultas";
import { CartaoDaAusencia } from "@/ausencia/CartaoDaAusencia";
import { FormularioDePedido } from "@/ausencia/FormularioDePedido";
import { modoDaAusencia } from "@/ausencia/regras";
import { FaixaDeAusencia } from "@/os/FaixaDeAusencia";
import { useSessao } from "@/sessao/SessaoProvider";
import { cores } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { Carregando, Vazio } from "@/ui/Estados";
import { Tela } from "@/ui/Tela";

/**
 * Minhas ausências: pedir (ou, no supervisor titular, registrar a própria), acompanhar o pedido, confirmar o que o supervisor aprovou,
 * pedir o fim antecipado e confirmar o retorno. Quem está ausente só visualiza o sistema, mas ainda cuida da própria ausência. As
 * respostas do supervisor aos pedidos dos outros ficam na web.
 */
export default function Ausencias() {
  const { eu, recarregarEu } = useSessao();
  const [pedindo, setPedindo] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const ausencias = useMinhasAusencias(eu?.usuario.id ?? "");

  if (!eu) return <Carregando />;
  const { modo, titular, motivoSemPedido } = modoDaAusencia(eu);
  const ausente = Boolean(eu.ausencia);
  const desabilitado = ausente || motivoSemPedido !== null;
  const motivo = ausente ? (modo === "pedir" ? "Para estender a ausência, peça ao seu supervisor: ele altera a data de retorno." : MOTIVO_DO_AUSENTE) : motivoSemPedido;

  const atualizar = async () => {
    setAtualizando(true);
    try {
      await Promise.all([ausencias.refetch(), recarregarEu()]);
    } finally {
      setAtualizando(false);
    }
  };

  return (
    <Tela bordas={["bottom"]} aoAtualizar={() => void atualizar()} atualizando={atualizando}>
      <FaixaDeAusencia />
      <Botao titulo={modo === "pedir" ? "Pedir ausência" : "Registrar a minha ausência"} icone="calendar-outline" variante={desabilitado ? "secundario" : "primario"} aoPressionar={() => !desabilitado && setPedindo(true)} />
      {desabilitado && motivo ? <Text style={estilos.nota}>{motivo}</Text> : null}
      {ausencias.isPending ? (
        <Carregando texto="Buscando as ausências…" />
      ) : ausencias.isError ? (
        <Vazio icone="cloud-offline-outline" titulo="Não foi possível carregar as ausências" texto={mensagemDoErro(ausencias.error)} acao={{ titulo: "Tentar de novo", aoPressionar: () => void ausencias.refetch() }} />
      ) : ausencias.data === null ? (
        <Vazio icone="calendar-outline" titulo="Ausências indisponíveis" texto="As ausências não valem no Campo de treino." />
      ) : ausencias.data.length === 0 ? (
        <Vazio icone="calendar-outline" titulo="Nenhuma ausência" texto="Você não tem ausências registradas." />
      ) : (
        <>
          {ausencias.data.some((a) => a.situacao === "aguardando_confirmacao") ? <Aviso tom="al">O supervisor aprovou um pedido seu: confirme, assinando, para a ausência valer.</Aviso> : null}
          {ausencias.data.map((a) => (
            <CartaoDaAusencia key={a.id} ausencia={a} titular={titular} />
          ))}
        </>
      )}
      {pedindo ? <FormularioDePedido registrar={modo === "registrar"} aoFechar={() => setPedindo(false)} /> : null}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  nota: { fontSize: 13, lineHeight: 18, color: cores.tinta4 },
});
