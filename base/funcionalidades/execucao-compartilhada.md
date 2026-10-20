# Execução compartilhada — plano de 19/10/2026

> Todos os participantes de uma execução passam a acompanhá-la e a agir sobre ela, sem depender do aparelho do responsável. O responsável continua mandando, mas a equipe pode pausar, interromper, suspender e encerrar, e o que for feito sem sinal em aparelhos diferentes é conferido e assinado depois.
>
> **Situação:** **As três etapas feitas** (1 em 19/10/2026; 2 em 19 e 20/10/2026, com a migração `0040`; 3 em 20/10/2026, com a migração `0041`). Três etapas, cada uma entregável sozinha. Nasceu da conversa de 19/10/2026 sobre a dependência da equipe do responsável pelo serviço.
>
> Fontes: a conversa de 19/10/2026; o código em [`eventos-execucao.ts`](api/src/dominio/eventos-execucao.ts), [`eventos.ts`](api/src/dominio/eventos.ts), [`eventos-base.ts`](api/src/dominio/eventos-base.ts), [`execucao.ts`](api/src/db/schema/execucao.ts), [`sync.ts`](api/src/dominio/sync.ts), [`tarefas.ts`](api/src/servicos/tarefas.ts), [`relatorio-execucao.ts`](api/src/servicos/relatorio-execucao.ts), [`execucao-situacao.ts`](shared/api/execucao-situacao.ts), [`EmAndamento.tsx`](mobile/src/execucao/EmAndamento.tsx) e [`sincronizar.ts`](mobile/src/offline/sincronizar.ts).

## Resumo

- **Etapa 1 — Acompanhar.** Todo participante da APR vê o cronômetro, as pausas e quem é o responsável, com a tela se atualizando sozinha. Só leitura: nenhum botão novo.
- **Etapa 2 — Agir, online.** O participante pausa, continua, interrompe por risco e suspende por saúde **na hora**, com aviso ao responsável. Encerrar e suspender por outro motivo viram um **pedido de 2 minutos**: o responsável aceita ou recusa, e o silêncio aprova.
- **Etapa 3 — Conferir, offline.** Sem sinal, a ação vale na hora no aparelho de quem a fez. Quando todos sincronizarem, o sistema compara o que cada aparelho registrou. Sem divergência, é um resumo com ciência. Com divergência, o responsável escolhe a versão certa e os demais assinam.
- **Nos três casos,** os pedidos e as conferências vão para o **relatório da execução** (o anexo do supervisor), junto do tempo de execução e das pausas. Não entram no PDF da OS.

## 1. Decisões

| # | Decisão | Quem decidiu |
|---|---|---|
| 1 | O responsável pela execução continua podendo tudo, a qualquer hora. | Conversa de 19/10 |
| 2 | Qualquer outro participante da APR também pode pausar, interromper, suspender e encerrar. | Conversa de 19/10 |
| 3 | Saúde e risco valem **na hora**, sem esperar o responsável. | Conversa de 19/10 |
| 4 | A pausa de rotina (almoço, descanso, aguardando, clima, outro) também vale na hora. | Conversa de 19/10 (leitura do "sim"; ver 2.1) |
| 5 | Encerrar e suspender por motivo comum são **pedidos de 2 minutos**: sem resposta, aprovados sozinhos. | Conversa de 19/10 |
| 6 | Sem sinal, nenhum pedido é feito: a ação vale na hora e a conferência resolve depois. | Conversa de 19/10 |
| 7 | Quem encerrou assina o encerramento, mesmo que não seja o responsável. | Conversa de 19/10 |
| 8 | Um participante machucado **pausa o serviço todo**: não existe sair da execução. | Conversa de 19/10 |
| 9 | Sem divergência, basta a **ciência**. Com divergência, o responsável escolhe e os demais **assinam**. | Conversa de 19/10 |
| 10 | Quem espera os que não sincronizaram: avisos às 24 h e às 48 h; com **72 h** o responsável ou o supervisor fecha com o que existe; com **7 dias** fecha sozinho. | Proposta, para confirmar (ver seção 6) |

**"Responsável" é quem iniciou a execução** (`execucao.executor_id`), como já é hoje. Não é preciso que seja o responsável da APR: se o PDA dele descarregou e a equipe seguiu com o funcionário 2, o funcionário 2 inicia e é o responsável da execução.

## 2. Regras gerais

### 2.1 O que cada um pode fazer

| Ação | Responsável | Outro participante, online | Sem sinal (qualquer um) |
|---|---|---|---|
| Pausar (qualquer motivo) | na hora | na hora, com aviso ao responsável | na hora |
| Continuar | na hora | na hora; depois de pausa por saúde pede confirmação reforçada | na hora |
| Interromper por risco | na hora | na hora | na hora |
| Suspender por lesão ou enfermidade | na hora | na hora | na hora |
| Suspender por outro motivo (fim de expediente, clima, falta de material, outro) | na hora | **pedido de 2 min** | na hora |
| Encerrar OS | na hora | **pedido de 2 min** | na hora |
| Cancelar por engano | na hora (até 10 min, sem pausa nem foto) | **não** | **não** |

- **Por que a pausa é imediata:** ela se desfaz com um toque em "Continuar" e o aviso ao responsável deixa a contestação para depois. Esperar 2 minutos para parar o serviço de quem se machucou seria o contrário do que se quer. Se a leitura do "sim" for outra (pausa de rotina como pedido), basta mudar a tabela `ACOES_COM_PEDIDO` (seção 3.1), sem tocar no resto.
- **Interromper e suspender por saúde** continuam pedindo foto (interrupção), motivo e a assinatura **de quem as faz**; o aviso ao supervisor já existe ([`avisarSaude`](api/src/dominio/eventos-execucao.ts#L74)).
- **Cancelar por engano** fica só com o responsável: apaga a execução e devolve a APR, então não faz sentido para quem só acompanha.
- **O instante da ação é o do clique.** No pedido de 2 minutos, o fim da execução (ou da suspensão) é o instante em que o participante pediu, não o da aprovação. A espera aparece no relatório. Se o pedido for recusado, a execução continuou correndo.
- **Participante ausente** (usuário ausente) só visualiza, como hoje. **O participante que recusou a APR** não participa da execução.

### 2.2 Os pedidos

Estados: `aberto` → `aprovado` (o responsável) · `aprovado_por_prazo` (2 min sem resposta) · `recusado` · `cancelado` (o solicitante desiste) · `obsoleto` (o responsável fez a ação antes, ou a execução acabou).

- **Um pedido aberto por execução.** Quem pede outra coisa enquanto há um aberto só vê o pedido aberto e pode **apoiá-lo** (fica registrado que concordou); não abre outro.
- **O prazo é do servidor.** Conta 2 minutos desde que o servidor recebeu o pedido (`expira_em`). O relógio do aparelho não entra.
- **Quem decide primeiro vale.** A decisão do responsável e o vencimento disputam a mesma linha (`for update`); a segunda recebe `pedido_ja_decidido`.
- **Recusar** pede um motivo curto, que o solicitante lê. Não recusa pedido de saúde ou risco: esses nem são pedidos.
- **Aprovada,** a ação é aplicada em nome do solicitante: ele é o autor dos eventos, assina o que precisa de assinatura e, se for o encerramento, é quem assina o encerramento (decisão 7).
- **Sem push** (a notificação push está fora do MVP: [pendencias.md](pendencias.md), seção 7). O aviso ao responsável é por consulta periódica (seção 4.3). Se o aparelho dele está fechado, descarregado ou sem sinal, o pedido vence e aprova sozinho, que é o resultado pretendido.

## 3. Etapa 1 — Acompanhar (somente leitura)

**Entrega:** o participante que não iniciou a execução deixa de ver "Outra pessoa está executando" e passa a ver o andamento.

### 3.1 O que muda

- **Quem é participante da execução:** quem está em `apr_participante` da APR da execução e não recusou. Função única `participanteDaExecucao` na `api`, usada por todas as rotas das etapas 2 e 3.
- **Compartilhado** ([`execucao-situacao.ts`](shared/api/execucao-situacao.ts)): uma situação nova, `acompanhando` (`{ execucao, participantes, responsavel }`), no lugar de `outra_pessoa` quando a pessoa é participante da APR da execução em andamento. Quem não é participante continua em `outra_pessoa`. Uma constante `ACOES_COM_PEDIDO` ali mesmo fica pronta para a etapa 2.
- **`api`:** conferir que `GET /os/{id}` já traz, para o participante, a execução, as pausas e os participantes da APR (hoje o app só as usa para o executor). Se algo faltar, acrescentar. Nenhuma tabela nova.
- **Web e app:** o cartão "Acompanhando [nome]" na tela de execução, com o cronômetro, a pausa atual (motivo e há quanto tempo), os participantes e quem é o responsável. O cronômetro usa a conta que já existe em [`execucao-tempo.ts`](shared/api/execucao-tempo.ts).
- **Atualização:** consulta a cada 10 segundos com a tela aberta e em primeiro plano (nada em segundo plano). O app já lê pelo `lerDeOndeDer`: sem sinal, mostra a última cópia, com a faixa "Dados de HH:MM".
- **Detalhe da OS:** o participante vê "Em execução por [nome] — Acompanhar".
- **Encerrando:** quem não encerrou vê "[nome] está preenchendo o encerramento" (já é o caso hoje, com `outra_pessoa` e `encerrando`).

### 3.2 O que foi feito (19/10/2026)

- **Compartilhado:** [`participaDaExecucao`](shared/api/execucao-situacao.ts) e a situação `acompanhando` em `definirSituacao`: o participante da APR (que não recusou) que não iniciou a execução em andamento deixa de cair em `outra_pessoa`. Quem não participa, e o encerramento de outra pessoa (preenchimento), seguem em `outra_pessoa`.
- **`api`:** nada mudou. `GET /os/{id}` já devolve, a qualquer pessoa da equipe, a execução com as pausas e a APR com os participantes.
- **App:** [`Acompanhando.tsx`](mobile/src/execucao/Acompanhando.tsx) (cronômetro, quem está na execução, pausas com o motivo, "Atualizado às HH:MM"); a leitura da execução ([`consultas.ts`](mobile/src/execucao/consultas.ts)) se repete a cada 10 s só enquanto há execução de outra pessoa em curso; o detalhe da OS ganhou o botão "Acompanhar a execução" ([`acao.ts`](mobile/src/os/detalhe/acao.ts)).
- **Web:** [`ExecucaoAcompanhando.tsx`](web/src/components/app/execucao/ExecucaoAcompanhando.tsx) e [`AtualizarSozinha.tsx`](web/src/components/app/execucao/AtualizarSozinha.tsx) (`router.refresh()` a cada 10 s com a aba visível); o botão "Acompanhar execução" no detalhe da OS.
- **Diferença do plano:** o texto do aviso diz que, *por enquanto*, só quem iniciou a execução age; sai na etapa 2.
- **Conferido:** testes do app (272, com casos novos de `definirSituacao`, `participaDaExecucao` e do painel de ação), `tsc` e `eslint` do app e da web limpos, e `conferir:campo`, `conferir:offline` e `conferir:sem-sinal` contra a `api` local (a colega que participa da APR vê "acompanhando", com a pausa aberta e o motivo). Nada foi visto num aparelho nem num navegador.

### 3.3 Pronto quando

- O participante vê o andamento na web e no app, e a tela se atualiza sozinha.
- Quem não é participante continua sem ver os botões.
- Testes de `definirSituacao` para os dois casos; `tsc` e `eslint` da `api`, `web` e `mobile` limpos. **Sem migração.**

## 4. Etapa 2 — Agir, online

> **Feita em 19 e 20/10/2026** (`api`, web e app). O que saiu diferente do plano está na seção 4.5.

**Entrega:** os participantes agem sobre a execução, e o encerramento passa a ser de quem encerrou.

### 4.1 Banco (uma migração; a próxima livre, hoje a `0040`)

- **`execucao_pausa`:** `iniciada_por` e `encerrada_por` (usuário). Hoje a pausa não sabe quem a fez.
- **`execucao`:** `finalizada_por` (quem encerrou, interrompeu ou suspendeu) e `encerrada_por` (quem assina o encerramento; é o mesmo de quem encerrou). As execuções antigas ficam com o `executor_id`.
- **`execucao_pedido`:** `id` (nasce no aparelho), `execucao_id`, `tipo` (`encerrar` ou `suspender`), `solicitante_id`, `payload` (o que a ação pede: motivo, complemento, posição, instante), `criado_em`, `expira_em`, `estado`, `decidido_por`, `decidido_em`, `motivo_recusa`. Índice único parcial: um pedido `aberto` por execução. `CHECK`s de estado e de coerência da decisão.
- **`execucao_pedido_apoio`:** quem concordou com um pedido aberto.
- **`alerta`:** três tipos novos (`pedido_de_acao`, `pedido_decidido`, `acao_de_participante`) em [`avisos.ts`](shared/notificacoes/avisos.ts) e no `CHECK` `alerta_tipo_check`. **Sem e-mail** para eles (o e-mail não chega em 2 minutos e só faria barulho).
- **Cuidado:** o `pnpm dev` em watch aplica a migração na hora no banco de dev, que é o Supabase compartilhado. Fechar o desenho das colunas antes de gerar, e nunca regerar.

### 4.2 `api`

1. **Autoria.** [`carregarExecucaoDoUsuario`](api/src/dominio/eventos-execucao.ts#L43) deixa de exigir `executorId` e passa a devolver também o **papel** (`responsavel` ou `participante`). Os `aplicar*` gravam o autor nas colunas novas.
2. **Extrair a ação do evento.** Cada `aplicar*` de pausa, continuar, interromper, suspender e encerrar separa o miolo (`executarEncerramento`, `executarSuspensao`…), que recebe o autor. É o que permite aplicar um pedido aprovado em nome do solicitante, fora de uma requisição dele.
3. **Eventos novos** em `EVENTO_TIPOS`: `pedido_aberto`, `pedido_decidido` (aprovar ou recusar), `pedido_cancelado`, `pedido_apoiado`.
   - `pedido_aberto` com `ctx.offline` **não abre pedido**: aplica a ação direto e marca o evento como feito sem sinal (decisão 6). O sinal fraco que chega tarde cai aqui, em vez de abrir uma janela nova de 2 minutos.
4. **Aprovar por prazo, duas camadas:**
   - uma tarefa `pedido_prazo` agendada para `expira_em` (o executor de tarefas roda a cada 5 s, então o atraso é pequeno);
   - e, antes de responder, qualquer leitura da execução fecha os pedidos vencidos (idempotente). Assim a tela nunca mostra um pedido vencido como aberto, mesmo se a tarefa atrasar.
5. **Obsolescência:** quando o responsável encerra, suspende ou interrompe, ou a execução termina, o pedido aberto vira `obsoleto` na mesma transação.
6. **Rotas de leitura:** `GET /me/pedidos-abertos` (leve, para a faixa do responsável, seção 4.3) e o pedido aberto dentro de `GET /os/{id}`.
7. **Passo 2 do encerramento:** [`aplicarEncerramentoAssinado`](api/src/dominio/eventos-execucao.ts#L318) passa a exigir `encerrada_por`, não o `executor_id`. [`definirSituacao`](shared/api/execucao-situacao.ts) idem: o formulário de encerramento abre para quem encerrou.
8. **Pontos:** conferir [`pontuarExecucao`](api/src/dominio/pontuacao.ts#L133): hoje ela distribui para "todos os que concluíram a execução". Confirmar que continua certa com autores diferentes, e que **recusar ou pedir não custa pontos a ninguém** (a segurança nunca custa pontos). Qualquer ponto novo é discutido antes, como combinado para a gamificação.
9. **Relatório da execução:** a seção "Ações dos participantes" (quem pausou, continuou, pediu, decidiu, apoiou, quando, quanto esperou) em [`relatorio-execucao.ts`](api/src/servicos/relatorio-execucao.ts).

### 4.3 Web e app

- **Botões para o participante**, os mesmos da tela do responsável. Encerrar e suspender por motivo comum mostram "Pedir ao [nome]" e, depois, a contagem de 2 minutos com **Cancelar pedido**.
- **Pausa por saúde:** o aviso "[nome] pausou por lesão" aparece para o responsável e o supervisor; "Continuar" depois dela pede a confirmação reforçada (decisão: qualquer participante continua; falta confirmar, seção 6).
- **Para o responsável**, em duas camadas, porque não há push:
  - na tela de execução, uma janela com **Aprovar** e **Recusar**, a contagem regressiva e vibração, com consulta a cada 5 s;
  - em qualquer outra tela do app aberto, uma **faixa global** ("[nome] pediu para encerrar — 1:42") com consulta a cada 10 s a `GET /me/pedidos-abertos`, no `SessaoProvider`.
- **Solicitante:** vê o estado do pedido (aguardando, aprovado, recusado com o motivo, aprovado por prazo). Tudo pelo mesmo `useAcao`.
- **Mobile sem sinal:** os botões do participante funcionam na fila como os do responsável (seção 5). Na projeção ([`projecao.ts`](mobile/src/offline/projecao.ts)), o autor de cada evento passa a ser o usuário do evento, não `executor_id`.

### 4.4 Pronto quando (conferido)

- Um participante pausa e o responsável vê o aviso na hora; o participante pede para encerrar, o responsável aceita, recusa ou deixa vencer, e cada caminho termina certo.
- Dois pedidos ao mesmo tempo, aprovação no instante do vencimento e pedido obsoleto estão cobertos por teste.
- Quem encerrou assina o encerramento e a OS segue para o supervisor.
- `pnpm conferir:campo` (e um `conferir:participantes` novo) contra a `api` local; `tsc`, `eslint` e testes limpos. Sem abrir navegador.

### 4.5 O que foi feito e o que mudou em relação ao plano

**Banco** (migração `0040_execucao_compartilhada`, gerada uma vez):

- `execucao_pausa.iniciada_por` e `encerrada_por`; `execucao.finalizada_por` (**uma coluna só**: quem encerrou, interrompeu ou suspendeu; quem encerrou assina o encerramento, então a `encerrada_por` do plano não foi preciso).
- `execucao_pedido` (com os `CHECK`s de estado, decisão e prazo, e um pedido aberto por execução) e `execucao_pedido_apoio`.
- Três avisos novos (`pedido_de_acao`, `pedido_decidido`, `acao_de_participante`, só no sino), quatro eventos (`pedido_aberto`, `pedido_decidido`, `pedido_cancelado`, `pedido_apoiado`) e a tarefa `pedido_prazo`.

**`api`:**

- [`execucao-acoes.ts`](api/src/dominio/execucao-acoes.ts): o miolo de encerrar, suspender, fechar a pausa e os avisos, que não depende de quem pediu. [`pedidos-execucao.ts`](api/src/dominio/pedidos-execucao.ts): abrir, decidir, cancelar, apoiar e a aprovação por prazo. [`eventos-execucao.ts`](api/src/dominio/eventos-execucao.ts): `carregarExecucaoParaAgir` devolve a execução e o papel (`responsavel` ou `participante`) e fecha antes os pedidos vencidos.
- **A aprovação por prazo tem duas camadas:** a tarefa `pedido_prazo`, agendada para `expira_em`, e o fechamento preguiçoso antes de qualquer leitura (`GET /os/{id}`, `GET /me/pedidos-abertos`) e de qualquer ação sobre a execução. A decisão e o vencimento disputam a mesma linha (`for update`).
- **A ação vale no instante do clique** (`execucao_pedido.instante`). Uma pausa que um colega abriu enquanto o pedido esperava fecha no próprio início, sem duração, e a execução termina no início dela, nunca antes.
- **Sem sinal e saúde valem na hora:** o `pedido_aberto` que chega da fila offline (atraso maior que 60 s), e o `execucao_encerrada` e o `execucao_suspensa` diretos nessas condições, são aplicados sem abrir pedido. A suspensão por lesão ou enfermidade também.
- **Com sinal**, o participante que manda `execucao_encerrada` ou `execucao_suspensa` por motivo comum é recusado com `pedido_necessario`. O cancelamento por engano é só do responsável (`so_o_responsavel`). Assinar o encerramento é só de quem encerrou (`encerramento_de_outro`).
- **Leitura:** `GET /os/{id}` traz, em cada execução, `finalizada_por`, `pedidos` (com `restante_ms` no aberto) e, nas pausas, `iniciada_por` e `encerrada_por`. `GET /me/pedidos-abertos` é a faixa do responsável.
- **Relatório da execução:** a seção "AÇÕES DOS PARTICIPANTES" (pausas e retomadas de quem não é o responsável, o fim, e cada pedido com o resultado, quem decidiu, quanto esperou e quem apoiou). A assinatura do encerramento no PDF da OS é a de quem encerrou.
- **Pontos:** `pontuarExecucao` já dá os pontos a todos os participantes da APR, então não mudou; pedir, recusar ou apoiar não pontua nem custa pontos. O aviso de ciência chega ao responsável e a quem encerrou.

**Compartilhado, app e web:**

- [`execucao-pedidos.ts`](shared/api/execucao-pedidos.ts): `pedeAprovacaoDoResponsavel` (a tabela da seção 2.1 num lugar só, no lugar da `ACOES_COM_PEDIDO` do plano), o prazo, os tipos e a conta da contagem (`restanteDoPedido`, que desconta o tempo que passou no aparelho do `restante_ms` que a `api` mediu).
- **Participante:** `Acompanhando` (app) e `ExecucaoAcompanhando` (web) ganharam as ações. Com sinal, encerrar e suspender por motivo comum abrem um pedido ("Pedir para encerrar a OS"); sem sinal (só o app), valem na hora. O pedido aberto aparece com a contagem, "Cancelar o pedido" (de quem pediu) e "Apoiar o pedido" (dos outros). Continuar depois de pausa por lesão ou enfermidade pede uma confirmação reforçada (qualquer participante continua).
- **Responsável:** o pedido aparece em cima da tela de execução, com a contagem, "Aprovar" e "Recusar" (com motivo opcional); o app vibra quando ele chega. Uma **faixa** em toda tela de campo (`FaixaDePedidos`, app e web) consulta `GET /me/pedidos-abertos` a cada 10 s e leva à execução. A execução se relê a cada 5 s para o responsável, a cada 10 s para quem acompanha e a cada 3 s com um pedido aberto.
- **Quem encerrou assina:** `definirSituacao` e os painéis do detalhe da OS usam `quemEncerrou`. No app, a projeção da fila trata o `pedido_aberto` guardado como encerramento ou suspensão na hora e marca quem fez.
- **Supervisor:** o detalhe da OS mostra quem encerrou, quem pausou e retomou e os pedidos, com o resultado.

**Conferido em 20/10/2026:** 16 testes novos da `api` ([`execucao-compartilhada.test.ts`](api/test/execucao-compartilhada.test.ts)); testes novos do app (a regra, a contagem, o intervalo de leitura, o painel do detalhe e a projeção da fila); `conferir:campo` com a colega pausando, pedindo, o responsável recusando e depois aprovando, e a colega assinando o encerramento, contra a `api` local; `tsc` da `api`, da `web` e do app, e `eslint` da `web` e do app, limpos. Nada foi visto num aparelho nem num navegador.

**Fica para depois:**

- Os registros de **sem sinal em aparelhos diferentes** que se contradizem (duas pausas abertas, dois fins): é a etapa 3. Hoje, vindo da fila, o segundo evento ainda é recusado com o motivo de sempre.
- A **especificação** e o README da `api` não citam as rotas e eventos novos (fica para a pendência 15).
- O **histórico** do técnico (`GET /me/historico`) e a cópia offline ainda contam a execução pelo responsável: quem encerrou como participante não a vê no histórico próprio.
- **Push:** continua fora do MVP; o aviso é por consulta periódica.
- O teste "D1" de `eventos.test.ts` falha entre 0h e 2h (horário de Brasília), porque usa "duas horas atrás" e atravessa a meia-noite; não tem relação com esta etapa.

## 5. Etapa 3 — Conferir, offline

> **Feita em 20/10/2026** (`api`, web e app). O que saiu diferente do plano está na seção 5.6.

**Entrega:** o que foi feito sem sinal por vários aparelhos vira **um** registro certo, decidido pelo responsável e assinado pela equipe.

### 5.1 O problema do modelo de hoje

- **Uma APR ampara uma execução** ([`execucao_apr_unica_idx`](api/src/db/schema/execucao.ts#L106)). O funcionário 2 e o 3 não têm execução no aparelho: só a APR. Sem execução local, não há onde pausar ou concluir.
- **O servidor recusa o que conflita.** Uma pausa de outro aparelho com uma já aberta é `pausa_aberta`; um fim depois de um fim é `execucao_finalizada`. O evento recusado é desfeito (a transação volta) e só o aparelho guarda o registro. Isso fere a regra de que a sincronização nunca descarta dado de campo.
- **Hoje duas execuções encerradas na mesma OS viram "vale a primeira" e um alerta** ([linhas 293-297](api/src/dominio/eventos-execucao.ts#L293)). Não há comparação.

### 5.2 Etapa 3A — Um id só e nada recusado

- **Id da execução derivado da APR** (UUID v5 do `apr_id`): todo aparelho que registra a execução daquela APR gera o mesmo `execucao.id`. O `execucao_iniciada` repetido deixa de ser "outra execução" e vira a **versão** de outro aparelho.
- **O aparelho do participante** ganha, sem sinal, "Registrar a execução também neste aparelho", que cria a execução local com o id derivado. Online isso não aparece: ele acompanha a do responsável.
- **Evento de outro autor que conflita, vindo da fila offline,** não é recusado: fica guardado como **versão divergente** (seção 5.3) e a execução canônica não muda. O que conflita vem só da fila offline; online continua recusando, como hoje.
- **Quem é o responsável quando mais de um aparelho iniciou:** o do `execucao_iniciada` com menor `ocorrido_em`. Se a diferença for pequena demais para decidir (tolerância da seção 5.4), o supervisor decide na conferência.
- **O que existe no servidor:** `evento_campo` já guarda autor, `ocorrido_em`, `recebido_em`, `offline` e o payload. Falta `execucao_id` nele, para consultar os eventos de uma execução por autor.

### 5.3 Etapa 3B — A conferência

**Tabelas** (migração própria):

- **`conferencia_execucao`:** `execucao_id` (única), `estado` (`aguardando_sincronizacao`, `aguardando_responsavel`, `aguardando_assinaturas`, `concluida`, `fechada_sem_todos`), `tipo` (`resumo` ou `com_divergencia`), `criada_em`, `libera_fechar_em` (+72 h), `limite_em` (+7 dias), `snapshot` (as versões e as diferenças, em JSON, congelado), `decidida_por`, `decidida_em`.
- **`conferencia_decisao`:** `conferencia_id`, `campo` (`inicio`, `fim`, `resultado`, `pausa:<n>`), `escolha` (o autor cuja versão vale, ou `descartar` para um item registrado só por um aparelho), `decidida_por`.
- **`conferencia_assinatura`:** `conferencia_id`, `usuario_id`, `tipo` (`ciencia` ou `assinatura`), `assinatura_path` (cópia do perfil, só na `assinatura`), `ressalva` (texto opcional), `assinada_em`.
- **`usuario.ultima_sincronizacao_em`**, gravada em `POST /sync/pull`. O corpo do `pull` passa a levar, por OS, **quantos eventos ainda estão na fila**; só com a fila vazia a sincronização vale para a conferência.

**Quando existe uma conferência:** só se algum evento da execução veio sem sinal (`evento_campo.offline`) ou é uma versão de outro aparelho. Tudo online, nada a conferir.

**Fluxo:**

1. **Espera.** A conferência nasce quando a execução termina e algum registro foi offline. Fica `aguardando_sincronizacao` até todo participante da APR (que não recusou) ter sincronizado **depois do fim**, com a fila vazia. Sem isso, nenhuma comparação.
2. **Montagem.** O servidor deriva uma **versão por autor** a partir dos eventos: início, pausas (início, fim, motivo), fim, resultado e quantidade de evidências. A versão do responsável é a canônica.
3. **Fusão automática.** Valores dentro da **tolerância de 5 minutos** (`TOLERANCIA_MS`) valem como o mesmo; pausas se casam por sobreposição de horário. Fotos e evidências de vários aparelhos **somam**, sem conflito.
4. **Dois tipos de resultado:**
   - **`resumo`:** sobrou uma versão só, ou todas batem. Mostra "Isto é o que foi registrado" e pede **ciência** (um toque, sem assinatura). Não decide nada e não trava ninguém.
   - **`com_divergencia`:** sobraram diferenças. A tela de comparação mostra as versões lado a lado, com cada diferença destacada ("fim: 14:15 (Ana) · 15:00 (João)"), e o **padrão sugerido** (a conclusão mais antiga; a pausa registrada por quem estava no local). O responsável confirma ou troca com um toque. Itens que só um aparelho registrou aparecem como "aceitar" ou "descartar".
5. **Quem decide o quê.** O **responsável** decide horários e pausas. Se o **resultado** diverge (um suspendeu, outro encerrou), quem decide é o **supervisor**, porque muda o status da OS. Se o responsável é quem não sincronizou, o supervisor decide depois das 72 h.
6. **Assinaturas.** Decidido, a conferência vai para `aguardando_assinaturas`. Cada um dos outros participantes **assina** com a assinatura do perfil, ou assina **com ressalva** (texto livre). A ressalva não trava: vai ao supervisor, com aviso, e ao relatório.
7. **Aplicação.** A escolha é gravada nas tabelas canônicas (`execucao`, `execucao_pausa`), com o valor anterior guardado no `snapshot` (auditoria) e `recalcularStatusOs` rodando de novo.

### 5.4 Etapa 3C — Prazos, avisos e relatório

- **Prazos** (constantes em um só lugar): `AVISAR_FALTANTES_EM = 24 h e 48 h`, `LIBERAR_FECHAMENTO_EM = 72 h`, `LIMITE_DA_CONFERENCIA = 7 dias`. A tarefa de hora em hora confere os prazos, no molde de `conferirAusencias`.
  - **24 h e 48 h:** aviso ao participante que falta (sincronizar ou assinar) e ao responsável.
  - **72 h:** o responsável ou o supervisor ganha "Fechar com o que existe", que registra quem não sincronizou ou não assinou.
  - **7 dias:** fecha sozinha, no mesmo molde (o mesmo prazo de [`PRAZO_DO_PENDENTE_MS`](mobile/src/offline/sincronizar.ts#L24)). Um evento que chega depois fica guardado como "chegou tarde" e **não altera** o que foi fechado.
- **A assinatura final do supervisor** espera a conferência. Ela atesta o relatório, e o relatório inclui a conferência. Os **pontos** da execução e o encerramento do responsável **não esperam**.
- **Avisos** (sino e e-mail, categoria "Equipe"): conferência aberta (aos participantes), tempo esgotado e ressalva (ao supervisor). O e-mail pode ir porque a conferência dura horas ou dias.
- **Relatório da execução:** a seção "Conferência" com as versões comparadas, o que foi escolhido, por quem, as ciências e assinaturas, as ressalvas e quem não sincronizou. **Não vai para o PDF da OS** (a APR e a folha do SAP), como pedido.
- **Telas** (web e app): a lista "Para conferir" no perfil, a tela de comparação, a de resumo com ciência e a de assinatura. A Vitória explica a conferência em 2 frases quando a pessoa chega nela pela primeira vez.

### 5.5 Pronto quando

- Os dois cenários da conversa passam em teste: o do funcionário 1, 2 e 3 com horários diferentes (divergência) e o do funcionário 2 que fez tudo sozinho (resumo).
- Evento conflitante da fila offline nunca é recusado nem some; fica na versão divergente.
- Prazos testados com o relógio da `api` simulado; a conferência fecha nas 72 h e nos 7 dias.
- `pnpm conferir:sem-sinal` ampliado com a execução de dois aparelhos.

### 5.6 O que foi feito e o que mudou em relação ao plano

**Banco** (migração `0041_conferencia_da_execucao`, **uma só** no lugar da `0041` e da `0042`, gerada uma vez):

- `evento_campo.execucao_id` (a execução de que o evento trata) e `evento_campo.so_versao` (o evento ficou como versão de outro aparelho), mais um índice no `id` do payload.
- `conferencia_execucao`, `conferencia_decisao` e `conferencia_assinatura` (com os `CHECK`s de estado, tipo e prazos).
- `usuario.ultima_sincronizacao_em` e `usuario.fila_na_sincronizacao` (jsonb, quantos eventos esperavam por OS), gravados por `POST /sync/pull`.
- Seis avisos novos (`conferencia_aberta`, `_cobranca`, `_para_decidir`, `_para_assinar`, `_ressalva`, `_tempo_esgotado`), no sino e no e-mail, categoria Equipe.

**3A — nada é recusado.** [`EventoComoVersao`](api/src/dominio/eventos-base.ts) e [`resolverExecucaoId`](api/src/dominio/eventos-base.ts):

- **Sem id derivado da APR** (mudança em relação ao plano). Quando um participante inicia, sem sinal, uma execução cuja APR já amparou a do responsável, o `execucao_iniciada` dele vira **versão** da mesma execução (`evento_campo.execucao_id` aponta a de verdade), e os eventos seguintes dele, que citam o id local, chegam à execução certa. Funciona com qualquer id (web, app antigo) e não esbarra numa execução cancelada com o mesmo id. Com sinal, continua `apr_ja_usada`.
- Vindos da fila offline, também viram versão (nunca são recusados): a pausa com outra aberta, a pausa ou o fim antes do início, o fim de uma execução que outro aparelho já finalizou (encerrou, suspendeu ou interrompeu), a pausa que chega depois do fim, o fim da pausa que ficou como versão e o `encerramento_assinado` de quem encerrou num aparelho cujo fim ficou como versão (as fotos somam e a descrição preenche o que está em branco). Com sinal, os conflitos continuam recusados como antes.
- **Sem botão novo no app:** "Registrar a execução também neste aparelho" é o "Iniciar a execução" que a cópia offline já mostra (a APR ainda não está usada na cópia dele).

**3B — a conferência** ([`conferencia-execucao.ts`](api/src/dominio/conferencia-execucao.ts), [`conferencia-comparacao.ts`](api/src/dominio/conferencia-comparacao.ts) sem banco):

- **Quem a sincronização espera:** os participantes da APR que não recusaram e continuam ativos, e que **já usaram o app** (`ultima_sincronizacao_em` preenchido): cada um precisa ter sincronizado depois do fim, com a fila daquela OS vazia (o app manda `fila` no `pull`). Quem nunca baixou a cópia não tem fila offline e já está em dia.
- **Quando anda:** a cada evento processado, a cada `pull` e na tarefa de hora em hora; idempotente, com a linha travada (`for update`).
- **Responsável da conferência:** quem iniciou primeiro, se começou mais de 5 minutos antes do que a execução tem gravado; dentro da tolerância, quem a execução já tem. Ao aplicar, ele passa a ser o `executor_id`. (Plano: "menor `ocorrido_em`" e o supervisor decidindo se a diferença fosse pequena; ficou a regra da tolerância, sem decisão do supervisor.)
- **Campos:** início, fim, resultado e cada pausa. Padrão sugerido: o início e o fim mais antigos, o resultado de quem concluiu primeiro, a pausa do responsável. A pausa que **só um aparelho registrou e que veio sem sinal** pede confirmação (aceitar ou descartar); a registrada com sinal não. Fotos somam e não divergem.
- **Escolha:** o responsável decide horários e pausas, o supervisor decide o resultado (e, depois de 72 h, também o do responsável); pode ser em duas vezes. Aplicada nas tabelas da execução, com o que valia antes no `snapshot`, e o status da OS é recalculado.
- **Assinaturas:** todos os participantes menos o responsável: ciência no resumo (sem assinatura), assinatura do perfil com divergência; ressalva opcional avisa o supervisor e o responsável e vai ao relatório.
- **O supervisor assina por último** quando a conferência já montou: `POST /os/{id}/ciencia` só espera `aguardando_sincronizacao` e `aguardando_responsavel` (`409` `conferencia_pendente`), não as ciências e assinaturas (que são atestado, não dado). Refinamento da proposta do plano.

**3C — prazos, avisos e relatório:**

- Tarefa de hora em hora ([`conferirConferencias`](api/src/dominio/conferencia-execucao.ts)): aviso às 24 h e às 48 h a quem falta (sincronizar, escolher ou assinar) e ao responsável; aos 7 dias, a conferência fecha sozinha em todos os passos (monta, aplica o padrão sugerido, fecha sem os que faltaram) e avisa o supervisor.
- "Fechar com o que existe" (`POST /conferencias/{id}/fechar`), a partir de 72 h, pelo responsável (antes da montagem, quem a execução tem gravado) ou pelo supervisor: segue um passo sem quem falta e registra quem faltou.
- O relatório da execução ganhou a seção "CONFERÊNCIA DA EXECUÇÃO" (o que cada aparelho registrou, o que valeu e por quem, ciências, assinaturas, ressalvas e quem faltou); não entra no PDF da OS.

**Telas:**

- **Web** (`/app/os/{id}/conferencia`): trilha de etapas, o passo atual, as diferenças campo a campo por aparelho com o padrão sugerido e o que está valendo, a escolha (botão por opção, "Descartar a pausa" na de um aparelho só) com janela de confirmação, ciência ou assinatura com ressalva, "Fechar com o que existe", e a Vitória explicando a conferência na primeira vez. Cartão "Para conferir" no perfil, faixa na lista e no detalhe da OS, aviso no detalhe da OS, painel na gestão e a assinatura final do supervisor avisando quando espera a conferência. Regras puras em [`web/src/lib/conferencia.ts`](web/src/lib/conferencia.ts), testadas por `web/scripts/testar-conferencia.mts`.
- **App** (`os/[id]/conferencia`, [`mobile/src/conferencia/`](mobile/src/conferencia/)): duas páginas ("Diferenças", ou "Resumo" sem divergência, e "Equipe"), escolha por campo com o sugerido já marcado e janela de confirmação, ciência em um toque ou assinatura do perfil com ressalva opcional, "Fechar com o que existe", a Vitória explicando na primeira vez, cartão "Para conferir" no perfil, faixa em toda tela (consulta a cada 60 s, só online) e aviso no detalhe da OS. A conferência é uma tela online: sem sinal, "Conecte-se para conferir". Os 6 avisos levam a ela.

**Conferido em 20/10/2026:** 18 testes novos da `api` ([`conferencia-execucao.test.ts`](api/test/conferencia-execucao.test.ts): os três aparelhos com divergência, o resumo do "funcionário 2", o resultado que diverge, a pausa de um aparelho só, a pausa duplicada, os prazos de 24 h, 48 h, 72 h e 7 dias, e a comparação sem banco); teste do app para o `fila` no `pull`; 20 testes da regra do app e 7 casos novos do painel de ação (305 no total); 15 testes da regra da web; `pnpm conferir:conferencia` do app contra a `api` local (dois aparelhos registram sem sinal, o segundo vira versão, a conferência aparece com divergência, o responsável escolhe, o outro assina com ressalva e ela conclui); `tsc` da `api`, da web e do app limpos. Nada foi visto num aparelho nem num navegador.

**Cuidados e o que fica para depois:**

- Trocar o **resultado** pela conferência (encerrada ↔ suspensa) não recalcula os pontos já dados, e quem passa a ser "quem encerrou" assina o encerramento de novo (a tela de encerramento reabre para ele).
- A conferência compara início, fim, resultado e pausas. A descrição, o checklist e as fotos de outros aparelhos ficam guardados no `evento_campo` (as fotos somam na execução); não são comparados.
- O evento que chega depois de a conferência montar fica guardado e não altera o que foi decidido; a tela não o mostra.
- Quem tem a conta desativada não trava a conferência. Quem usou o app uma vez e depois só usa a web espera até o fechamento com o que existe.
- O histórico do técnico (`GET /me/historico`) ainda conta a execução pelo responsável.

## 6. Pontos em aberto

- **Prazo de espera (decisão 10).** 72 h para liberar o fechamento cobre um serviço de sexta com a equipe só de volta na segunda (cerca de 60 h) e casa com os 3 dias do representante e os 7 dias da fila offline. É proposta; o Iago confirma se o ritmo de folgas e turnos pede mais.
- **"Continuar" depois de pausa por saúde.** Proposta: qualquer participante continua, com confirmação reforçada ("[nome] pausou por lesão: confirme que dá para voltar"). Pode ser mais rígido: só o supervisor ou o próprio acidentado.
- **Pausa de rotina como pedido.** O "sim" da conversa foi lido como "imediata". Se não for, a mudança é uma linha (`ACOES_COM_PEDIDO`).
- **Resultado divergente decidido pelo supervisor** (seção 5.3, item 5): proposta minha, porque o resultado muda a OS. Confirmar.
- **O supervisor assina só depois da conferência** (seção 5.4): proposta minha, para o relatório estar completo quando ele assinar.
- **Aparelhos sem Google Play Services** (comuns em PDA industrial) inviabilizam push com Firebase. Fica para depois do MVP; a consulta periódica atende até lá. Perguntar à TI qual aparelho será usado.
- **Fazer pedido sem sinal no meio dos 2 minutos.** O pedido já está no servidor e vence sozinho. O aparelho só deixa de ver a resposta até o sinal voltar.

## 7. Ordem e esforço

| Etapa | O que entrega | Migração | Depende de |
|---|---|---|---|
| 1 | Acompanhar | não | — |
| 2 | Agir, online | `0040` | 1 |
| 3A | Versões de outros aparelhos (sem id derivado) | `0041` (única das três) | 2 |
| 3B | Conferência | `0041` | 3A |
| 3C | Prazos, avisos e relatório | não | 3B |

- A Etapa 1 pode entrar sozinha no piloto. A 2 é a que tira a dependência do responsável. A 3 só importa para quem trabalha sem sinal e é a mais cara: se o tempo apertar, a 3A e uma versão enxuta da 3B (resumo e divergência de horário do fim, sem pausas) já cobrem os dois cenários da conversa.
- **Cada migração é gerada uma vez**, depois de fechar o desenho, e nunca regerada (o banco de dev é o Supabase compartilhado e aplica na hora).
- **Validação:** `tsc`, `eslint` e testes da `api`, `web` e `mobile`; scripts `conferir:*` contra a `api` local. Sem abrir navegador.
