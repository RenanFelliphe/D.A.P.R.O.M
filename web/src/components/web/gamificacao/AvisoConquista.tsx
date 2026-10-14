"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { JanelaModal } from "@/components/web/JanelaModal";
import { SeloPatente } from "@/components/web/gamificacao/SeloPatente";
import { chamar } from "@/lib/cliente-api";
import { caminhosDaApi, pontos, type MinhaPontuacao } from "@/lib/gamificacao";

/**
 * A janela "Conquista desbloqueada" (e "Nova patente"): abre na primeira vez que a pessoa entra na web ou no app depois de a
 * conquista ou a patente chegar. Ao fechar, marca os avisos como vistos (`POST /gamificacao/avisos/vistos`) e não volta.
 * A Casca só a monta quando `GET /me` diz que há avisos pendentes.
 */
export function AvisoConquista() {
  const router = useRouter();
  const [avisos, setAvisos] = useState<MinhaPontuacao["avisos"] | null>(null);

  useEffect(() => {
    let ativo = true;
    chamar<MinhaPontuacao>("GET", caminhosDaApi.eu)
      .then((eu) => {
        if (ativo && (eu.avisos.conquistas.length > 0 || eu.avisos.patente)) setAvisos(eu.avisos);
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, []);

  if (!avisos) return null;

  async function fechar() {
    setAvisos(null);
    try {
      await chamar("POST", caminhosDaApi.avisosVistos);
    } catch {
      /* o aviso volta na próxima abertura */
    }
    router.refresh();
  }

  return (
    <JanelaModal titulo="Parabéns!" aoFechar={fechar}>
      {avisos.patente && (
        <div className="aviso-gam" data-treino="aviso-patente">
          <span className="lbl">Nova patente</span>
          <SeloPatente patente={avisos.patente} tamanho="xg" semNome />
          <h3>{avisos.patente.nome}</h3>
          <span className="aviso-sub">Você chegou a {pontos(avisos.patente.pontos_necessarios)} nesta temporada.</span>
        </div>
      )}
      {avisos.conquistas.map((c) => (
        <div key={c.id} className="aviso-gam">
          <span className="lbl">Conquista desbloqueada</span>
          {c.imagem_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.imagem_url} alt="" />
          ) : (
            <Icon name="trophy" size={24} />
          )}
          <h3>{c.titulo}</h3>
          <span className="aviso-sub">{c.descricao}</span>
          {c.pontos > 0 && <span className="aviso-sub">+{pontos(c.pontos)}</span>}
        </div>
      ))}
      <Button variant="p" onClick={fechar}>
        Continuar
      </Button>
    </JanelaModal>
  );
}
