# Avisos e e-mails — decisões e implementação de 17/10/2026

> O sino (os avisos) e o e-mail que sai deles: quem recebe o quê, as preferências de cada pessoa, o resumo diário e as cinco pendências que dependiam disso (a falha da leitura do registro de funcionários, a readmissão, os avisos da leitura do SAP, a equipe sem supervisor e o e-mail dos avisos de ausência).
>
> **Situação:** implementado em 17/10/2026 na `api` e na `web`. **Pendente: configurar o servidor de e-mail (SMTP)**, o único passo para os e-mails saírem de verdade (seção 6). Ele espera a empresa liberar a conta, o remetente e o SPF/DKIM do domínio, registrado como a questão 68 do [Questoes.md](../Questoes.md). Sem ele, tudo funciona e os avisos ficam só no sino.
>
> Fontes: a conversa de 17/10/2026; as pendências em [funcionalidades.md](../funcionalidades.md) (seções 3.2 e 7), [apifuncionarios.md](apifuncionarios.md) (seção 12), [apiSAP.md](apiSAP.md) (seção 14), [ausencia.md](ausencia.md) (seções 7 e 12) e [representante.md](representante.md) (seção 6); o código em [`shared/notificacoes/avisos.ts`](../shared/notificacoes/avisos.ts), [`api/src/dominio/alertas.ts`](../api/src/dominio/alertas.ts) e [`api/src/servicos/email-alerta.ts`](../api/src/servicos/email-alerta.ts).

## Resumo

- **Todo e-mail nasce de um aviso do sino** (menos o resumo diário). O aviso fica no sino; se o tipo dele tem uma categoria de e-mail, ele também vai para o e-mail institucional de quem o recebe.
- **Cada pessoa escolhe as categorias no perfil** (seção "E-mails"). As de segurança e as da própria conta são obrigatórias. Desligar uma categoria só tira o e-mail: o aviso continua no sino.
- **O resumo diário** sai de manhã, uma vez por dia, só para quem tem alguma coisa esperando: OS aguardando ciência, pedidos de ausência, cadastros a liberar, OS reservadas.
- **A varredura** acrescentou 18 tipos de aviso aos 19 que já existiam (seção 2).
- **As cinco pendências** ficaram assim:
  - a falha da leitura do registro de funcionários vira aviso no sino e e-mail;
  - a readmissão avisa os administradores, com o botão "Reativar a conta" no próprio aviso;
  - os avisos da leitura do SAP ficam gravados e aparecem no cartão da tela do SAP e no histórico da Importação;
  - na equipe sem supervisor, o representante assume e os administradores são avisados;
  - os avisos de ausência vão também por e-mail.

---

## 1. Decisões

| # | Pergunta | Decisão |
|---|---|---|
| 1 | O que fazer com a conta de quem é readmitido no registro de funcionários? | **Aviso aos administradores e reativação em um clique.** A regra "o automático só tira acesso; quem dá acesso é sempre uma pessoa" continua valendo. O aviso tem o botão "Reativar a conta". |
| 2 | O que fazer com a equipe sem supervisor (nenhum, ou um desativado)? | **O representante assume e os administradores são avisados.** É o terceiro motivo da representação (`sem_supervisor`), ao lado da ausência e da inatividade. Vale até o admin escolher um supervisor. |
| 3 | Como mandar os avisos que se repetem muito, como "OS aguardando a sua ciência"? | **Resumo diário**, um e-mail por pessoa por dia, de manhã. Os avisos urgentes continuam saindo na hora. |
| 4 | A pessoa pode desligar e-mails? | **Sim, por categoria, no perfil.** Segurança e conta não desligam. |
| — | Avisos que não existiam viram aviso no sino também? | Sim. O e-mail sempre tem o aviso correspondente no sino, para quem não lê e-mail não perder nada. |
| — | A falha de importação vai por e-mail? | Só a da leitura do SAP (a planilha e o PDF mostram o erro na hora para quem enviou), e só quando o aviso é novo. Enquanto o anterior não foi lido, ele é reaproveitado e não sai outro e-mail. |
| — | O treinamento novo avisa os técnicos a cada versão? | Não: só na primeira publicação. As versões seguintes corrigem o que já está lá. |
| — | A Vitória sem IA avisa a cada pergunta? | Não: uma vez por dia. Só avisa quando é problema (o limite do dia, o fornecedor fora do ar ou sem cota). A IA desligada de propósito, sem chave, não avisa. |
| — | A reserva da OS avisa o responsável? | Sim. Antes ficava de fora: ele só via a marca no quadro ([funcionalidades.md](../funcionalidades.md), seção 6.4). |

## 2. Os avisos, por perfil

Os avisos marcados com **(novo)** entraram nesta rodada. A coluna "E-mail" é a categoria que a pessoa liga ou desliga no perfil; "obrigatória" não desliga.

### 2.1 Supervisor (e o representante no comando)

| Aviso | Quando | E-mail |
|---|---|---|
| `bloqueio` | APR bloqueada ou execução interrompida por risco | Segurança (obrigatória) |
| `conflito_planejamento`, `execucao_duplicada` | o que veio da fila offline conflitou com o planejamento | Ordens de serviço |
| `apoio_encerrado` | a OS de apoio foi encerrada: a original pode seguir | Ordens de serviço |
| `inspecao_com_pendencia` | o encerramento deixou itens do checklist de inspeção sem marcar | Ordens de serviço |
| `preventiva_proxima`, `preventiva_vencida` | o ciclo da preventiva se aproxima ou venceu sem OS nova | Preventivas |
| `ausencia_pedida`, `ausencia_fim_pedido`, `ausencia_vencida`, `ausencia_recusada`, `ausencia_cancelada` | os atos da ausência de alguém da equipe | Ausências |
| `representacao_iniciada`, `representacao_encerrada` | o representante assumiu ou devolveu a equipe | Equipe |
| `cadastro_liberado`, `cadastro_recusado` **(novo)** | o admin liberou ou recusou o técnico que o supervisor cadastrou (ou o registro de funcionários o recusou) | Equipe |
| `membro_desativado` **(novo)** | um membro da equipe perdeu o acesso (desligado no registro ou desativado pelo admin); diz quantas OS continuam reservadas para ele | Equipe |
| "OS aguardando a sua ciência" **(novo)** | no resumo diário, com os pedidos de ausência e as ausências vencidas | Resumo diário |

### 2.2 Técnico

| Aviso | Quando | E-mail |
|---|---|---|
| `conta_criada` **(novo)** | a conta foi criada; diz que a senha provisória vem de quem cadastrou | Conta (obrigatória) |
| `acesso_liberado` **(novo)** | o admin liberou o acesso, ou reativou a conta | Conta (obrigatória) |
| `acesso_recusado` **(novo)** | o admin recusou o acesso, com o motivo; o e-mail sai mesmo com a conta sem acesso | Conta (obrigatória) |
| `senha_redefinida` **(novo)** | o admin redefiniu a senha (a senha nunca vai no aviso) | Conta (obrigatória) |
| `os_reservada` **(novo)** | o supervisor reservou uma OS para a pessoa | Ordens de serviço |
| `os_reserva_desfeita` **(novo)** | a OS reservada passou para outra pessoa ou voltou para a equipe toda | Ordens de serviço |
| `os_ciencia` **(novo)** | o supervisor deu a ciência na OS que a pessoa executou | Ordens de serviço |
| `ausencia_aprovada`, `ausencia_recusada`, `ausencia_registrada`, `ausencia_fim_respondido`, `ausencia_alterada`, `ausencia_cancelada` | os atos da própria ausência | Ausências |
| `treinamento_publicado` **(novo)** | a primeira publicação do treinamento de um serviço (também para quem aguarda a liberação) | Treinamentos |
| "OS reservadas para você" e "Ausência aguardando a sua confirmação" **(novo)** | no resumo diário | Resumo diário |

### 2.3 Administrador

| Aviso | Quando | E-mail |
|---|---|---|
| `falha_importacao` | a leitura do SAP, a planilha ou o PDF falhou (e-mail só a do SAP) | Sistema |
| `cadastro_pendente` **(novo)** | um supervisor cadastrou um técnico, que aguarda a liberação; sai do "não lido" de todos os admins quando alguém libera ou recusa | Sistema |
| `funcionario_readmitido` **(novo)** | quem foi desligado voltou a ficar ativo no registro; a conta continua desativada | Sistema |
| `equipe_sem_supervisor` **(novo)** | a equipe com gente ficou sem supervisor (nenhum, ou um desativado); uma vez por ocorrência | Sistema |
| `rh_leitura_falhou` **(novo)** | a leitura do registro de funcionários falhou de vez (as tentativas acabaram ou a trava de segurança parou a leitura) | Sistema |
| `pdf_os_falhou` **(novo)** | o PDF da OS não saiu depois de todas as tentativas | Sistema |
| `vitoria_sem_ia` **(novo)** | a Vitória passou a responder sem IA (o limite do dia, o fornecedor fora); uma vez por dia | Sistema |
| `treinamento_problema` **(novo)** | um técnico reportou um problema num treinamento | Treinamentos |
| Os avisos de OS e de ausência da equipe sem ninguém que responda | como os do supervisor | como os do supervisor |
| "Cadastros aguardando liberação", "Equipes sem supervisor", "OS devolvidas a exportar", "Perguntas à Vitória", "Problemas nos treinamentos" **(novo)** | no resumo diário | Resumo diário |

## 3. O e-mail

- **Quem decide é a tarefa `email_alerta`**, na hora de enviar. Ela termina sem enviar, e sem marcar o aviso como enviado, quando:
  - o servidor de e-mail não está configurado;
  - a pessoa está desativada (menos no acesso recusado, que é justamente o aviso de que ela não entra mais);
  - a categoria está desligada no perfil;
  - o aviso foi apagado (o cadastro pendente cancelado).
- **O conteúdo** segue um modelo só ([`email-modelo.ts`](../api/src/servicos/email-modelo.ts)), em texto puro e em HTML:
  - assunto `[SYNQ OS] <aviso> — <OS, pessoa, equipe ou serviço>`;
  - o texto do sino;
  - os dados do alvo (a OS com o local e a equipe, a pessoa com a matrícula, a equipe, o serviço);
  - o botão "Abrir no SYNQ OS";
  - o rodapé, que diz por que a pessoa recebe e como desligar (`/app/perfil#emails`).
- **O e-mail do bloqueio** continua com o conteúdo completo de antes (itens reprovados, observações, links das fotos e dos PDFs, válidos por 7 dias), agora no mesmo modelo.
- **O link** leva ao mesmo lugar que o sino do técnico: a OS, a ausência (o perfil de quem está ausente, a equipe de quem responde), a equipe, o treinamento. Os avisos só do admin, que têm uma ação no detalhe (reativar, escolher o supervisor, ler de novo), levam à tela de alertas com o aviso aberto. A regra fica em `caminhoDoAviso`, no arquivo compartilhado.
- **Reenvio não duplica:** com `email_enviado_em` preenchido, a tarefa encerra sem enviar. A falha no envio tenta de novo em 1, 5, 15 e 15 minutos, como as outras tarefas.
- **Na web,** o detalhe do aviso mostra "e-mail enviado em…" só quando o e-mail saiu (antes dizia "ainda não enviado" mesmo para o que nunca iria por e-mail).

### 3.1 As categorias

| Categoria | O que entra | Desliga? |
|---|---|---|
| Segurança | APR bloqueada e execução interrompida por risco | não |
| Sua conta | conta criada, acesso liberado ou recusado, senha redefinida | não |
| Ordens de serviço | reserva, ciência, apoio encerrado, inspeção com pendência, conflitos e execuções duplicadas | sim |
| Preventivas | ciclo próximo e vencido | sim |
| Ausências | todos os avisos da ausência | sim |
| Equipe | representação, membro desativado, técnico cadastrado liberado ou recusado | sim |
| Treinamentos | treinamento novo e problema reportado | sim |
| Sistema (só o admin vê) | falhas do SAP, do registro e do PDF, cadastro pendente, readmissão, equipe sem supervisor, Vitória sem IA | sim |
| Resumo diário | o e-mail da manhã | sim |

## 4. O resumo diário

- **Quando:** a partir de `EMAIL_RESUMO_HORA` (padrão 7h, no horário de São Paulo), uma vez por dia. `usuario.resumo_email_dia` marca o dia já agendado, na mesma transação que enfileira as tarefas: um reinício ou duas instâncias não repetem.
- **Para quem:** quem está ativo e liberado, não desligou o resumo e não está ausente (quem está de férias não recebe um e-mail por dia). Sem servidor de e-mail, nada é agendado.
- **Só sai com conteúdo.** Quem não tem nada esperando não recebe. O conteúdo é montado na hora de enviar ([`email-resumo.ts`](../api/src/servicos/email-resumo.ts)), em seções de até 10 linhas, com "e mais N":
  - **quem supervisiona** (titular ou representante no comando):
    - as OS encerradas aguardando a ciência dela, menos as que ela mesma executou ou assinou;
    - os pedidos de ausência e de fim antecipado a responder;
    - as ausências vencidas da equipe;
  - **o admin:**
    - os cadastros aguardando liberação;
    - as equipes sem supervisor;
    - as OS devolvidas que ainda não saíram na planilha de baixa;
    - as perguntas à Vitória sem tratamento;
    - os problemas reportados nos treinamentos;
  - **todo mundo:**
    - as OS reservadas para a pessoa e ainda não iniciadas;
    - a ausência que espera a confirmação dela.
- **O e-mail** diz também quantos avisos não lidos a pessoa tem no sino.

## 5. As cinco pendências

### 5.1 Alerta no sino quando a leitura do registro de funcionários falha

- **Quando avisa:**
  - quando a trava de segurança para a leitura, na hora;
  - quando a tarefa esgota as tentativas, com o registro fora do ar.

  O executor de tarefas ganhou um gancho para isso (`AO_ESGOTAR`, em [`tarefas.ts`](../api/src/servicos/tarefas.ts)). Uma tentativa que falha e ainda vai se repetir não avisa.
- **Quem recebe:** quem pediu o "Ler agora", se ainda é admin ativo; na leitura diária, todos os admins.
- **Repetição:** o aviso ainda não lido é reaproveitado (aponta para a falha mais recente e sobe para o topo), como na falha de importação. Só o aviso novo vai por e-mail.
- **Na web:** o detalhe leva ao cartão do registro de funcionários, na tela de usuários, onde está o "Ler agora".

### 5.2 Reativar a conta na readmissão

- **Quando avisa:** a conferência (o aviso do registro, a leitura diária ou "Atualizar do registro") vê alguém que estava `desligado` ou `fora_do_registro` voltar a `ativo`, com a conta liberada e desativada. Os administradores recebem `funcionario_readmitido`, uma vez por readmissão.
- **A conta continua desativada.** O detalhe do aviso tem o botão "Reativar a conta", que chama `PATCH /usuarios/{id}` com `ativo: true`. A `api` confere o registro de novo antes de reativar.
- **Ao reativar:** os avisos de readmissão saem do "não lido", e a pessoa recebe `acesso_liberado` ("reativou a sua conta").
- **`POST /usuarios/{id}/atualizar-do-registro`** passou a devolver `readmitido`.
- **Fora:** o cadastro que nunca chegou a ser liberado e foi recusado por desligamento. A pessoa readmitida é cadastrada de novo, depois de o recusado ser excluído.

### 5.3 Os avisos da leitura no cartão da tela do SAP

- **Onde ficam:** `importacao.avisos` (quantos) e `importacao.detalhe_avisos` (`[{linha ou numero_ordem, motivo}]`), gravados pela leitura do SAP, pela planilha e pelo PDF. Hoje o único aviso é o intervalo entre ciclos que não foi reconhecido.
- **`GET /importacoes`** devolve os dois campos.
- **Onde aparecem:**
  - no cartão "Sincronização com o SYNQ OS" da tela do SAP: a contagem e a lista, aberta, com o número da ordem e o motivo;
  - no histórico da aba Importação: "Ver N avisos".
- **As leituras antigas** não têm avisos gravados.

### 5.4 A equipe sem supervisor

- **Quando vale:** a equipe não tem supervisor, ou o dela está desativado (desligado no registro, por exemplo). O representante assume pelo motivo `sem_supervisor` (migração `0031`), na hora: a permissão é calculada a cada chamada.
- **O que ele faz:** o mesmo que no supervisor ausente. Aprova as ausências, reserva e devolve OS, dá ciência e recebe os alertas da equipe (`destinatariosDaEquipe`).
- **Os administradores** recebem `equipe_sem_supervisor` uma vez por ocorrência (`equipe.sem_supervisor_avisado_em`). Só a equipe com gente avisa: a vazia não tem ninguém esperando.
- **Quando a equipe ganha um supervisor:** a marca volta a nulo, os avisos saem do "não lido", e o representante recebe `representacao_encerrada` ("a equipe ganhou um supervisor"), como o novo supervisor.
- **O pedido de ausência** de quem está na equipe sem supervisor vai para o representante. O representante não pede a própria ausência ali, porque ninguém responde ao próprio pedido: `409` `equipe_sem_supervisor`, com a orientação de falar com o admin. Na web, o botão fica desabilitado com esse aviso.
- **Quando confere:** a conferência roda depois de qualquer mudança em pessoas ou equipes (cadastro, liberação, desativação, troca de supervisor, desligamento pelo registro) e na tarefa de hora em hora (`atualizarSupervisaoDasEquipes`).
- **Ajuste na web:** o perfil passou a decidir "Registrar minha ausência" ou "Pedir ausência" pelo supervisor titular, e não por quem supervisiona. O representante no comando pede, como qualquer técnico, que é o que a `api` já fazia.
- **Sem representante:** se não houver nenhum técnico elegível, ninguém assume. Os alertas da equipe vão aos administradores, como antes.

### 5.5 O e-mail dos avisos de ausência

- Os nove avisos da ausência vão por e-mail, na categoria "Ausências" (seção 3).
- Os pedidos a responder e as ausências vencidas também entram no resumo diário.

## 6. O que falta para os e-mails saírem

**Pendente** (questão 68 do [Questoes.md](../Questoes.md), com a empresa, pelo Iago): a conta no servidor de e-mail, o remetente e o SPF/DKIM do domínio. Com isso em mãos, é só a configuração. No `.env.local` (ou nas variáveis do ambiente publicado):

| Variável | O que é |
|---|---|
| `SMTP_URL` | o servidor: `smtp://usuario:senha@smtp.empresa.com.br:587` (STARTTLS) ou `smtps://…:465` (TLS direto). Caracteres especiais no usuário ou na senha vão codificados (`@` vira `%40`). |
| `EMAIL_REMETENTE` | quem envia, por exemplo `"SYNQ OS <synqos@empresa.com.br>"`. Precisa ser um endereço que o servidor aceite como remetente. |
| `PAINEL_URL` | o endereço público da web; é a base de todos os links dos e-mails. No ambiente publicado, não pode ficar `http://localhost:3000`. |
| `EMAIL_RESUMO_HORA` | opcional; a hora do resumo diário (padrão 7). |

Depois:

1. `pnpm --dir api email:testar -- --so-conectar` conecta e autentica sem enviar nada.
2. `pnpm --dir api email:testar -- seu.email@empresa.com.br` envia um e-mail de teste no modelo dos avisos. Se ele chega, os avisos e o resumo também chegam.
3. Reiniciar a `api`: o log diz "E-mail ligado".

**Pontos a combinar com a empresa:**

- **O domínio do remetente** precisa de SPF e DKIM, para os e-mails não caírem no spam.
- **O que vai no e-mail:** nome, matrícula, número e título da OS, local e motivo da ausência. São dados internos, enviados só ao e-mail institucional. Os links das fotos do bloqueio valem por 7 dias.

Sem `SMTP_URL`, a `api` sobe normalmente e avisa no log. No modo local (`pnpm dev:local`), os e-mails ficam na memória e o console mostra quem receberia e o assunto.

## 7. O que mudou no código

- **Compartilhado:** [`shared/notificacoes/avisos.ts`](../shared/notificacoes/avisos.ts). Tem:
  - os tipos de aviso, o alvo de cada um e os rótulos;
  - as categorias de e-mail, com a categoria de cada aviso e quais são obrigatórias;
  - `caminhoDoAviso`.

  A `api` usa no `CHECK` do banco e no e-mail; a `web`, no sino, na tela de alertas e no perfil.
- **Banco (migração `0031_avisos_e_emails`):**
  - `alerta`: 18 tipos novos e as colunas `leitura_rh_id` e `treinamento_id`. O `CHECK` `alerta_alvo` é gerado do mapa de alvos (cada tipo exige exatamente as colunas do seu alvo), e o `alerta_alvo_da_ausencia` saiu. Entrou o índice `alerta_usuario_alvo_idx`;
  - `equipe.representacao_motivo` aceita `sem_supervisor`; entrou `equipe.sem_supervisor_avisado_em`;
  - `usuario`: `emails_desligados` (`text[]`, com `CHECK` contra as categorias e sem as obrigatórias) e `resumo_email_dia`;
  - `importacao`: `avisos` e `detalhe_avisos`;
  - `tarefa`: o tipo `email_resumo`.
- **API:**
  - `criarAviso`, `avisarAdmins`, `resolverAvisos` e `apagarAvisosDaConta`, em [`alertas.ts`](../api/src/dominio/alertas.ts). Todo aviso passa por `criarAviso`;
  - `PUT /me/emails` `{desligados}` (`422` `categoria_obrigatoria`); `GET /me` traz `emails: {desligados, servidor_configurado}`;
  - `GET /alertas` traz `equipe_alvo_id` (antes `representacao_equipe_id`), `equipe_alvo_nome`, `leitura_rh_id`, `treinamento_id` e `treinamento_codigo`;
  - `DELETE /usuarios/{id}` apaga junto os avisos de conta (conta criada, cadastro pendente), que não prendem a conta ao histórico;
  - o transporte de e-mail ganhou `configurado` e a versão `EmailSemServidor`, e o executor de tarefas, `AO_ESGOTAR` e o agendamento do resumo;
  - o script `pnpm email:testar`.
- **Web:**
  - os tipos de alerta vêm do compartilhado;
  - `DetalheAvisoGeral` e `BotaoReativarConta` na tela de alertas, e o link "Abrir o PDF" no aviso do PDF que não saiu;
  - o sino do técnico leva a cada tela (`destinoDoAlerta`);
  - a seção "E-mails" do perfil (`PreferenciasDeEmail`);
  - os avisos no cartão do SAP e no histórico da Importação;
  - o motivo "equipe sem supervisor" na faixa e no cartão do representante.
- **Manuais da Vitória:** o sino e os e-mails, para o técnico e o admin.
- **Testes:** [`api/test/avisos-e-emails.test.ts`](../api/test/avisos-e-emails.test.ts) tem 20 casos: conta e cadastro, readmissão, desligamento, equipe sem supervisor, falhas do RH e do PDF, Vitória sem IA, reserva e ciência, treinamentos, preferências, resumo diário e os avisos da leitura do SAP. Os testes antigos ajustados:
  - o conflito sai por e-mail;
  - `GET /importacoes` tem dois campos novos;
  - a regra "só o bloqueio vai por e-mail" virou "todos vão, conforme a categoria";
  - a equipe dos testes de usuários ganhou um supervisor, para o técnico dela continuar comum.

  A `api` fica com 828 testes, todos passando.

## 8. O que ficou de fora e sugestões para discutir

- **Gamificação** (nova patente, conquista, fim de temporada com a colocação): fica para discutir antes, como toda parte nova da gamificação ([gameficacao.md](gameficacao.md)).
- **OS nova para a equipe por e-mail:** fora, pelo volume. A OS nova aparece no quadro, e o push no celular segue fora do escopo.
- **Preferência por tipo de aviso** (e não por categoria) e horário de silêncio (fins de semana): só se o piloto pedir.
- **O PDF da OS anexado ao e-mail da ciência:** hoje o e-mail leva o link da OS.
- **O app,** quando existir: o sino e as preferências, e o push no lugar do e-mail para o técnico de campo.
