import { CaixaDeAssinatura } from "./CaixaDeAssinatura";
import { useSalvarAssinatura } from "./salvar";

/**
 * Desenhar e gravar a assinatura do perfil. Usado no primeiro acesso, no "Refazer" do perfil e nas janelas de ação quando a pessoa ainda
 * não tem assinatura. `aoSalvar` roda depois de a `api` aceitar a imagem.
 */
export function CadastrarAssinatura({ rotuloSalvar = "Salvar assinatura", aoSalvar }: { rotuloSalvar?: string; aoSalvar?: () => void }) {
  const salvar = useSalvarAssinatura();
  return (
    <CaixaDeAssinatura
      rotuloSalvar={rotuloSalvar}
      aoSalvar={async (png) => {
        await salvar(png);
        aoSalvar?.();
      }}
    />
  );
}
