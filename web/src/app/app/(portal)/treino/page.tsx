import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/app/AppChrome";
import { EscolhaDeModalidade } from "@/components/treino/EscolhaDeModalidade";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { usuarioAtual } from "@/lib/api";
import { dataHora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { emTreino } from "@/lib/treino-modo";

export const metadata: Metadata = { title: "Campo de treino" };

const situacao = {
  nao_iniciado: "Você ainda não fez o treinamento.",
  concluido: "Você concluiu o treinamento",
  pulado: "Você pulou o treinamento",
} as const;

/** Entrada do Campo de treino: escolha entre o passo a passo (Direcionado) e a exploração sem roteiro (Livre). Disponível sempre, para refazer a qualquer hora. */
export default async function TreinoPage() {
  const [{ usuario }, treino] = await Promise.all([usuarioAtual(), emTreino()]);
  const estado = usuario.treinamento;

  return (
    <Screen>
      <CabecalhoPagina trilha={[{ rotulo: "OS da equipe", href: rotas.app.lista }, { rotulo: "Campo de treino" }]}>
        <h1>Campo de treino</h1>
        <span className="muted">
          Aqui tudo é de mentira: ordens, equipes e APRs são fictícias, e nada do que você fizer afeta o trabalho real. Pode clicar, errar e refazer à vontade.
        </span>
      </CabecalhoPagina>
      {treino && (
        <div className="tr-aviso-pagina" role="status">
          <Icon name="info" size={16} />
          <span>
            Você já está no campo de treino. Escolha de novo para recomeçar o roteiro, ou volte ao sistema real quando quiser.
          </span>
          {/* Navegação completa: a rota apaga o cookie do treino. */}
          <a className="btn btn-line btn-sm" href={rotas.app.treinoSair}>
            Voltar ao sistema real
          </a>
        </div>
      )}
      <section className="stack g12" aria-labelledby="como-aprender">
        <h2 id="como-aprender">Como você prefere aprender?</h2>
        <EscolhaDeModalidade />
        {!treino && estado && (
          <p className="small">
            {situacao[estado.estado]}
            {estado.estado !== "nao_iniciado" && estado.em ? ` em ${dataHora(estado.em)}` : ""}
            {estado.estado === "nao_iniciado" ? "" : ". Você pode refazer quando quiser."}
          </p>
        )}
      </section>
    </Screen>
  );
}
