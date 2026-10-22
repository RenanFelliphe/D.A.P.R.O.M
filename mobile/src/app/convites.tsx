import { useState } from "react";
import { mensagemDoErro } from "@/api/erros";
import { CartaoDeConvite } from "@/convites/CartaoDeConvite";
import { useConvitesRecebidos } from "@/convites/consultas";
import { Carregando, Vazio } from "@/ui/Estados";
import { Tela } from "@/ui/Tela";

/**
 * Convites para a APR: cada colega que está montando uma APR e escolheu você como participante espera a sua resposta ("Aceito" ou "Não
 * posso", com o motivo). O convite vale por 15 minutos. Sem sinal não há convites: a APR segue pelo presencial de sempre.
 */
export default function Convites() {
  const convites = useConvitesRecebidos();
  const [atualizando, setAtualizando] = useState(false);

  const atualizar = async () => {
    setAtualizando(true);
    try {
      await convites.refetch();
    } finally {
      setAtualizando(false);
    }
  };

  return (
    <Tela bordas={["bottom"]} aoAtualizar={() => void atualizar()} atualizando={atualizando}>
      {convites.isPending && convites.fetchStatus !== "idle" ? (
        <Carregando texto="Buscando os convites…" />
      ) : convites.isError ? (
        <Vazio icone="cloud-offline-outline" titulo="Não foi possível carregar os convites" texto={mensagemDoErro(convites.error)} acao={{ titulo: "Tentar de novo", aoPressionar: () => void convites.refetch() }} />
      ) : !convites.data || convites.data.length === 0 ? (
        <Vazio icone="people-outline" titulo="Nenhum convite agora" texto="Quando um colega convidar você para participar de uma APR, o convite aparece aqui e você recebe uma notificação. Sem sinal, a APR segue pelo presencial de sempre." />
      ) : (
        convites.data.map((c) => <CartaoDeConvite key={c.id} convite={c} />)
      )}
    </Tela>
  );
}
