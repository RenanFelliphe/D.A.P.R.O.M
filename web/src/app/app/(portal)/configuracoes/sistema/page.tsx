import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CidadePadrao } from "@/components/configuracoes/CidadePadrao";
import { ItemNumerico } from "@/components/configuracoes/ItemNumerico";
import { Notice } from "@/components/ui/Notice";
import { ControleDaIa } from "@/components/vitoria/ControleDaIa";
import { veConfiguracoesDoSistema } from "@/components/web/configuracoes/secao";
import { apiOuNulo, usuarioAtual } from "@/lib/api";
import type { ConfiguracoesDoSistema } from "@/lib/configuracoes";
import type { PainelDaIa } from "@/lib/vitoria-ia";

export const metadata: Metadata = { title: "Configurações do sistema" };

/**
 * Sistema, só do admin (os demais veem 404): a cidade padrão da previsão do tempo, os horários das rotinas (leitura do SAP e do registro
 * de funcionários, resumo de e-mail) e a IA (o controle de cada função, que saiu da página da Vitória, e os limites de uso). Cada valor
 * numérico salva sozinho e vale na hora; endereços, chaves e tokens dos outros sistemas ficam no ambiente, fora desta tela.
 */
export default async function ConfiguracoesSistemaPage() {
  const { usuario } = await usuarioAtual();
  if (!veConfiguracoesDoSistema(usuario)) notFound();
  const [config, painelDaIa] = await Promise.all([apiOuNulo<ConfiguracoesDoSistema>("/configuracoes/sistema"), apiOuNulo<PainelDaIa>("/vitoria/ia").catch(() => null)]);
  if (!config) {
    return (
      <Notice tone="al" icon="alert">
        Não foi possível ler as configurações do sistema agora. Tente de novo em instantes.
      </Notice>
    );
  }
  const rotinas = config.itens.filter((i) => i.grupo === "rotinas");
  const limitesDaIa = config.itens.filter((i) => i.grupo === "ia");

  return (
    <div className="stack g16">
      <CidadePadrao cidade={config.cidade_padrao} />

      <section className="panel cfg-bloco" aria-labelledby="cfg-rotinas" data-treino="cfg-rotinas">
        <header>
          <h2 id="cfg-rotinas">Rotinas</h2>
          <p>Quando o sistema lê o SAP e o registro de funcionários e envia o resumo diário por e-mail. A mudança vale na próxima rodada, sem reiniciar.</p>
        </header>
        {rotinas.map((item) => (
          <ItemNumerico key={item.chave} item={item} />
        ))}
      </section>

      <div id="controle-da-ia" className="stack g16">
        {painelDaIa && <ControleDaIa painel={painelDaIa} />}
        <section className="panel cfg-bloco" aria-labelledby="cfg-limites-ia" data-treino="cfg-limites-ia">
          <header>
            <h2 id="cfg-limites-ia">Limites de uso da IA</h2>
            <p>Quanto a Vitória e o rascunho de treinamento podem usar a IA. Ao atingir um limite, a função volta ao manual (a Vitória) ou pede para fazer à mão (o treinamento).</p>
          </header>
          {limitesDaIa.map((item) => (
            <ItemNumerico key={item.chave} item={item} />
          ))}
        </section>
      </div>
    </div>
  );
}
