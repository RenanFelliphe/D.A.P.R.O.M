# Usuário ausente — plano e implementação de 15/10/2026

> Plano para o estado "ausente" do usuário: ele continua ativo e pode ver o sistema, mas não altera nada, não recebe reserva de OS e não entra em APR. A ausência é pedida pelo funcionário ou registrada pelo supervisor, sempre assinada, e termina com a confirmação do retorno.
>
> **Situação:** implementado em 15/10/2026 na `api` e na `web`, menos o que espera a questão 67 (seção 9). O que mudou em relação ao plano está na seção 13. Antes dele, o mais próximo era desativar a conta, que tira o acesso, e a situação "afastado" do registro de funcionários, que só é gravada.
>
> Fontes: as conversas de 15/10/2026; a seção 3.3 do [funcionalidades.md](funcionalidades.md); a atribuição individual (seção 6 do funcionalidades.md); o código em [`autenticacao.ts`](api/src/http/autenticacao.ts), [`atribuicao-os.ts`](api/src/dominio/atribuicao-os.ts), [`eventos-execucao.ts`](api/src/dominio/eventos-execucao.ts) e [`alertas.ts`](api/src/dominio/alertas.ts).

## Resumo

- **Só o supervisor da equipe registra a ausência.** O funcionário pede pelo botão "Pedir ausência"; o supervisor aprova, ajusta ou recusa.
- **Tudo é assinado** com a assinatura do perfil: a aprovação, o ajuste, a recusa, a confirmação do funcionário, o cancelamento, o pedido e a aprovação do fim antecipado, a prorrogação, o encerramento e o retorno. Só o pedido inicial não é, porque o funcionário assina ao confirmar.
- **O período pode ser futuro** e é informado em dias corridos ou pela data de retorno.
- **O ausente só visualiza.** Não altera nada, não recebe reserva de OS e não entra em APR.
- **A ausência não termina sozinha.** Passada a data de retorno, ela fica "vencida" para o supervisor até o funcionário confirmar o retorno, com a assinatura, ou o supervisor a encerrar.
- **O supervisor registra a própria ausência** e pode encerrá-la a qualquer momento, em caso de emergência.
- **Avisos só pelo sino,** inclusive para o técnico, que hoje não tem sino. O e-mail fica para a curadoria do SMTP.
- **Em aberto, e fora desta etapa:** quem responde pela equipe enquanto o supervisor está ausente, e quem aprova o pedido de quem está numa equipe sem supervisor (questão 67, ao Iago).

---

## 1. Por que existe

- **Nenhuma OS fica presa.** Sem o estado, se o responsável de uma OS reservada estiver fora, ela espera por ele. Com a ausência, a reserva cai e a OS volta para a equipe toda.
- **O quadro reflete quem está disponível.** O supervisor vê quem está ausente, até quando, e quem deveria ter voltado.
- **O registro fica formal.** O pedido, a aprovação e o retorno ficam assinados e na auditoria.

## 2. Quem faz o quê

| Ação | Quem | Assina |
|---|---|---|
| Pedir ausência | o próprio técnico | não; a assinatura vem na confirmação |
| Aprovar o pedido, com ou sem ajuste das datas | o supervisor da equipe | sim |
| Recusar o pedido, com motivo | o supervisor da equipe | sim |
| Confirmar a ausência aprovada | o técnico | sim |
| Recusar o ajuste do supervisor | o técnico | sim |
| Cancelar o pedido ainda não aprovado | o técnico | sim |
| Registrar a ausência de alguém, sem pedido | o supervisor da equipe | sim; vale só com a assinatura dele |
| Registrar a própria ausência | o supervisor | sim; vale na hora |
| Pedir o fim antecipado | o ausente | sim |
| Aprovar ou recusar o fim antecipado | o supervisor da equipe | sim |
| Prorrogar a ausência, inclusive a vencida | o supervisor da equipe | sim |
| Encerrar a ausência a qualquer momento | o supervisor da equipe | sim |
| Encerrar a própria ausência, em emergência | o supervisor ausente | sim |
| Confirmar o retorno, depois da data | o ausente | sim |

- **O admin não pede, não registra e não aprova ausência,** porque não executa OS. Ele só consulta, na auditoria e no perfil.
- **Sem assinatura cadastrada no perfil,** a ação pede o cadastro antes, como já acontece na APR.
- **O supervisor ausente não age pela equipe.** Os pedidos e os pedidos de fim antecipado dos membros esperam ele voltar (seção 9).

## 3. O período

- **Início:** uma data, hoje ou no futuro. A ausência começa à 0h desse dia (fuso de São Paulo, o mesmo da `api`).
- **Fim:** o funcionário informa **um dos dois**, dias corridos ou a data de retorno, e o sistema calcula o outro. Os dois formatos dizem a mesma coisa:
  - "14 dias" a partir de 20/10 é a ausência de 20/10 a 02/11, com retorno em 03/11;
  - a data de retorno é o primeiro dia de volta ao trabalho.
- **Motivo:** texto livre, obrigatório, de até 500 caracteres (férias, atestado, viagem, treinamento etc.).
- **Uma ausência por vez.** O pedido ou o registro que se sobrepõe a uma ausência pedida, aprovada ou em curso da mesma pessoa é recusado (`ausencia_sobreposta`).
- **Limite:** até 365 dias por ausência; a prorrogação pode passar disso.

## 4. Os estados

| Estado | O que é | Quem age |
|---|---|---|
| Pedida | o técnico pediu; aguarda o supervisor | o supervisor aprova, ajusta ou recusa; o técnico pode cancelar |
| Aguardando confirmação | o supervisor aprovou e assinou, talvez com as datas ajustadas | o técnico confirma, assinando, ou recusa |
| Agendada | confirmada, com início no futuro | o supervisor encerra ou prorroga; o funcionário trabalha normalmente até o início |
| Em curso | entre o início e a data de retorno | o ausente pede o fim antecipado; o supervisor encerra ou prorroga |
| Vencida | a data de retorno chegou, e ninguém a encerrou | o ausente confirma o retorno; o supervisor encerra ou prorroga |
| Encerrada | terminou, pelo retorno, pelo fim antecipado ou pelo supervisor | — |
| Recusada | o supervisor recusou o pedido, ou o técnico recusou o ajuste | — |
| Cancelada | o técnico cancelou o pedido, ou a data de retorno passou sem que o pedido fosse concluído | — |

- **Agendada, em curso e vencida não são gravadas.** Elas saem das datas: a ausência confirmada é "agendada" antes do início, "em curso" até a véspera do retorno e "vencida" a partir do retorno.
- **A ausência registrada pelo supervisor** pula os dois primeiros estados e já nasce confirmada.
- **Pedido parado.** O pedido "pedido" ou "aguardando confirmação" cuja data de retorno chega é cancelado pelo sistema, com o aviso às duas pessoas.

## 5. Durante a ausência

### 5.1 O que o ausente pode fazer

- **Entrar e ver tudo** o que já via: quadro, detalhe das OS, dashboards, gamificação e perfil. Uma faixa no topo diz "Você está ausente até DD/MM", com o botão "Pedir fim antecipado".
- **Pode, além de ver:**
  - sair e trocar a senha;
  - marcar alertas e avisos como lidos;
  - pedir o fim antecipado e confirmar o retorno;
  - o supervisor ausente, encerrar a própria ausência;
  - enviar a fila offline do que foi feito **antes** do início da ausência, como já acontece com a conta desativada.
- **Não pode, e a `api` recusa com `403 usuario_ausente`:** qualquer outra alteração, inclusive APR, execução, Campo de treino, assinatura do perfil, ciência, reserva, devolução, importação e cadastros.
- **O ausente não pede nova ausência** enquanto a atual não termina; para estender, ele pede ao supervisor, que prorroga.

### 5.2 O que muda para os outros

- **Reserva de OS.** No início da ausência, toda OS reservada ao ausente volta para a equipe toda, com a linha "Reserva desfeita: ausência de <nome>" na linha do tempo. O ausente não aparece para ser escolhido como responsável (`responsavel_ausente`).
- **APR.** O ausente não aparece na lista de participantes e é recusado se vier (`participante_ausente`).
- **Execução em andamento.** Só quem iniciou a execução pode alterá-la (`execucao_de_outro`). Por isso, no início da ausência, a execução aberta do ausente (em andamento ou em pausa) é **suspensa pelo sistema**, como no fim do expediente: a OS fica pendente e a equipe a retoma com uma APR nova. O supervisor já é avisado na aprovação ou no registro, se a pessoa estiver com uma execução aberta.
- **Listas.** O ausente aparece com o selo "Ausente até DD/MM" na equipe, na tela de usuários e nas listas de pessoas. A vencida aparece como "Ausência vencida desde DD/MM".
- **Gamificação.** Nada muda: o ausente continua no ranking e na média da equipe.
- **Registro de funcionários.** A situação "afastado" continua separada, sem efeito na ausência, e vice-versa.

## 6. O fim

- **Antes da data de retorno,** só o supervisor encerra. O ausente pode pedir o fim antecipado, informando a data e assinando. O supervisor aprova ou recusa, assinando.
- **Na data de retorno,** a ausência não termina sozinha, porque algo pode ter estendido o afastamento. Ela passa a "vencida":
  - o supervisor vê o selo "Ausência vencida" e recebe o alerta `ausencia_vencida` no sino;
  - o funcionário continua só visualizando.
- **Retorno.** No primeiro acesso depois da data de retorno (login ou só abrir o sistema), o ausente vê a tela "Sua ausência terminou em DD/MM. Confirmar retorno", com a assinatura. Confirmado, a conta volta ao normal na hora.
- **Prorrogação.** O supervisor muda a data de retorno, em curso ou vencida, e assina. O ausente recebe o aviso.
- **Encerramento pelo supervisor.** Vale a qualquer momento, com assinatura, e termina a ausência na hora.

## 7. Avisos (sino)

| Alerta | Para quem | Quando |
|---|---|---|
| `ausencia_pedida` | supervisor da equipe | o técnico pede a ausência |
| `ausencia_aprovada` | técnico | o supervisor aprova; pede a confirmação dele |
| `ausencia_recusada` | técnico ou supervisor | o supervisor recusa o pedido, ou o técnico recusa o ajuste |
| `ausencia_registrada` | técnico | o supervisor registra a ausência dele, sem pedido |
| `ausencia_fim_pedido` | supervisor da equipe | o ausente pede o fim antecipado |
| `ausencia_fim_respondido` | ausente | o supervisor aprova ou recusa o fim antecipado |
| `ausencia_alterada` | ausente | o supervisor prorroga ou encerra |
| `ausencia_vencida` | supervisor da equipe | a data de retorno chega sem retorno confirmado |
| `ausencia_cancelada` | técnico e supervisor | o sistema cancela o pedido parado |

- **O técnico ganha o sino.** Hoje `GET /alertas` e `PATCH /alertas/{id}` são só do supervisor e do admin. Eles passam a atender o técnico, que vê só os alertas endereçados a ele. A tela de alertas da gestão (`/web/alertas`) continua só da gestão.
- **Sem e-mail.** O envio fica para a curadoria do que vai por e-mail, quando o SMTP funcionar.

## 8. O que muda no código

### 8.1 Banco

Uma migração nova:

- **`ausencia`:** `id`, `usuario_id`, `equipe_id` (a da pessoa na hora), `supervisor_id` (quem aprovou ou registrou), `motivo`, `inicio`, `retorno`, `dias_informados` (nulo quando veio a data), `estado` (`pedida`, `aguardando_confirmacao`, `confirmada`, `encerrada`, `recusada`, `cancelada`), `origem` (`pedido`, `supervisor`, `propria`), `encerrada_em`, `encerrada_por` e `forma_encerramento` (`retorno`, `antecipada`, `supervisor`, `emergencia`), `inicio_aplicado_em`, `vencida_avisada_em`, `criada_em`.
- **`ausencia_ato`:** a linha do tempo da ausência, uma linha por ato (pedido, ajuste, aprovação, confirmação, recusa, cancelamento, pedido de fim antecipado e resposta, prorrogação, encerramento, retorno), com quem, quando, a imagem da assinatura usada (como `execucao_assinatura`) e os dados do ato (datas antigas e novas, motivo).
- **`CHECK`s:** `retorno > inicio`, motivo preenchido e o estado coerente com os campos de encerramento.
- **Índice parcial** das ausências confirmadas e não encerradas, por usuário.
- **Os 9 alertas novos** no `CHECK` de `alerta.tipo`. O alerta ganha `usuario_alvo_id` (a pessoa da ausência) e `ausencia_id`.

### 8.2 API

- **Rotas:**
  - `POST /ausencias` (pedir; o supervisor registra com `usuario_id`), `GET /ausencias` (as minhas e as da minha equipe) e `GET /ausencias/{id}`;
  - `POST /ausencias/{id}/aprovar` (com datas ajustadas, opcional), `/recusar`, `/confirmar`, `/recusar-ajuste`, `/cancelar`;
  - `POST /ausencias/{id}/pedir-fim`, `/responder-fim`, `/prorrogar`, `/encerrar`, `/confirmar-retorno`.
- **Bloqueio do ausente:** em [`autenticacao.ts`](api/src/http/autenticacao.ts), o usuário carrega a ausência em curso ou vencida; toda rota que altera, menos a lista da seção 5.1, recusa com `403 usuario_ausente`. As rotas permitidas declaram `permitirAusente`, como já fazem `permitirPendente` e `permitirDesativado`.
- **Fila offline:** o evento com `ocorrido_em` anterior ao início da ausência é aceito; o posterior é recusado.
- **Reserva e APR:** `responsavel_ausente` em `PUT /os/{id}/responsavel` e `participante_ausente` na APR, em [`atribuicao-os.ts`](api/src/dominio/atribuicao-os.ts) e na conferência dos participantes.
- **Tarefa periódica** no executor de tarefas ([`tarefas.ts`](api/src/servicos/tarefas.ts)), de hora em hora e na subida:
  - aplica o início das ausências que começaram (desfaz as reservas e suspende a execução aberta) e marca `inicio_aplicado_em`;
  - avisa as que venceram (`ausencia_vencida`) e marca `vencida_avisada_em`;
  - cancela os pedidos parados.

  Ela é idempotente, para a subida e a rodada não repetirem nada.
- **Dados que passam a trazer a ausência:** `GET /me` (para a faixa e a tela de retorno), `GET /usuarios`, `GET /equipes/{id}` e a lista de participantes possíveis.
- **`POST /sync/pull`:** o snapshot traz a ausência do usuário e dos colegas, para o app quando existir.
- **Alertas:** o técnico passa a ler e marcar os próprios alertas.
- **Auditoria:** cada ato vira `ausencia.<ato>`, com o resumo.
- **Testes:** os estados, as assinaturas, a sobreposição, o bloqueio do ausente e as exceções, a fila offline, a reserva, a APR, a suspensão automática, a vencida, o retorno e a tarefa periódica.

### 8.3 Web

- **Perfil:** o botão "Pedir ausência", o formulário (motivo, início e dias ou data de retorno), a lista das minhas ausências e o pedido de fim antecipado.
- **Supervisor:** na tela da equipe (`/app/equipes/{id}`), a seção "Ausências", com os pedidos a responder, as agendadas, as em curso e as vencidas, e o botão "Registrar ausência" em cada membro. A própria ausência também é registrada por ali.
- **Assinatura:** as ações assinadas reaproveitam a confirmação da assinatura do perfil da APR.
- **Faixa e tela de retorno** na casca do portal, para o ausente.
- **Sino do técnico** na barra.
- **Selos** "Ausente até DD/MM" e "Ausência vencida" nas listas de pessoas.
- **APR e reserva:** o ausente some da escolha de participantes e de responsável.
- **Botões de ação** ficam desabilitados para o ausente, com o motivo, em vez de só receber o `403`.

### 8.4 Campo de treino

- Sem mudança: o Campo de treino é de quem está começando, e o ausente não o usa.

### 8.5 Carga de demonstração

- Uma ausência em curso, uma agendada, uma vencida e um pedido aguardando o supervisor.

## 9. Pendente: o supervisor ausente e a equipe sem supervisor

**Não entra nesta etapa.** Aguarda a resposta do Iago sobre como funciona hoje (questão 67 do [Questoes.md](Questoes.md)): se alguém da equipe vira supervisor substituto, se a gerência assume ou outra forma.

Até lá:

- **Supervisor ausente:** a equipe fica sem quem aprove pedidos e fins antecipados, reserve ou devolva OS. Tudo espera ele voltar. Os alertas da equipe continuam indo para ele.
- **Equipe sem supervisor:** o botão "Pedir ausência" fica desabilitado, com o aviso de que a equipe está sem supervisor.

## 10. Documentação

- **[funcionalidades.md](funcionalidades.md):** o item do usuário ausente passa a apontar para este arquivo.
- **[Questoes.md](Questoes.md) e [pontos-a-validar.md](base/.design/pontos-a-validar.md):** a questão 67.
- **[api/README.md](api/README.md):** as rotas, o erro `usuario_ausente` e os alertas.

## 11. Ordem de implementação

1. Migração, rotas da ausência e a tarefa periódica, com os testes.
2. O bloqueio do ausente, a reserva, a APR e a suspensão automática.
3. O sino do técnico e os alertas.
4. Web: perfil, tela da equipe, faixa, tela de retorno e selos.
5. Carga de demonstração e documentação.

## 12. Pontos em aberto

- **A seção 9** (questão 67).
- **O e-mail dos avisos,** na curadoria do SMTP.
- **O app,** quando existir: a faixa, a tela de retorno e o login sem sinal de quem está ausente.

## 13. O que mudou na implementação

Feita em 15/10/2026, na ordem da seção 11. O que ficou diferente do plano ou foi decidido ao implementar:

- **Banco (migração `0025`).** As tabelas `ausencia` e `ausencia_ato` são as da seção 8.1, com duas colunas a mais em `ausencia`: `fim_pedido_data` e `fim_pedido_em`, que guardam o fim antecipado pedido e ainda sem resposta (o pedido precisa ser consultável). `inicio` e `retorno` são colunas `date` (dias em São Paulo). A entidade `ausencia` entrou na auditoria, e o `alerta` ganhou `ausencia_id` e `usuario_alvo_id`, com o `CHECK` `alerta_alvo` aceitando o alerta de ausência sem OS. O `ausencia_ato` tem os atos `inicio` e `cancelamento_automatico`, do sistema.
- **A assinatura é confirmada no corpo.** Todo ato assinado exige `{ "assinar": true }` e a assinatura cadastrada no perfil (`422` `assinatura_ausente`). A imagem usada fica em `ausencia_ato.assinatura_path`. O pedido do técnico não leva assinatura; o registro do supervisor, sim (`assinatura_obrigatoria` sem o `assinar`).
- **O período.** O pedido leva `inicio` mais `dias` (1 a 365) ou `retorno`, nunca os dois (`periodo_invalido`). O início não pode estar no passado (`inicio_no_passado`). A sobreposição é conferida só contra as ausências de pé da pessoa, com os períodos tratados como `[inicio, retorno)`: duas ausências vizinhas passam. O banco trava a linha da pessoa para dois pedidos juntos não furarem a conferência.
- **Aprovar.** Sem ajuste mantém as datas; só com um `inicio` novo mantém a duração; com `dias` ou `retorno` recalcula. O pedido cujo início já passou só é aprovado com o ajuste. Aprovado, o pedido vai a `aguardando_confirmacao` mesmo sem ajuste.
- **Fim antecipado.** O ausente informa a data em que quer voltar (de hoje até a véspera do retorno). Se o supervisor aprovar para hoje, a ausência termina na hora (`antecipada`); para um dia à frente, a data de retorno passa a ser essa e a ausência segue o caminho de sempre (fica vencida e o retorno é confirmado). Só vale para a ausência em curso, e quem registrou a própria não pede: a encerra.
- **Prorrogar.** Aceita só a nova data de retorno (depois de hoje e do início; outra data que a atual), em qualquer ausência confirmada, e limpa o aviso de vencida para ele poder sair de novo no novo retorno. A prorrogação não pode invadir a ausência seguinte da pessoa.
- **Supervisor ausente.** Age só sobre a própria ausência: prorroga e encerra (`emergencia`) a que registrou; sobre a da equipe, `403` `usuario_ausente`. O alerta da equipe continua indo para ele.
- **O bloqueio é por método.** `autenticar()` recusa todo `POST`, `PUT`, `PATCH` e `DELETE` do ausente, menos nas rotas com `permitirAusente` (lista no `api/README.md`). `GET` e `POST /sync/pull` passam.
- **O início é aplicado na hora quando já começou.** A ausência registrada ou confirmada com início hoje aplica o início na mesma chamada (reservas desfeitas, execução suspensa); a tarefa de hora em hora cobre a virada do dia. A resposta do registro e da aprovação traz `execucao_aberta` para avisar o supervisor.
- **A linha do tempo da OS** tira "Reserva desfeita: ausência de <nome>" do ato `inicio` (`dados.reservas_desfeitas`).
- **Sino.** `GET /alertas` e `PATCH /alertas/{id}` passaram a atender todo perfil, cada um com os alertas endereçados a ele. Na `web`, o técnico vê o sino na barra, com os avisos da própria ausência (cada item leva a Minhas ausências, no perfil, e abri-lo o marca como lido); a tela de alertas continua só da gestão, e os alertas de ausência do supervisor têm o próprio detalhe.
- **Web.**
  - Perfil: a seção "Minhas ausências" (pedir, ou registrar a própria no caso do supervisor; confirmar, recusar as datas, cancelar, pedir o fim antecipado, confirmar o retorno) e o histórico de cada ausência.
  - Equipe (`/app/equipes/{id}`, e "Minha equipe"): a seção "Ausências" do supervisor, com os pedidos a responder, os fins antecipados, as vencidas, as em curso e as agendadas, e o botão "Registrar ausência" (geral e em cada membro). O admin vê a seção, sem botões.
  - Faixa "Você está ausente até DD/MM" e, depois do retorno, a janela "Sua ausência terminou", na casca do portal.
  - Selos "Ausente até DD/MM/AAAA" e "Ausência vencida desde DD/MM/AAAA" na equipe, nos usuários e no perfil da pessoa; o ausente some da escolha dos participantes da APR e do responsável da OS.
  - No detalhe da OS, as ações de campo e de supervisão somem para o ausente, com o aviso.
  - O Campo de treino não muda: a API fictícia não tem ausência e a seção não aparece.
- **Carga de demonstração.** Tadeu em curso, Taís agendada (registrada por Sandra), Tânia vencida e um pedido de Tomás aguardando Saulo. Ninguém com execução aberta nas OS da demonstração entra em ausência em curso.
- **Não feito** (como no plano): a seção 9, o e-mail dos avisos e o app.
- **Testes.** `api/test/ausencia.test.ts` cobre os estados, as assinaturas, a sobreposição, o bloqueio e as exceções, a fila offline, a reserva, a APR, a suspensão da execução, a vencida, o retorno, o fim antecipado, a prorrogação, o supervisor ausente, a tarefa periódica, a consulta e as regras do banco.
