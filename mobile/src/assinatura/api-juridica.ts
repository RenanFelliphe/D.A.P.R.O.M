import type { AssinaturaJuridica, AssinaturaJuridicaDaOs, NovaAssinaturaJuridica } from "@shared/api/assinatura-juridica";
import { cliente } from "@/api/api";

/** As chamadas da assinatura com validade jurídica (`shared/api/assinatura-juridica.ts`). Todas pedem sinal: o provedor está na internet. */

/** `POST /assinaturas-juridicas`: cria o documento no provedor e devolve a página em que a pessoa assina (`url_assinatura`). */
export const criarAssinaturaJuridica = (nova: NovaAssinaturaJuridica) => cliente.chamar<AssinaturaJuridica>("/assinaturas-juridicas", { corpo: nova });

/** `GET /assinaturas-juridicas/{id}`: a `api` reconsulta o provedor antes de responder. */
export const consultarAssinaturaJuridica = (id: string) => cliente.chamar<AssinaturaJuridica>(`/assinaturas-juridicas/${id}`);

/** `POST /assinaturas-juridicas/{id}/enviar`: o ato feito sem sinal vai ao provedor agora (`pendente_offline` vira `aguardando`). */
export const enviarAssinaturaPendente = (id: string) => cliente.chamar<AssinaturaJuridica>(`/assinaturas-juridicas/${id}/enviar`, { metodo: "POST", corpo: {} });

const listar = async (situacao: AssinaturaJuridica["situacao"]) =>
  (await cliente.chamar<{ assinaturas: AssinaturaJuridica[] }>("/assinaturas-juridicas", { consulta: { situacao } })).assinaturas;

/**
 * Os atos que a pessoa fez sem sinal e ainda não assinou com validade jurídica: os `pendente_offline` e os que já foram ao provedor
 * (`aguardando`) mas ela deixou a página sem assinar. Os `aguardando` de atos feitos com sinal não entram (a janela da ação os cuida).
 */
export async function listarAssinaturasPendentes(): Promise<AssinaturaJuridica[]> {
  const [semEnvio, aguardando] = await Promise.all([listar("pendente_offline"), listar("aguardando").catch(() => [] as AssinaturaJuridica[])]);
  return [...semEnvio, ...aguardando.filter((a) => a.origem_offline && !semEnvio.some((s) => s.id === a.id))];
}

/** O endereço (de vida curta) do PDF assinado. */
export async function urlDoPdfAssinado(id: string): Promise<string> {
  return (await cliente.chamar<{ url: string }>(`/assinaturas-juridicas/${id}/pdf`)).url;
}

/** As assinaturas ligadas a uma OS, para o supervisor e o admin conferirem. */
export async function listarAssinaturasDaOs(osId: string): Promise<AssinaturaJuridicaDaOs[]> {
  return (await cliente.chamar<{ assinaturas: AssinaturaJuridicaDaOs[] }>(`/os/${osId}/assinaturas-juridicas`)).assinaturas;
}
