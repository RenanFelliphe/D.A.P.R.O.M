import { BotoesDaConquista, NovaConquista } from "@/components/web/gamificacao/AcoesDoCadastro";
import { CartaoConquista } from "@/components/web/gamificacao/CartaoConquista";
import { Notice } from "@/components/ui/Notice";
import type { ListaDeConquistas } from "@/lib/gamificacao";

interface GaleriaConquistasProps {
  lista: ListaDeConquistas;
  /** O admin cria, edita, desativa e exclui; os demais só consultam. */
  podeEditar: boolean;
  /** O admin não joga: não tem troféus nem progresso. */
  jogador: boolean;
}

/** A galeria de conquistas, de pessoa e de equipe: as obtidas coloridas, com a data; as que faltam em cinza, com o progresso. */
export function GaleriaConquistas({ lista, podeEditar, jogador }: GaleriaConquistasProps) {
  const pessoas = lista.conquistas.filter((c) => c.tipo === "pessoa");
  const equipes = lista.conquistas.filter((c) => c.tipo === "equipe");
  const obtidas = (itens: typeof pessoas) => itens.filter((c) => c.obtida_em).length;
  const cadastro = { criterios: lista.criterios, patentes: lista.patentes };
  const acoesDe = (c: (typeof pessoas)[number]) => (podeEditar ? <BotoesDaConquista conquista={c} {...cadastro} /> : undefined);

  return (
    <div className="stack g16">
      <div className="row between wrap" style={{ alignItems: "flex-end" }}>
        <span className="muted" style={{ fontSize: 14, maxWidth: 760 }}>
          Troféus permanentes: não zeram com a temporada. A raridade é a porcentagem dos técnicos ativos (ou das equipes) que já têm cada um. Não há conquista secreta.
        </span>
        {podeEditar && <NovaConquista {...cadastro} />}
      </div>
      {!lista.pontos_ligados && (
        <Notice tone="al" icon="info">
          Os pontos das conquistas estão desligados (a tarefa “Conquista obtida” está desativada em “Como pontuar”): as conquistas continuam sendo dadas, sem pontos.
        </Notice>
      )}
      <section className="stack g8">
        <div className="row between wrap">
          <h2>Conquistas de pessoa</h2>
          {jogador && (
            <span className="muted small">
              {obtidas(pessoas)} de {pessoas.length} obtidas
            </span>
          )}
        </div>
        {pessoas.length === 0 ? (
          <div className="card muted">Nenhuma conquista de pessoa cadastrada.</div>
        ) : (
          <div className="gal-conquistas">
            {pessoas.map((c) => (
              <CartaoConquista key={c.id} conquista={c} acoes={acoesDe(c)} />
            ))}
          </div>
        )}
      </section>
      <section className="stack g8">
        <div className="row between wrap">
          <h2>Conquistas de equipe</h2>
          {jogador && lista.equipe_do_progresso && (
            <span className="muted small">
              A sua equipe: {obtidas(equipes)} de {equipes.length} obtidas
            </span>
          )}
        </div>
        <span className="muted small">Conquistas de equipe não dão pontos. O progresso e a data são os da sua equipe.</span>
        {equipes.length === 0 ? (
          <div className="card muted">Nenhuma conquista de equipe cadastrada.</div>
        ) : (
          <div className="gal-conquistas">
            {equipes.map((c) => (
              <CartaoConquista key={c.id} conquista={c} acoes={acoesDe(c)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
