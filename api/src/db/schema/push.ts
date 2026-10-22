import { check, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { PLATAFORMAS_DE_PUSH } from "../../../../shared/notificacoes/push";
import { emLista, instante } from "./comum";
import { usuario } from "./usuarios";

/**
 * Um aparelho que recebe notificação push (`docs/pessoas-e-equipes.md`, seção 8.6). O token é o do serviço de push da Expo e é do
 * aparelho, não da pessoa: quem entra num aparelho que era de outra pessoa o toma para si (o token é único), e quem sai o devolve.
 * O token que o serviço diz não existir mais (`DeviceNotRegistered`) é apagado na hora.
 */
export const dispositivoPush = pgTable(
  "dispositivo_push",
  {
    id: uuid().primaryKey().defaultRandom(),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    token: text().notNull(),
    plataforma: text({ enum: PLATAFORMAS_DE_PUSH }).notNull(),
    registradoEm: instante().notNull().defaultNow(),
    /** O app confirma o token a cada abertura: o que não é confirmado há meses é de um aparelho que deixou de ser usado. */
    confirmadoEm: instante().notNull().defaultNow(),
  },
  (t) => [
    check("dispositivo_push_plataforma_check", emLista(t.plataforma, PLATAFORMAS_DE_PUSH)),
    uniqueIndex("dispositivo_push_token_key").on(t.token),
    index("dispositivo_push_usuario_idx").on(t.usuarioId),
  ],
).enableRLS();
