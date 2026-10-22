"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Icon } from "@/components/ui/Icon";
import { rotas } from "@/lib/rotas";

/**
 * O que saiu da coluna lateral do Perfil (a assinatura, os e-mails, a troca de senha e o anonimato no ranking) vive agora em
 * Configurações. O e-mail de aviso ainda aponta para `/app/perfil#emails`: quem chega por esse link vai direto para a seção de e-mails.
 */
export function AtalhoParaConfiguracoes() {
  const roteador = useRouter();
  useEffect(() => {
    if (window.location.hash === "#emails") roteador.replace(`${rotas.app.configuracoesConta}#emails`);
  }, [roteador]);

  return (
    <section className="panel" aria-labelledby="perfil-config" data-treino="perfil-configuracoes">
      <h2 id="perfil-config" style={{ fontSize: 16, fontWeight: 600 }}>
        Configurações
      </h2>
      <span className="muted small">A sua assinatura, os e-mails que você recebe, a troca de senha e a privacidade no ranking.</span>
      <div>
        <Link href={rotas.app.configuracoesConta} className="btn btn-line btn-sm">
          <Icon name="engrenagem" size={16} />
          Abrir as configurações
        </Link>
      </div>
    </section>
  );
}
