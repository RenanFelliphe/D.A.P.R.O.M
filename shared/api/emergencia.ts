/**
 * O botão de emergência (`docs/operacao-de-campo.md`, seção 5.9): durante a execução, quem o aciona avisa na hora o supervisor da equipe e os
 * administradores, com o nome, a OS e a posição, e vê os contatos do PAE para ligar. O aviso é obrigatório (sino, push e e-mail) e o aparelho
 * sem sinal guarda o acionamento na fila de campo e o envia quando o sinal volta; a ligação não depende de sinal de dados.
 *
 * Os contatos do PAE (Plano de Atendimento a Emergências) são do sistema todo e o administrador os cadastra em Configurações. Os números
 * públicos abaixo valem em qualquer lugar do país e aparecem sempre.
 */

/** Um contato para ligar. */
export interface ContatoDeEmergencia {
  nome: string;
  /** Como a pessoa digitaria: `(27) 99999-0000`, `192`, `0800 000 0000`. Para ligar, `telefoneParaLigar`. */
  telefone: string;
  /** O que o contato atende ("Brigada da unidade", "Segurança do Trabalho"). */
  descricao: string | null;
}

/** `GET /emergencia/contatos`: os do PAE (cadastrados pelo admin; vazio até ele cadastrar) e os números públicos. */
export interface ContatosDeEmergencia {
  pae: ContatoDeEmergencia[];
  publicos: ContatoDeEmergencia[];
}

/** SAMU e Bombeiros: números públicos nacionais, sempre à mão (os do PAE da empresa vêm de Configurações). */
export const CONTATOS_PUBLICOS: ContatoDeEmergencia[] = [
  { nome: "SAMU", telefone: "192", descricao: "Urgência médica" },
  { nome: "Bombeiros", telefone: "193", descricao: "Incêndio, vazamento de gás, resgate" },
];

/** Quantos contatos do PAE o sistema guarda. */
export const MAX_CONTATOS_DO_PAE = 10;

/** A observação que quem aciona pode deixar ("vazamento na rua, pessoa ferida"). */
export const LIMITE_DA_OBSERVACAO_DA_EMERGENCIA = 300;

/** O número como o aparelho liga (`tel:`): só dígitos e o `+` inicial. */
export const telefoneParaLigar = (telefone: string): string => {
  const limpo = telefone.replace(/[^\d+]/g, "");
  return limpo.startsWith("+") ? `+${limpo.slice(1).replace(/\+/g, "")}` : limpo.replace(/\+/g, "");
};

/** Um telefone que dá para ligar: de 3 a 15 dígitos (o 192 tem 3, o internacional, até 15). */
export const telefoneValido = (telefone: string): boolean => {
  const digitos = telefoneParaLigar(telefone).replace("+", "");
  return /^[\d\s()+\-.]+$/.test(telefone) && digitos.length >= 3 && digitos.length <= 15;
};

/** O endereço do mapa para a posição de quem acionou (o supervisor abre e vê onde está). */
export const enderecoDoMapa = (latitude: number, longitude: number): string => `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;

/** Uma emergência da OS (`GET /os/{id}/emergencias`). */
export interface EmergenciaDaOs {
  id: string;
  os_id: string;
  acionada_por: { id: string; nome: string; matricula: string };
  acionada_em: string;
  /** Quando a `api` recebeu: mais tarde que `acionada_em` quando o aparelho estava sem sinal. */
  recebida_em: string;
  latitude: number | null;
  longitude: number | null;
  observacao: string | null;
  atendida_em: string | null;
  atendida_por: { id: string; nome: string } | null;
  nota_do_atendimento: string | null;
}
