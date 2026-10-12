/**
 * Estado do Campo de treino, em memória do servidor e por usuário. Nada vai ao banco: reiniciar o servidor também
 * recomeça o treino. O estado fica em `globalThis` para sobreviver ao recarregamento de módulos do `next dev` (HMR).
 */
import type { Usuario } from "../lib/tipos";
import { criarEstadoInicial, diaDe, type EstadoTreino } from "./dados";

const LIMITE_DE_USUARIOS = 500;

const globais = globalThis as unknown as { __treinoArmazem?: Map<string, EstadoTreino> };
const armazem = (globais.__treinoArmazem ??= new Map<string, EstadoTreino>());

/**
 * Estado do técnico `usuario`, criado na primeira vez. Se a massa é de outro dia (as OS "de hoje" ficariam velhas), ela é
 * refeita. O nome e os dados pessoais do técnico são atualizados a cada chamada, com o que a `api` real informou.
 */
export function obterEstado(usuario: Usuario, agora: Date = new Date()): EstadoTreino {
  let estado = armazem.get(usuario.id);
  if (!estado || estado.dia !== diaDe(agora)) {
    if (armazem.size >= LIMITE_DE_USUARIOS) armazem.delete(armazem.keys().next().value!);
    estado = criarEstadoInicial(usuario, agora);
    armazem.set(usuario.id, estado);
  }
  const eu = estado.usuarios.find((u) => u.id === usuario.id);
  if (eu) {
    eu.nome = usuario.nome;
    eu.matricula = usuario.matricula;
    eu.email = usuario.email;
    eu.cargo = usuario.cargo ?? eu.cargo;
    eu.registro_profissional = usuario.registro_profissional;
  }
  return estado;
}

/** Descarta tudo o que o técnico fez no treino: a próxima chamada refaz a massa inicial. */
export function reiniciarTreino(usuarioId: string): void {
  armazem.delete(usuarioId);
}

/** Só para os testes: quantos técnicos têm treino em andamento. */
export const totalDeTreinosAtivos = () => armazem.size;
