import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/Badge";
import { BotoesDaPatente, NovaPatente } from "@/components/web/gamificacao/AcoesDoCadastro";
import { SeloPatente } from "@/components/web/gamificacao/SeloPatente";
import { editaGamificacao } from "@/components/web/gamificacao/secao";
import { lerPatentes } from "@/data/gamificacao";
import { usuarioAtual } from "@/lib/api";
import { cx } from "@/lib/cx";
import { numero, pontos, type Patente } from "@/lib/gamificacao";

export const metadata: Metadata = { title: "Patentes" };

/** A imagem da patente (a das pessoas ou a das equipes); sem imagem, a inicial do nome na cor da patente. */
function ImagemDaPatente({ patente, url }: { patente: Patente; url: string | null }) {
  if (!url) return <SeloPatente patente={{ nome: patente.nome, cor: patente.cor, imagem_url: null }} tamanho="g" semNome />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" loading="lazy" />;
}

/**
 * Patentes: a escada dos níveis, com as duas imagens (a das pessoas e a das equipes) e a pontuação de cada um, e "você está
 * aqui" na patente de agora. As patentes valem só na temporada (zeram com ela; no geral aparece a maior já alcançada). O admin
 * cria, edita, troca cada imagem, desativa e exclui (excluir só vale para a que nunca foi gravada numa temporada fechada nem é
 * meta de uma conquista).
 */
export default async function PatentesPage() {
  const [{ usuario }, lista] = await Promise.all([usuarioAtual(), lerPatentes()]);
  const podeEditar = editaGamificacao(usuario);

  return (
    <div className="stack g16">
      <div className="row between wrap" style={{ alignItems: "flex-end" }}>
        <span className="muted" style={{ fontSize: 14, maxWidth: 760 }}>
          Quanto mais pontos na temporada, mais alta a patente. As patentes zeram a cada temporada (um trimestre); a maior patente já alcançada fica no seu perfil. A equipe usa a mesma tabela, aplicada à média por membro, e cada patente tem a imagem das pessoas e a das equipes.
        </span>
        {podeEditar && <NovaPatente />}
      </div>

      {lista.patentes.length === 0 ? (
        <div className="card muted">Nenhuma patente cadastrada: ninguém tem patente até o admin cadastrar a primeira.</div>
      ) : (
        <div className="escada">
          {lista.patentes.map((p) => {
            const atual = lista.voce?.patente_id === p.id;
            return (
              <article key={p.id} className={cx("degrau", atual && "atual", !p.ativa && "desativada")} style={{ "--cor-patente": p.cor } as CSSProperties} aria-label={p.nome}>
                <div className="d-imagens">
                  <figure>
                    <ImagemDaPatente patente={p} url={p.imagem_url} />
                    <figcaption>Pessoas</figcaption>
                  </figure>
                  <figure>
                    <ImagemDaPatente patente={p} url={p.imagem_equipe_url} />
                    <figcaption>Equipes</figcaption>
                  </figure>
                </div>
                <div className="stack g4" style={{ minWidth: 0 }}>
                  <div className="row g8 wrap">
                    <h3>{p.nome}</h3>
                    {atual && <Badge tone="brand">Você está aqui</Badge>}
                    {!p.ativa && <Badge tone="neu">Desativada</Badge>}
                  </div>
                  <span className="d-pontos">{p.pontos_necessarios === 0 ? "Ponto de partida de toda temporada" : `A partir de ${pontos(p.pontos_necessarios)} na temporada`}</span>
                  {p.descricao && <span className="muted small">{p.descricao}</span>}
                  {atual && lista.voce && <span className="small">Você tem {numero(lista.voce.pontos_temporada)} {lista.voce.pontos_temporada === 1 ? "ponto" : "pontos"} nesta temporada.</span>}
                </div>
                {podeEditar && (
                  <div className="d-acoes">
                    <BotoesDaPatente patente={p} />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
