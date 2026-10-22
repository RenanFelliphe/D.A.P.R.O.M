"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BotaoPdfAssinado } from "@/components/assinatura/BotaoPdfAssinado";
import { SeloDaAssinatura } from "@/components/assinatura/SeloDaAssinatura";
import { abrirAbaDeAssinatura, levarAbaParaAAssinatura, useEsperarAssinatura } from "@/components/assinatura/useEsperarAssinatura";
import { mensagemDoErro } from "@/components/app/execucao/useAcao";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import type { AssinaturaJuridica } from "@/lib/assinatura-juridica";
import { chamar } from "@/lib/cliente-api";
import { dataHora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { useConfigDaAssinaturaJuridica } from "@/state/minha-assinatura";

/**
 * Os atos feitos sem sinal, que valeram com a assinatura desenhada: cada um espera a assinatura com validade jurídica. "Assinar" cria o
 * documento no provedor (`POST /assinaturas-juridicas/{id}/enviar`), abre a página dele em outra aba e espera a assinatura chegar. Uma de
 * cada vez; a que foi assinada fica na lista, com o selo e o PDF, até a pessoa sair da tela.
 */
export function ListaDeAssinaturasPendentes({ inicial }: { inicial: AssinaturaJuridica[] }) {
  const roteador = useRouter();
  const juridica = useConfigDaAssinaturaJuridica();
  const [itens, setItens] = useState(inicial);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [esperando, setEsperando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const trocar = (nova: AssinaturaJuridica) => setItens((atuais) => atuais.map((i) => (i.id === nova.id ? nova : i)));

  useEsperarAssinatura(
    esperando,
    (a) => {
      trocar(a);
      if (a.situacao === "aguardando") return;
      setEsperando(null);
      if (a.situacao === "assinada") roteador.refresh();
      else setErro(a.situacao === "recusada" ? "A assinatura foi recusada na página do provedor. Toque em “Assinar” para tentar de novo." : "O provedor não conseguiu concluir a assinatura. Tente de novo.");
    },
    (e) => {
      setEsperando(null);
      setErro(mensagemDoErro(e));
    },
  );

  async function assinar(item: AssinaturaJuridica) {
    setErro(null);
    // A aba do provedor abre já, no clique: depois de uma ida à `api` o navegador a barraria como janela sem pedido.
    const aba = abrirAbaDeAssinatura();
    setEnviando(item.id);
    try {
      const enviada = await chamar<AssinaturaJuridica>("POST", `/assinaturas-juridicas/${item.id}/enviar`);
      trocar(enviada);
      levarAbaParaAAssinatura(aba, enviada.url_assinatura);
      setEsperando(enviada.id);
    } catch (e) {
      aba?.close();
      setErro(mensagemDoErro(e));
    } finally {
      setEnviando(null);
    }
  }

  const abrirDeNovo = (item: AssinaturaJuridica) => {
    if (item.url_assinatura) window.open(item.url_assinatura, "_blank", "noopener");
  };

  if (itens.length === 0) {
    return (
      <Notice tone="ok" icon="check">
        <strong>Nenhum ato esperando.</strong> Quando você fizer algo sem sinal, ele aparece aqui para ser assinado com validade jurídica.
      </Notice>
    );
  }

  return (
    <div className="stack g12">
      {juridica.simulada && (
        <Notice tone="al" icon="alert">
          Provedor simulado: a assinatura é de demonstração e não tem validade jurídica.
        </Notice>
      )}
      {erro && (
        <Notice tone="blq" icon="alert" role="alert">
          {erro}
        </Notice>
      )}
      <ul className="stack g8" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {itens.map((i) => (
          <li key={i.id} className="panel stack g8">
            <div className="row between wrap g8">
              <strong>{i.titulo}</strong>
              <SeloDaAssinatura situacao={i.situacao} />
            </div>
            {i.resumo && <p className="small">{i.resumo}</p>}
            <span className="small muted">
              Feito em {dataHora(i.criada_em)}
              {i.os_id && (
                <>
                  {" · "}
                  <Link href={rotas.app.os(i.os_id)}>Ver a OS</Link>
                </>
              )}
              {i.assinada_em ? ` · assinado em ${dataHora(i.assinada_em)}` : ""}
            </span>
            <div className="row g8 wrap">
              {(i.situacao === "pendente_offline" || i.situacao === "recusada" || i.situacao === "falhou") && (
                <Button variant="p" sm onClick={() => void assinar(i)} disabled={enviando !== null || esperando !== null} aria-busy={enviando === i.id}>
                  {enviando === i.id ? "Enviando…" : "Assinar"}
                </Button>
              )}
              {i.situacao === "aguardando" && (
                <>
                  {esperando === i.id ? (
                    <span className="small" role="status">
                      Aguardando a sua assinatura na página que abriu…
                    </span>
                  ) : (
                    <Button variant="p" sm onClick={() => setEsperando(i.id)} disabled={esperando !== null}>
                      Já assinei: conferir
                    </Button>
                  )}
                  <Button variant="line" sm onClick={() => abrirDeNovo(i)} disabled={!i.url_assinatura}>
                    Abrir de novo
                  </Button>
                  {esperando === i.id && (
                    <Button variant="ghost" sm onClick={() => setEsperando(null)}>
                      Parar de esperar
                    </Button>
                  )}
                </>
              )}
              {i.situacao === "assinada" && i.pdf_pronto && <BotaoPdfAssinado id={i.id} />}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
