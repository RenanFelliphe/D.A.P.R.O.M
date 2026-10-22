import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { rotas } from "@/lib/rotas";
import type { RascunhoComIA } from "@/lib/treinamento-servico";
import { VitoriaNaCena } from "../vitoria/VitoriaNaCena";

/** O caminho até publicar, igual nos dois jeitos de começar. */
export const CAMINHO_ATE_PUBLICAR: { icone: IconName; titulo: string; texto: string }[] = [
  { icone: "pencil", titulo: "Conteúdo", texto: "A explicação em passos e as fases do jogo." },
  { icone: "check", titulo: "Revisão", texto: "Cada item conferido, com o trecho de origem quando veio da Vitória." },
  { icone: "play", titulo: "Teste", texto: "Você joga como o técnico, numa janela, sem pontuar." },
  { icone: "shield", titulo: "Publicação", texto: "Termo de revisão e a sua assinatura." },
];

/**
 * O começo do treinamento (tela Criar): o admin escolhe entre gerar o rascunho com a Vitória, para validar depois, ou criar
 * à mão no editor. Sem a IA configurada (ou com o limite da demonstração esgotado), a primeira opção aparece desativada
 * com o motivo, e o caminho manual continua igual.
 */
export function EscolhaDeCriacao({ codigo, descricao, rascunho }: { codigo: string; descricao: string; rascunho: RascunhoComIA }) {
  const { ia } = rascunho;
  const passos = rascunho.explicacao.length;
  const fases = rascunho.fases.length;
  const temConteudo = passos + fases > 0;
  const motivoSemIA = !ia.disponivel ? (ia.motivo ?? "A IA não está configurada neste ambiente") : !ia.pode_gerar ? (ia.motivo ?? "Limite da demonstração atingido") : null;

  return (
    <div className="ts-escolha">
      <VitoriaNaCena chave="escolha" reacao="ola" tamanho={112}>
        <strong className="ts-balao-titulo">Vamos criar o treinamento de {descricao}?</strong>
        <p>Escolha como começar. Nos dois caminhos você valida, testa e assina antes de os técnicos verem.</p>
      </VitoriaNaCena>

      {temConteudo && (
        <Notice tone="info" icon="info">
          Este serviço já tem um rascunho com {passos === 1 ? "1 passo" : `${passos} passos`} e {fases === 1 ? "1 fase" : `${fases} fases`}. Gerar com a Vitória substitui esse conteúdo;
          criar manualmente continua a partir dele.
        </Notice>
      )}

      <div className="ts-escolha-opcoes">
        <article className="ts-caminho-cartao ts-caminho-ia" data-desativado={motivoSemIA ? "" : undefined} style={{ "--i": 0 } as CSSProperties}>
          <div className="ts-caminho-cartao-topo">
            <span className="ts-caminho-icone">
              <Icon name="sparkle" size={24} />
            </span>
            <Badge tone="brand">Validar depois</Badge>
          </div>
          <h2>Gerar com a Vitória (IA)</h2>
          <p>Cole o texto do procedimento. Em alguns minutos a Vitória monta a explicação e as fases, e marca de que trecho saiu cada item.</p>
          <ul className="ts-caminho-lista">
            <li>
              <Icon name="check" size={13} />
              Mais rápido para procedimentos longos
            </li>
            <li>
              <Icon name="check" size={13} />O que ela estranhar vira pendência para você conferir
            </li>
            <li>
              <Icon name="check" size={13} />
              Ajustes por conversa depois de gerar
            </li>
          </ul>
          {motivoSemIA ? (
            <>
              <Button variant="p" block disabled>
                Gerar com a Vitória
              </Button>
              <span className="small">{motivoSemIA}.</span>
            </>
          ) : (
            <>
              <LinkButton variant="p" block href={rotas.app.treinamentoServico(codigo, "gerar")}>
                Gerar com a Vitória
                <Icon name="right" size={16} />
              </LinkButton>
              <span className="small">
                {ia.usa_ia ? `Rodadas deste treinamento: ${ia.rodadas_usadas} de ${ia.limite_rodadas}.` : `Treinamentos feitos com a Vitória: ${ia.treinamentos_usados} de ${ia.limite_treinamentos}.`}
              </span>
            </>
          )}
        </article>

        <article className="ts-caminho-cartao" style={{ "--i": 1 } as CSSProperties}>
          <div className="ts-caminho-cartao-topo">
            <span className="ts-caminho-icone">
              <Icon name="pencil" size={24} />
            </span>
            <Badge tone="neu">Sem IA</Badge>
          </div>
          <h2>Criar manualmente</h2>
          <p>Escreva você mesmo os passos da explicação e monte cada fase do jogo no editor.</p>
          <ul className="ts-caminho-lista">
            <li>
              <Icon name="check" size={13} />
              Controle total do texto
            </li>
            <li>
              <Icon name="check" size={13} />
              Bom para treinamentos curtos
            </li>
            <li>
              <Icon name="check" size={13} />
              Funciona mesmo sem a IA
            </li>
          </ul>
          <LinkButton variant="line" block href={rotas.app.treinamentoServico(codigo, "explicacao")}>
            Criar manualmente
            <Icon name="right" size={16} />
          </LinkButton>
          <span className="small">Começa pela explicação; depois, as fases.</span>
        </article>
      </div>

      <section className="ts-caminho" aria-labelledby="titulo-caminho">
        <h2 id="titulo-caminho">O caminho até publicar</h2>
        <ol className="ts-caminho-etapas">
          {CAMINHO_ATE_PUBLICAR.map((e, i) => (
            <li key={e.titulo} style={{ "--i": i } as CSSProperties}>
              <span className="ts-caminho-etapa-icone">
                <Icon name={e.icone} size={16} />
              </span>
              <strong>
                {i + 1}. {e.titulo}
              </strong>
              <span className="small">{e.texto}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
