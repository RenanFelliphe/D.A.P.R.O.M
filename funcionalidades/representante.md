# Representante da equipe — decisões e implementação de 16/10/2026

> Quem responde pela equipe quando o supervisor se ausenta. Toda equipe tem um **representante**, um membro dela, que assume a supervisão quando o supervisor registra uma ausência ou passa 3 dias sem usar o sistema, e a devolve quando ele volta.
>
> **Situação:** implementado em 16/10/2026 na `api` e na `web`. Resolve a questão 67 do [Questoes.md](Questoes.md) e a seção 9 do [ausencia.md](ausencia.md).
>
> Fontes: a conversa de 16/10/2026, com o que o Iago explicou (o supervisor que se ausenta designa um responsável para assinar e encerrar as ordens por ele); o [ausencia.md](ausencia.md); o código em [`representacao.ts`](api/src/dominio/representacao.ts), [`autenticacao.ts`](api/src/http/autenticacao.ts) e [`equipes.ts`](api/src/rotas/equipes.ts).

## Resumo

- **Todo supervisor tem um substituto já definido.** Como o supervisor pode sumir de repente, sem tempo de designar ninguém, a equipe nunca fica sem representante: o sistema escolhe o técnico mais antigo da equipe, até o supervisor ou o admin designar outro.
- **O representante é um membro da equipe.** Não dá para designar alguém de fora do sistema, então é um técnico ativo e liberado da própria equipe, que não é o supervisor.
- **Ele assume sozinho, por dois motivos:**
  - **Manual:** o supervisor registra a própria ausência (em curso ou vencida).
  - **Automático:** o supervisor passa 3 dias sem usar o sistema.
- **Enquanto assume, faz o que o supervisor faz pela equipe:** aprova e registra ausências, reserva e devolve OS, dá ciência, cuida dos alertas e do cadastro de técnicos. Tudo com a própria assinatura.
- **A supervisão volta sozinha.** No instante em que o supervisor confirma o retorno, encerra a ausência ou volta a usar o sistema.

## 1. Quando o representante assume

| Motivo | Quando começa | Quando termina |
|---|---|---|
| `ausencia` | a ausência confirmada do supervisor já começou (do início, 0h em São Paulo) | o supervisor encerra a ausência ou confirma o retorno. A ausência **vencida** também conta: ela só termina quando ele confirma |
| `inatividade` | passaram 3 dias corridos (72 h) desde a última atividade do supervisor | o supervisor usa o sistema de novo |

- **Atividade é qualquer acesso do supervisor ao sistema** (qualquer chamada autenticada), anotada no máximo a cada 5 minutos em `usuario.ultima_atividade_em`.
- **A ausência agendada** (início no futuro) não põe o representante no comando antes do dia.
- **Se o supervisor volta só para registrar a ausência,** o primeiro acesso dele já devolve a equipe, e a ausência a entrega de novo (o representante recebe os dois avisos).
- **A regra vale na hora, pela data:** a permissão do representante é calculada a cada chamada. Os avisos e o registro de "desde quando" são gravados na hora quando a ausência do supervisor muda ou ele volta, e pela tarefa de hora em hora nos demais casos (início de uma ausência agendada, 3 dias parado).

## 2. Quem é o representante

- **Elegível:** técnico, ativo, liberado, da própria equipe e que não é o supervisor.
- **Escolha automática:** o técnico mais antigo (conta sem data de cadastro primeiro, depois pelo nome). Ela roda quando se cadastra ou libera alguém, quando se muda um usuário (equipe, perfil, ativo), quando o registro de funcionários desliga alguém, quando se troca o supervisor da equipe e a cada hora. A migração `0026` já preenche as equipes existentes.
- **Quando o representante deixa de servir** (desativado, mudou de equipe, virou o supervisor), a equipe ganha outro automaticamente. Se ele estava no comando, o novo é avisado.
- **Quem designa:** o supervisor da equipe (que não esteja ausente) e o admin, por `PUT /equipes/{id}/representante`. O representante no comando não troca o próprio representante.
- **Equipe sem técnico elegível:** fica sem representante, e nada assume. É o caso da equipe só com o supervisor.

## 3. O que o representante pode e não pode

**Pode,** pelas regras de supervisão da equipe (`UsuarioAutenticado.equipesSupervisionadas` inclui as equipes que ele representa):

- aprovar, recusar, prorrogar e encerrar as ausências dos membros, assinando;
- registrar a ausência de um membro;
- reservar e devolver OS, dar ciência, decidir sobre impedimentos e alertas;
- cadastrar técnicos da equipe e ver o painel dela.

**Não pode:**

- **registrar a própria ausência como supervisor.** O pedido dele segue o fluxo de qualquer técnico e espera o supervisor voltar (ninguém responde ao próprio pedido: `403`);
- **mexer na ausência do supervisor** (prorrogar, encerrar) nem registrá-la por ele: só o próprio supervisor;
- **designar o próprio representante** nem trocar o supervisor;
- se o representante também estiver ausente, ele só visualiza, como qualquer ausente.

## 4. Avisos (sino)

| Alerta | Para quem | Quando |
|---|---|---|
| `representacao_iniciada` | o representante e o supervisor | o representante assume a equipe, com o motivo |
| `representacao_encerrada` | o representante e o supervisor | a supervisão volta ao supervisor |

- Os alertas da equipe (impedimento, conflito de planejamento, pedido de ausência etc.) passam a ir **também ao representante** enquanto ele está no comando.
- A passagem de comando fica na trilha de auditoria (`equipe.representacao_iniciada`, `equipe.representacao_encerrada`, feitas pelo "Sistema") e a designação, em `equipe.designar_representante`.

## 5. O que muda no código

### 5.1 Banco (migração `0026_representante_da_equipe`)

- **`equipe`:** `representante_id`, `representacao_desde` e `representacao_motivo` (`ausencia` ou `inatividade`). `CHECK`s: desde e motivo vêm juntos, e o representante não é o supervisor.
- **`usuario.ultima_atividade_em`:** a última vez que a pessoa usou o sistema (por padrão, o cadastro).
- **`alerta.equipe_id`** e os dois tipos novos de alerta, com o `CHECK` `alerta_alvo` aceitando o alerta de representação (aponta para a equipe, sem OS).
- A migração preenche o representante de cada equipe existente.

### 5.2 API

- **Regra:** [`api/src/dominio/representacao.ts`](api/src/dominio/representacao.ts) — `representacoesEmVigor`, `sincronizarRepresentacao` (grava e avisa, uma vez só), `garantirRepresentantes` e `motivoDeNaoPoderRepresentar`.
- **Permissões:** `autenticar()` soma as equipes representadas a `equipesSupervisionadas` e as lista também em `equipesRepresentadas`. `ehSupervisorTitular` separa o supervisor de verdade, que é o único a registrar a própria ausência.
- **Rotas:** `PUT /equipes/{id}/representante` `{usuario_id}`; `GET /equipes/{id}` traz `representante` e `representacao`; `GET /me` traz `equipes_representadas`; `equipe_para_api` traz `representante_id` e `representacao`.
- **Ausências:** depois de qualquer ato que deu certo, a representação é conferida na hora.
- **Tarefa de hora em hora:** `garantirRepresentantes` e `sincronizarRepresentacao`, depois da conferência das ausências.
- **Testes:** [`api/test/representante.test.ts`](api/test/representante.test.ts) (24 casos): a escolha, a designação, os dois motivos, os limites e os avisos.

### 5.3 Web

- **Faixa** "Você responde pela equipe X" na casca, para o representante no comando.
- **Perfil da equipe:** o cartão "Representante" (quem é, desde quando assumiu e por quê), com a escolha de outro representante para o supervisor e o admin, e o selo "Representante" na lista de membros.
- **Sino e alertas:** os dois avisos novos, com o detalhe `DetalheRepresentacao`, que leva à equipe.
- **Campo de treino:** sem mudança.

## 6. O que ficou de fora e pontos em aberto

- **Equipe sem supervisor:** resolvida em 17/10/2026 ([avisos-e-emails.md](avisos-e-emails.md), seção 5.4). Sem supervisor, ou com o dele desativado, o representante assume pelo motivo `sem_supervisor` até o admin escolher um, e os administradores recebem o aviso `equipe_sem_supervisor`. O pedido de ausência vai para ele; o dele mesmo fica recusado (`equipe_sem_supervisor`), porque ninguém responde ao próprio pedido.
- **Representante também ausente:** ninguém responde pela equipe até um dos dois voltar. O admin continua só consultando. Se o piloto mostrar o problema, vale um segundo representante.
- **Os 3 dias:** contados em dias corridos, sem descontar fim de semana ou feriado. Para o Iago confirmar se bastam, porque um feriado emendado (4 dias) faria o representante assumir sem ter havido ausência de fato. A constante é `DIAS_SEM_ATIVIDADE`.
- **E-mail:** desde 17/10/2026 os avisos da representação também vão por e-mail, na categoria "Equipe" ([avisos-e-emails.md](avisos-e-emails.md)).
- **O app,** quando existir: a faixa e o cartão do representante.
