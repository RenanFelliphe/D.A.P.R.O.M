import type { UsuarioAutenticado } from "../http/autenticacao";
import { invalido } from "../http/erros";

/**
 * A assinatura do perfil de quem age, para gravar junto do ato (cópia: refazer a do perfil depois não muda a do ato). Quem
 * chega até aqui já passou pelo bloqueio do `autenticar`, que exige a assinatura cadastrada; o erro cobre o que escapar dele.
 */
export function assinaturaDoAto(eu: UsuarioAutenticado): string {
  if (!eu.assinaturaPath) throw invalido("assinatura_ausente", "Cadastre a sua assinatura no perfil antes de assinar");
  return eu.assinaturaPath;
}
