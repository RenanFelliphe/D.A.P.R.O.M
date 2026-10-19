import type { Colega } from "@shared/api/apr";
import type { Usuario } from "@shared/api/tipos";
import type { ColegaDaEquipe } from "./consultas";

/** O que a APR usa de cada pessoa. */
export const comoColega = ({ id, nome, matricula, cargo, perfil, assinatura_path }: Colega): Colega => ({ id, nome, matricula, cargo, perfil, assinatura_path });

/**
 * A equipe da OS como a escolha dos participantes a mostra: quem está ausente não entra (a `api` também o recusa), e quem está
 * logado sempre participa, mesmo que a lista não o traga. A pessoa logada vem primeiro; os demais ficam na ordem da `api` (por nome).
 */
export function equipeDaApr(usuarios: ColegaDaEquipe[], eu: Usuario): Colega[] {
  const presentes = usuarios.filter((u) => !u.ausencia);
  const todos = presentes.some((u) => u.id === eu.id) ? presentes : [...presentes, eu];
  return todos.map(comoColega).sort((a, b) => Number(b.id === eu.id) - Number(a.id === eu.id));
}
