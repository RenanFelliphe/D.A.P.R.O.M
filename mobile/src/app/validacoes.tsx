import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { ehSupervisor } from "@shared/api/tipos";
import { ROTULO_DO_TIPO, type TipoDeValidacao } from "@shared/api/validacoes";
import { mensagemDoErro } from "@/api/erros";
import { useSessao } from "@/sessao/SessaoProvider";
import { cores } from "@/tema/tema";
import { Carregando, Vazio } from "@/ui/Estados";
import { Segmentos } from "@/ui/Segmentos";
import { Tela } from "@/ui/Tela";
import { useValidacoes } from "@/validacoes/consultas";
import { CartaoDeValidacao } from "@/validacoes/CartaoDeValidacao";
import { itensDoFiltro, resumoDaFila, tiposDoFiltro } from "@/validacoes/regras";

/**
 * Validações: tudo o que espera a decisão ou a assinatura do supervisor numa fila só (`docs/pessoas-e-equipes.md`, seção 5). A tela não
 * decide nada: cada item abre a tela onde a decisão é tomada, no app ou, quando só a web a tem, no navegador. Os urgentes vêm primeiro;
 * o filtro por tipo só mostra os tipos que têm item.
 */
export default function Validacoes() {
  const { eu } = useSessao();
  const supervisor = eu ? ehSupervisor(eu.usuario) : false;
  const fila = useValidacoes(supervisor);
  const [filtro, setFiltro] = useState<TipoDeValidacao | "tudo">("tudo");
  const [atualizando, setAtualizando] = useState(false);

  if (!eu) return <Carregando />;

  const atualizar = async () => {
    setAtualizando(true);
    try {
      await fila.refetch();
    } finally {
      setAtualizando(false);
    }
  };

  const dados = fila.data;
  const tipo = filtro === "tudo" ? null : filtro;
  const itens = dados ? itensDoFiltro(dados, tipo) : [];

  return (
    <Tela bordas={["bottom"]} aoAtualizar={() => void atualizar()} atualizando={atualizando}>
      {!supervisor || dados === null ? (
        <Vazio icone="shield-checkmark-outline" titulo="Sem validações para você" texto="Esta fila é de quem supervisiona uma equipe." />
      ) : fila.isPending ? (
        <Carregando texto="Buscando as validações…" />
      ) : fila.isError ? (
        <Vazio icone="cloud-offline-outline" titulo="Não foi possível carregar as validações" texto={mensagemDoErro(fila.error)} acao={{ titulo: "Tentar de novo", aoPressionar: () => void fila.refetch() }} />
      ) : (
        <>
          <Text style={estilos.resumo}>{resumoDaFila(dados!.total)}</Text>
          {dados!.total > 0 ? (
            <Segmentos<TipoDeValidacao | "tudo">
              rolavel
              valor={filtro}
              aoMudar={setFiltro}
              opcoes={[{ id: "tudo", rotulo: `Tudo (${dados!.total})` }, ...tiposDoFiltro(dados!, tipo).map((t) => ({ id: t, rotulo: `${ROTULO_DO_TIPO[t]} (${dados!.por_tipo[t]})` }))]}
            />
          ) : null}
          {itens.length === 0 ? (
            <Vazio
              icone="checkmark-done-outline"
              titulo={tipo ? "Nada deste tipo esperando" : "Nada para validar agora"}
              texto={tipo ? "Quando houver algo deste tipo para você, ele aparece aqui." : "A OS concluída pela equipe, o treinamento, a sugestão de materiais, a conferência e o pedido de ausência aparecem aqui quando esperarem por você."}
            />
          ) : (
            itens.map((i) => <CartaoDeValidacao key={i.chave} item={i} />)
          )}
        </>
      )}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  resumo: { fontSize: 13, color: cores.tinta4 },
});
