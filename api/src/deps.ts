import type { Config } from "./config";
import type { Db } from "./db/conexao";
import type { Armazenamento } from "./servicos/armazenamento";
import type { ProvedorAuth } from "./servicos/auth";
import type { Email } from "./servicos/email";
import type { ClienteRh } from "./servicos/rh";
import type { ClienteSap } from "./servicos/sap";

/** Tudo o que as rotas e as tarefas usam do mundo de fora; os testes trocam cada item por uma versão em memória. */
export interface Deps {
  db: Db;
  config: Config;
  auth: ProvedorAuth;
  armazenamento: Armazenamento;
  email: Email;
  sap: ClienteSap;
  /** O registro de funcionários (RH), real ou simulado. */
  rh: ClienteRh;
  /** Relógio da `api`; os testes o fixam. */
  agora: () => Date;
}
