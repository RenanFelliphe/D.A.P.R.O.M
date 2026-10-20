import { useSessao } from "@/sessao/SessaoProvider";
import { Aviso } from "@/ui/Aviso";
import { useEquipesDoServico } from "./consultas";

/**
 * Para quem a sugestão vai: a equipe que mais faz o serviço (o supervisor dela avalia) ou, sem equipe, a administração. Se a pessoa
 * é a supervisora dessa equipe, a `api` manda para a administração (ninguém avalia a própria sugestão). Sem a resposta da `api`, some.
 */
export function DestinoDaSugestao({ codigo }: { codigo: string }) {
  const { eu } = useSessao();
  const equipes = useEquipesDoServico(codigo);
  if (!equipes.data) return null;
  const responsavel = equipes.data.find((e) => e.responsavel);
  const euSupervisiono = responsavel ? (eu?.equipes_supervisionadas ?? []).some((e) => e.id === responsavel.equipe_id) : false;

  if (!responsavel) return <Aviso titulo="Vai para a administração.">Nenhuma equipe tem OS deste serviço ainda.</Aviso>;
  if (euSupervisiono) return <Aviso titulo="Vai para a administração.">{`Você supervisiona a equipe ${responsavel.nome}, a que mais faz este serviço, e ninguém avalia a própria sugestão.`}</Aviso>;
  return (
    <Aviso titulo={`Vai para a equipe ${responsavel.nome}.`}>
      {responsavel.supervisor_nome ? `${responsavel.supervisor_nome} avalia: a equipe é a que mais faz este serviço.` : "É a equipe que mais faz este serviço; quem a comanda avalia."}
    </Aviso>
  );
}
