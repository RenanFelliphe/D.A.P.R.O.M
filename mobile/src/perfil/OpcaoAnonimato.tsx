import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { cliente } from "@/api/api";
import { mensagemDoErro } from "@/api/erros";
import { useSessao } from "@/sessao/SessaoProvider";
import { Aviso } from "@/ui/Aviso";
import { Opcao } from "@/ui/Opcao";

/**
 * "Aparecer como anônimo no ranking": quem marca aparece como "Participante anônimo" para os outros (a própria pessoa e o admin veem o
 * nome). Os pontos continuam valendo para a pessoa e para a equipe. Grava na hora (`PUT /me/ranking-anonimo`); se falhar, volta como estava.
 */
export function OpcaoAnonimato() {
  const { eu } = useSessao();
  const consultas = useQueryClient();
  const [valor, setValor] = useState<boolean | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  if (!eu || eu.usuario.perfil !== "tecnico") return null;
  const anonimo = valor ?? eu.usuario.ranking_anonimo ?? false;

  const alternar = async () => {
    const anterior = anonimo;
    setValor(!anterior);
    setErro(null);
    try {
      await cliente.chamar("/me/ranking-anonimo", { metodo: "PUT", corpo: { anonimo: !anterior } });
      await Promise.all([consultas.invalidateQueries({ queryKey: ["eu"] }), consultas.invalidateQueries({ queryKey: ["gamificacao"] })]);
    } catch (e) {
      setValor(anterior);
      setErro(mensagemDoErro(e));
    }
  };

  return (
    <>
      <Opcao rotulo="Aparecer como anônimo no ranking" detalhe="Os outros veem “Participante anônimo”. Seus pontos continuam valendo para você e para a sua equipe." marcada={anonimo} aoPressionar={() => void alternar()} />
      {erro ? <Aviso tom="blq">{erro}</Aviso> : null}
    </>
  );
}
