import type { Atividade } from "@/components/web/apoio/tipos";
import { api } from "@/lib/api";
import { hoje } from "@/lib/formatar";
import { equipesDoSupervisor, rotuloDoStatus, type Equipe, type OsStatus, type Usuario } from "@/lib/tipos";
import { CartaoApoio } from "./CartaoApoio";
import { CartaoReprogramar } from "./CartaoReprogramar";

interface DecisoesDaOsProps {
  os: {
    id: string;
    numero_ordem: string | null;
    titulo: string;
    status: OsStatus;
    equipe_id: string;
    data_inicio_prog: string;
    local_instalacao: { id: string; codigo: string; endereco: string | null };
  };
  usuario: Usuario;
  equipes: Equipe[];
  /** Com o cartão da OS de apoio; sem ele, só reprogramar (o apoio já terminou). */
  comApoio: boolean;
}

/**
 * As decisões do supervisor ou do admin sobre uma OS aberta: abrir uma OS de apoio (outra equipe resolve antes) e
 * reprogramar (nova data ou equipe, com justificativa). Aparecem no alerta e no detalhe da OS; quem chama confere se a
 * pessoa supervisiona a equipe da OS e se a OS ainda está aberta.
 */
export async function DecisoesDaOs({ os, usuario, equipes, comApoio }: DecisoesDaOsProps) {
  const atividades = comApoio ? (await api<{ atividades: Atividade[] }>("/atividades", { consulta: { tamanho: 200 } })).atividades : [];
  const hojeDia = hoje();
  return (
    <div className={comApoio ? "decide" : "decide um"}>
      {comApoio && (
        <CartaoApoio
          osId={os.id}
          numeroOrdem={os.numero_ordem}
          tituloDaOs={os.titulo}
          situacaoDaOriginal={rotuloDoStatus[os.status].toLowerCase()}
          local={{ id: os.local_instalacao.id, codigo: os.local_instalacao.codigo, endereco: os.local_instalacao.endereco }}
          equipes={equipes}
          atividades={atividades}
          hoje={hojeDia}
          equipesDoSupervisor={equipesDoSupervisor(usuario)}
        />
      )}
      <CartaoReprogramar osId={os.id} dataAtual={os.data_inicio_prog} equipeAtualId={os.equipe_id} equipes={equipes} hoje={hojeDia} />
    </div>
  );
}
