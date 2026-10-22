import type { Config } from "./config";
import type { Db } from "./db/conexao";
import type { Armazenamento } from "./servicos/armazenamento";
import type { ProvedorAuth } from "./servicos/auth";
import type { ClienteClima } from "./servicos/clima";
import type { Email } from "./servicos/email";
import type { Push } from "./servicos/push";
import type { ClienteRh } from "./servicos/rh";
import type { ClienteSap } from "./servicos/sap";
import type { ProvedorIA } from "./servicos/ia";
import type { MotorOcr } from "./servicos/ocr";

/** Tudo o que as rotas e as tarefas usam do mundo de fora; os testes trocam cada item por uma versão em memória. */
export interface Deps {
  db: Db;
  config: Config;
  auth: ProvedorAuth;
  armazenamento: Armazenamento;
  email: Email;
  /** O serviço de notificação push (Expo); os testes usam o PushEmMemoria. */
  push: Push;
  sap: ClienteSap;
  /** O registro de funcionários (RH), real ou simulado. */
  rh: ClienteRh;
  /** Módulo de IA genérico (Anthropic ou Gemini, por `IA_PROVEDOR`); `ProvedorIAIndisponivel` até a chave existir (`config.ia.ligada`). */
  ia: ProvedorIA;
  /** OCR local da Digitalização (Tesseract); os testes usam o `OcrEmMemoria`. */
  ocr: MotorOcr;
  /** O provedor da previsão do tempo (Open-Meteo); os testes usam o ClimaEmMemoria. */
  clima: ClienteClima;
  /** Relógio da `api`; os testes o fixam. */
  agora: () => Date;
}
