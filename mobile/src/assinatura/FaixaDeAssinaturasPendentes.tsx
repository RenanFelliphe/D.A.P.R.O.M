import { useRouter, type Href } from "expo-router";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { useAssinaturasPendentes } from "./consultas";

/** A tela dos atos feitos sem sinal que esperam a assinatura com validade jurídica. */
export const ROTA_DAS_ASSINATURAS_PENDENTES = "/assinaturas-pendentes" as Href;

/**
 * A faixa "N atos feitos sem sinal aguardam a assinatura com validade jurídica", com o atalho para assinar. Só aparece com o provedor
 * ligado, com sinal e quando há pendentes; é aviso de apoio, então se a consulta falha, some.
 */
export function FaixaDeAssinaturasPendentes() {
  const router = useRouter();
  const { data } = useAssinaturasPendentes();
  const quantos = data?.length ?? 0;
  if (quantos === 0) return null;
  return (
    <Aviso
      tom="al"
      icone="create-outline"
      titulo={quantos === 1 ? "1 ato feito sem sinal aguarda a assinatura com validade jurídica." : `${quantos} atos feitos sem sinal aguardam a assinatura com validade jurídica.`}
      rodape={<Botao titulo="Assinar agora" variante="secundario" bloco={false} aoPressionar={() => router.push(ROTA_DAS_ASSINATURAS_PENDENTES)} />}
    >
      Eles valeram com a assinatura do seu perfil. Assine na página do provedor para ficarem com validade jurídica.
    </Aviso>
  );
}
