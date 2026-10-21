import type { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { VitoriaNaCena } from "@/components/web/treinamento-servico/vitoria/VitoriaNaCena";
import { dataHora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { treinamentosParaValidar } from "@/lib/treinamento-servico-servidor";
import { textoDoAndamento } from "@/lib/treinamento-validacao";

export const metadata: Metadata = { title: "Treinamentos para validar" };

/**
 * Os treinamentos de serviço que esperam a decisão de quem pergunta (`validacao-de-treinamento.md`): cada um foi enviado por um
 * autor e escolheu a equipe desta pessoa entre as que mais fazem o serviço. Abrir leva à tela de validar, com o conteúdo e as respostas.
 */
export default async function TreinamentosParaValidarPage() {
  const treinamentos = await treinamentosParaValidar();

  return (
    <Screen className="ts-pagina">
      <header className="ts-cabecalho">
        <div className="ts-cabecalho-texto">
          <span className="lbl">Treinamentos de serviço</span>
          <h1>Para validar</h1>
        </div>
        <div className="ts-cabecalho-selos">
          <Badge tone={treinamentos.length > 0 ? "exe" : "neu"}>{treinamentos.length === 0 ? "Nada esperando" : treinamentos.length === 1 ? "1 esperando você" : `${treinamentos.length} esperando você`}</Badge>
        </div>
      </header>

      {treinamentos.length === 0 ? (
        <section className="panel ts-sem-rascunho">
          <VitoriaNaCena chave="nada-a-validar" reacao="certo" tamanho={96}>
            <strong className="ts-balao-titulo">Nada para validar agora</strong>
            <p>Quando alguém enviar o treinamento de um serviço que a sua equipe faz, ele aparece aqui e você recebe um aviso.</p>
          </VitoriaNaCena>
          <div className="row g8 wrap">
            <LinkButton variant="line" href={rotas.app.catalogo}>
              Ir ao catálogo
            </LinkButton>
          </div>
        </section>
      ) : (
        <ul className="ts-lista-validar">
          {treinamentos.map((t) => (
            <li key={t.codigo} className="panel">
              <div className="stack g4">
                <span className="mono small">{t.codigo}</span>
                <h2>{t.descricao}</h2>
                <span className="small">
                  Versão {t.versao} · enviada por {t.autor_nome ?? "—"} em {dataHora(t.enviada_em)}
                </span>
              </div>
              <div className="row g8 wrap">
                <Badge tone="al">{textoDoAndamento(t)}</Badge>
                {t.validadores.map((v) => (
                  <Badge key={v.equipe_nome} tone={v.decisao === "aprovou" ? "enc" : v.decisao === "recusou" ? "blq" : "neu"}>
                    {v.equipe_nome}
                  </Badge>
                ))}
              </div>
              <LinkButton variant="p" href={rotas.app.treinamentoServico(t.codigo, "validar")}>
                Revisar e decidir
                <Icon name="right" size={16} />
              </LinkButton>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
