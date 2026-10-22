# Gamificação e treinamentos de serviço

Pontos, patentes, temporadas, ranking, conquistas e os treinamentos de serviço (a explicação da Vitória e os minijogos), com a validação pelos supervisores e o rascunho pela IA. Como o sistema é construído (tabelas, eventos, contratos) está na [especificação](especificacao.md); o que falta e o que está em aberto, no [pendencias.md](../pendencias.md).

## 1. Visão e princípios

A gamificação premia o trabalho de campo seguro e o conhecimento dos serviços. Entram pontuação, patentes, ranking por temporada e geral, conquistas (troféus) e a gamificação por equipe. Os treinamentos de serviço são jogos curtos por serviço do catálogo, que valem alguns pontos e têm ranking próprio.

### 1.1 Regras do jogo

1. **A segurança não custa pontos.** APR bloqueada vale o mesmo que aprovada, e execução interrompida por risco vale o mesmo que encerrada, com os mesmos bônus. Nenhuma regra dá pontos a mais por bloquear ou interromper (faria bloquear para não trabalhar) nem tira pontos por isso (faria marcar tudo "certo").
2. **O técnico continua sem saber o que é eliminatório.** Nenhuma regra nem conquista olha a resposta de um item da APR.
3. **Só o servidor calcula.** Os pontos saem dos registros gravados, na mesma transação que os grava. O aparelho nunca envia pontuação, e reenviar um evento não pontua de novo.
4. **Quem quiser fica anônimo no ranking.** Os pontos continuam valendo para a pessoa e para a equipe.
5. **O admin ajusta as regras:** o valor de cada tarefa, as patentes e as conquistas, cada um no seu cadastro.
6. **Quem trabalha mais ganha mais.** A pontuação soma tarefas; quem tem mais OS recebe mais pontos.
7. **O admin não joga.** Só o perfil `tecnico` pontua (supervisores inclusos, porque supervisor é papel, não perfil); o admin não pontua e não aparece nos rankings.

Os textos dessas regras, em linguagem simples, ficam em `REGRAS_DO_JOGO` ([regras-de-pontuacao.ts](../api/src/dominio/regras-de-pontuacao.ts)) e aparecem na aba "Como pontuar".

### 1.2 Onde aparece

| Onde | O que tem |
|---|---|
| Web, seção **Gamificação** (`/app/gamificacao`) | abas Minha pontuação (só de quem joga), Ranking, Conquistas, Patentes e Como pontuar. O admin começa pelo Ranking e edita ali mesmo as tarefas, as patentes e as conquistas |
| Web, barra superior | o selo da patente com os pontos da temporada (técnico, fora do Campo de treino), que leva a Minha pontuação |
| Web, perfis e equipe | a patente, a maior patente e as conquistas no perfil de outra pessoa; o bloco da equipe (soma, média, patente, posição, conquistas e os pontos de cada membro); a opção "Aparecer como anônimo no ranking" em Meu perfil |
| Telas de APR, execução, assinatura do supervisor e ciclo das preventivas | o aviso "+N pontos" depois da ação |
| App, aba **Pontos** | Minha pontuação (com o extrato por temporada), Ranking de pessoas e de equipes e Conquistas, só para consulta; a janela de conquista e nova patente; o "+N pontos"; o anonimato no perfil. Os cadastros ficam só na web |
| Catálogo › Serviços (web) | os treinamentos de serviço: jogar, ver o ranking, criar, validar e publicar (seção 8). O app não tem os treinamentos |

No Campo de treino, a API fictícia não pontua e responde `404` às rotas da gamificação; nenhuma tela do treino depende dos pontos.

## 2. Pontuação

### 2.1 Tarefas que pontuam

A lista é fixa no código (`REGRAS` e `ORDEM_DAS_REGRAS` em [regras-de-pontuacao.ts](../api/src/dominio/regras-de-pontuacao.ts); as regras em [pontuacao.ts](../api/src/dominio/pontuacao.ts)). O admin muda só o valor e o estado de cada uma. Os pontos abaixo são os da carga inicial.

| Grupo | Tarefa (código) | Quem ganha | Pontos | Quando conta | Limite |
|---|---|---|---|---|---|
| Principais | APR completa (`apr_completa`) | todos os participantes da APR que não recusaram | 10 | ver 2.2 | uma por pessoa, por OS |
| Principais | Execução concluída (`execucao_concluida`) | todos os participantes da APR que amparou a execução | 10 | ver 2.2 | uma por pessoa, por OS |
| Bônus da OS | Responsável pela APR (`responsavel_apr`) | o participante `responsavel` | 5 | junto com a APR completa, aprovada ou bloqueada | uma por pessoa, por OS |
| Bônus da OS | Preventiva concluída (`preventiva_concluida`) | quem tem a execução concluída numa OS preventiva, inclusive quem interrompeu por risco | 10 | junto com a execução concluída | uma por pessoa, por OS |
| Bônus da OS | Preventiva em dia (`preventiva_em_dia`) | todos os que concluíram a execução na OS, inclusive quem interrompeu por risco antes | 5 | quando a preventiva é encerrada em dia (2.3) | uma por pessoa, por OS |
| Bônus da OS | Local crítico (`local_critico`) | quem tem a execução concluída | 5 | junto com a execução concluída, se o local da OS é crítico | uma por pessoa, por OS |
| Bônus da OS | Resgate (`resgate`) | quem conclui a execução de uma OS pendente por APR bloqueada ou interrupção **de outras pessoas** | 5 | junto com a execução concluída (2.3) | uma por pessoa, por OS |
| Bônus da OS | Apoio a outra equipe (`apoio`) | quem conclui a execução de uma OS de apoio | 5 | junto com a execução concluída | uma por pessoa, por OS |
| Bônus da OS | Técnico novo acompanhado (`tecnico_novo`) | o responsável pela APR | 5 | junto com a APR completa, se outro participante tem a conta há menos de 60 dias (`DIAS_DO_TECNICO_NOVO`) | uma por OS |
| Boas-vindas | Assinatura cadastrada (`assinatura_cadastrada`) | o técnico | 5 | ao cadastrar a assinatura no perfil | uma por conta |
| Boas-vindas | Campo de treino concluído (`treinamento_concluido`) | o técnico | 10 | quando o treino passa a concluído | uma por conta |
| Treinamentos | Treinamento de serviço concluído (`treinamento_servico_concluido`) | o técnico, inclusive quem aguarda liberação | 5 | na primeira conclusão do treinamento (8.8) | uma por treinamento |
| Treinamentos | Fases certas no treinamento (`treinamento_servico_fases`) | o técnico, inclusive quem aguarda liberação | 1 por fase certa, até 10 | junto com o concluído | um lançamento por treinamento |
| Supervisor | Assinatura final no prazo (`ciencia_no_prazo`; na tela, "Ciência no prazo") | o supervisor que assina por último a OS | 3 | até 72 h (`HORAS_DA_CIENCIA`) depois do fim da execução encerrada | uma por OS |
| Supervisor | Intervalo de preventiva definido (`intervalo_definido`) | quem definiu | 3 | ao definir o intervalo de um plano que estava sem | uma por plano |
| Colaboração | Sugestão de materiais aceita (`sugestao_materiais_aceita`) | o autor da sugestão ou da contestação | 30 (a confirmar; ver [pendencias.md](../pendencias.md)) | quando o supervisor aceita, com ou sem ajuste; enviar não pontua | uma por pessoa e serviço a cada 30 dias |
| Colaboração | Sugestão de materiais avaliada (`sugestao_materiais_avaliada`) | o supervisor que avaliou | 3 (a confirmar; ver [pendencias.md](../pendencias.md)) | ao aceitar **ou recusar** (o ponto é por responder, para a fila não parar) | uma por sugestão |
| Conquistas | Conquista obtida (`conquista_obtida`) | a pessoa | o valor de cada conquista | quando a conquista é concedida | uma por conquista |

- **`conquista_obtida` não tem valor próprio:** os pontos vêm de cada conquista; desativar a tarefa desliga os pontos de todas. Conquistas de equipe não dão pontos.
- **Sugestão de materiais:** as aceitas dentro dos 30 dias atualizam a lista, mas só a primeira pontua. O fluxo da sugestão está em [operacao-de-campo.md](operacao-de-campo.md).
- **A assinatura final do supervisor** (que substituiu a antiga "ciência", Reunião 3) é dada por quem supervisiona a equipe da OS, mesmo que tenha participado do serviço: não há recusa por ter participado. O admin pode assinar, mas não pontua. O fluxo está em [operacao-de-campo.md](operacao-de-campo.md).

### 2.2 Quando a APR e a execução pontuam

- **APR aprovada:** pontua quando o último participante assina na própria conta (o evento `apr_assinada` que completa as assinaturas). Se as assinaturas vieram presenciais, no aparelho do responsável (contingência offline), pontua quando a APR chega.
- **APR bloqueada:** pontua quando chega a evidência completa dos itens reprovados (ou já com a APR, se ela veio com a evidência). Sem a evidência, não pontua, o que também incentiva enviá-la.
- **A data do lançamento da APR** é a do evento que a completou.
- **Execução encerrada:** pontua quando quem encerrou **assina o encerramento** (`encerramento_assinado`), junto com os bônus. Vale a primeira execução encerrada e assinada da OS; uma segunda (duplicada vinda do modo offline) fica guardada, sem pontuar.
- **Execução interrompida por risco:** pontua na hora da interrupção, com os mesmos bônus (menos a preventiva em dia, que só sai quando a OS é encerrada).
- **A data do lançamento da execução** é o fim da execução, não a hora da assinatura.

### 2.3 Detalhes dos bônus

- **Preventiva concluída** é uma tarefa própria, e não um multiplicador, para o admin ajustar o valor como os demais. A preventiva vale o dobro da corretiva enquanto ela valer o mesmo que a execução concluída: se o admin mudar uma, convém mudar a outra.
- **Preventiva em dia:** a OS foi encerrada até a data limite (o fim programado ou, sem ele, o início, como no indicador de preventivas), ou depois com atraso justificado: houve reprogramação, ou, até a data limite, uma APR bloqueada, uma execução interrompida ou uma suspensa. Vai a todos os participantes de todas as execuções encerradas ou interrompidas da OS.
- **Resgate:** conta só a pendência por APR bloqueada ou execução interrompida. Quem participou de alguma tentativa anterior da OS não ganha. A suspensão no fim do expediente não conta (é rotina; se contasse, bastaria trocar quem vai no dia seguinte).
- **O limite por OS mantém a segurança neutra:** quem bloqueia e refaz a APR, ou interrompe e retoma, recebe o mesmo que quem fez tudo de uma vez; esticar o serviço por vários dias não soma APRs.

### 2.4 O que não pontua

A lista inteira aparece na aba "Como pontuar" (`NAO_PONTUAM`, [regras-de-pontuacao.ts](../api/src/dominio/regras-de-pontuacao.ts)):

| O quê | Por quê |
|---|---|
| Sincronização offline → online | pontuaria desligar o sinal de propósito, e o sistema é online primeiro. O que foi feito offline pontua normalmente quando chega. Só há o troféu de 0 ponto (7.5) |
| Iniciar a execução | premiaria começar sem terminar |
| Pausa, suspensão e cancelamento por engano | a OS continua; os pontos vêm quando a execução é concluída |
| Evidência a mais, observação e descrição longas | inflariam anexos e textos de enchimento |
| Bônus por bloqueio ou interrupção | faria bloquear para não trabalhar |
| Ler o alerta de bloqueio e tratar a OS pendente (supervisor) | dependeriam do número de bloqueios da equipe |
| Reprogramar e abrir OS de apoio | são decisões de planejamento; pontuar empurraria a decisão |
| Assinatura final depois de 72 h | o ponto é pela assinatura em dia |
| Entrar no sistema todo dia | não é trabalho |
| Checklist de inspeção da preventiva | é obrigatório para encerrar; um bônus pontuaria o encerramento duas vezes |
| Enviar a sugestão ou a contestação de materiais | premiaria enviar muito, não enviar bem |
| Ações do admin | o admin não joga |
| Criar ou validar treinamento de serviço | ainda não decidido (ver [pendencias.md](../pendencias.md)) |

### 2.5 Como chegamos nesses valores

- **APR e execução valem o mesmo (10):** num sistema de segurança, a APR é tão importante quanto o serviço.
- **Os bônus valem 5,** metade de uma tarefa principal. Responsável pela APR: quem lidera responde por ela (a Reunião 2 lembra que sempre há um líder). Preventiva em dia: é o indicador que a gerência acompanha (Reunião 1). Local crítico: os locais que a gerência prioriza. Técnico novo: incentiva levar os novos junto com quem tem experiência.
- **As ações do supervisor valem 3:** são rápidas. Uma equipe com 80 OS por mês dá ao supervisor uns 700 pontos por temporada só com a assinatura final: ele não domina o ranking nem some dele.
- **As boas-vindas** (assinatura 5, Campo de treino 10) dão os primeiros pontos no primeiro dia.
- **A sugestão de materiais aceita (30)** vale um pouco mais que uma OS média, porque o incentivo é à colaboração.
- **Treinamento de serviço: no máximo 15 por treinamento,** metade de uma OS: conhecimento vale, mas trabalho em campo vale mais.

Exemplos (pontos de cada participante):

| Cenário | Pontos |
|---|---|
| Corretiva sem bônus | APR 10 + execução 10 = **20** |
| Preventiva em dia, em local crítico, como responsável pela APR | 10 + 10 + 10 (preventiva) + 5 + 5 + 5 = **45** |
| A APR bloqueia; a APR nova aprova e a OS é encerrada | 10 + 10 = **20** (o mesmo) |
| Interrompe por risco numa preventiva; outra pessoa retoma e encerra (atraso justificado) | quem interrompeu: 10 + 10 + 10 + 5 = **35**; quem retomou: 10 + 10 + 10 + 5 + 5 (resgate) = **40** |
| Serviço de 3 dias, suspenso no fim de cada expediente | **20** mais os bônus: as APRs dos outros dias não somam |
| Preventiva atrasada sem justificativa | 10 + 10 + 10 = **30** |

### 2.6 Extrato de pontos

- **Cada pontuação é uma linha do extrato** (`lancamento_pontos`), gravada por `lancar` ([lancamentos.ts](../api/src/dominio/lancamentos.ts)), a única porta de escrita, na transação do que gerou a pontuação.
- **Uma chave por pessoa:** `apr:<os>`, `responsavel:<os>`, `tecnico_novo:<os>`, `execucao:<os>`, `preventiva_concluida:<os>`, `preventiva:<os>` (em dia), `local_critico:<os>`, `resgate:<os>`, `apoio:<os>`, `assinatura`, `treinamento`, `treinamento_servico:<id>`, `treinamento_servico_fases:<id>`, `ciencia:<os>`, `intervalo:<plano>`, `sugestao_materiais:<serviço>:<id>`, `avaliacao_materiais:<id>` ou `conquista:<id>`. A chave é única por pessoa, então o limite de cada tarefa e a proteção contra reenvio são a mesma restrição.
- **O lançamento guarda os pontos do momento.** Mudar o valor de uma tarefa vale dali em diante; tarefa desativada não lança.
- **A data do lançamento** é quando a tarefa aconteceu, no fuso de São Paulo, e define a temporada. Data no futuro (relógio errado no aparelho) é trazida para o relógio da `api`; data de temporada já fechada (ou fora da tolerância) entra na temporada aberta.
- **Equipes creditadas** (`lancamento_equipe`): a equipe da pessoa naquele momento e todas as equipes que ela supervisiona. Quem muda de equipe deixa os pontos onde os fez.
- **Implantação:** com o extrato vazio, a subida da `api` preenche o extrato a partir do histórico (APRs, execuções, assinaturas finais, treinos, assinaturas e planos), com as mesmas funções de pontuação e numa transação só; as temporadas passadas nascem fechadas ([gamificacao-historico.ts](../api/src/db/seed/gamificacao-historico.ts)).
- **Remover um usuário** apaga o extrato, as conquistas e os resultados de temporada dele (`apagarGamificacaoDaPessoa`).
- **A pessoa vê o próprio extrato** ("APR da OS 4019821 — 10 pontos"), com filtro por temporada.

## 3. Patentes

### 3.1 Regras

- **Valem na temporada** e zeram com ela. No geral aparece a **maior patente já alcançada** (a maior gravada nos fechamentos e a da temporada aberta).
- **A patente da pessoa** é a de maior pontuação necessária que ela atingiu na temporada (`patenteDosPontos`, [patentes.ts](../api/src/dominio/patentes.ts)). Abaixo da primeira, "Sem patente"; com a carga inicial isso não acontece, porque Bronze começa em 0.
- **A equipe usa a mesma escada,** aplicada à média por membro (seção 6), e também guarda a maior patente já alcançada.
- **Mudar uma patente** vale na hora para a temporada aberta; as fechadas guardam a patente gravada no fechamento.

### 3.2 Cadastro (admin)

| Campo | Regra |
|---|---|
| Nome | obrigatório, único |
| Pontuação necessária | inteiro ≥ 0, único entre as ativas; define a ordem |
| Imagem das pessoas | obrigatória; PNG, JPEG ou WebP, até 5 MB (`LIMITE_DA_IMAGEM`), quadrada, de 64 a 4096 px de lado (512 × 512 recomendado); aparece no ranking de pessoas, no perfil, na barra e nos membros da equipe |
| Imagem das equipes | obrigatória, enviada à parte, com as mesmas regras; aparece no ranking de equipes e no bloco da equipe. Só é igual à das pessoas se o admin enviar a mesma imagem nos dois campos |
| Cor | hexadecimal; destaca o nome e a barra de progresso |
| Descrição | opcional |
| Ativa | a desativada deixa de ser atribuída, mas continua no histórico |

Excluir só vale para a patente que nunca foi gravada numa temporada fechada nem é meta de uma conquista (`409 patente_em_uso`); nos outros casos, o admin a desativa. As imagens ficam no bucket privado `gamificacao` ([gamificacao-cadastros.ts](../api/src/dominio/gamificacao-cadastros.ts)).

### 3.3 Carga inicial

| Patente | Pontuação necessária | O técnico médio chega em | Cor |
|---|---|---|---|
| Bronze | 0 | na largada | `#CD7F32` |
| Prata | 300 | ~1 semana | `#A8A9AD` |
| Ouro | 1.500 | ~5 semanas | `#D4AF37` |
| Platina | 3.000 | ~11 semanas | `#9DB4C0` |
| Diamante | 5.000 | só quem rende cerca de 40% acima da média | `#4FC3F7` |

Os dados estão em `PATENTES_DA_CARGA` ([gamificacao-dados.ts](../api/src/db/seed/gamificacao-dados.ts)), com uma medalha (pessoas) e um brasão (equipes) simples por metal, que o admin pode trocar.

- **Volume:** a Reunião 1 registra de 200 a 409 OS encerradas por mês, quase todas preventivas; a Reunião 2, no máximo 3 pessoas por atividade.
- **Suposições:** 2 participantes por OS, cerca de 20 técnicos, 90% preventivas e quase todas em dia, 30% em locais críticos, responsável pela APR em metade das OS. Dá uns 120 OS por técnico por temporada, a cerca de 29 pontos cada: o técnico médio fica em torno de 3.600 pontos por temporada.
- **A curva começa rápida e fica difícil no fim:** a primeira subida vem na primeira semana, e o Diamante fica para 10% a 15% dos técnicos. Os limites precisam ser revistos no fim da primeira temporada real (ver [pendencias.md](../pendencias.md)).

## 4. Temporadas

- **Uma temporada é um trimestre do calendário,** no fuso de São Paulo ([temporadas.ts](../api/src/dominio/temporadas.ts)). O nome vem da estação que ocupa a maior parte do trimestre: T1 Verão, T2 Outono, T3 Inverno, T4 Primavera (`2026-T4` é a Primavera 2026). Trimestre do calendário, e não as datas das estações, porque elas mudam de dia a cada ano e os relatórios da empresa são por mês e trimestre.
- **O que zera:** os pontos e a patente da temporada. **O que fica:** os pontos gerais, a maior patente e as conquistas.
- **Fechamento:** a temporada fecha no dia seguinte ao fim da tolerância de 7 dias depois do último dia (`TOLERANCIA_DIAS`, para a fila offline), conferido de hora em hora pelo executor de tarefas (`fecharTemporadasVencidas`, [fechamento-temporada.ts](../api/src/dominio/fechamento-temporada.ts)).
- **O fechamento grava** os pontos, a patente e a posição de cada pessoa com pontos e de cada equipe (com o número de pessoas, a média e se foi impecável), e confere as conquistas de temporada. Quem foi desativado antes do fechamento não entra; quem é desativado depois continua no resultado gravado.
- **Temporada impecável:** a equipe teve preventivas programadas no trimestre e nenhuma ficou atrasada sem justificativa.

## 5. Ranking

| Ranking | Ordena por | Mostra |
|---|---|---|
| Pessoas — temporada | pontos da temporada | posição, nome, equipe, patente e pontos |
| Pessoas — geral | pontos gerais | posição, nome, equipe, maior patente e pontos |
| Equipes — temporada | média por membro | posição, equipe, patente, média, soma e número de pessoas |
| Equipes — geral | média geral por membro | posição, equipe, maior patente, média, soma e número de pessoas |

- **Temporadas fechadas** podem ser consultadas como ficaram no fechamento.
- **Empate entre pessoas:** fica na frente quem chegou primeiro àquela pontuação (o último lançamento mais antigo); depois, o nome. **Entre equipes:** a soma e depois a data do último lançamento.
- **Quem aparece:** técnicos ativos e liberados, supervisores inclusos (`pessoasElegiveis`, [ranking.ts](../api/src/dominio/ranking.ts)). O admin não aparece; quem aguarda liberação não aparece; quem é desativado sai dos rankings abertos e continua nas temporadas fechadas.
- **Anônimo:** os outros veem "Participante anônimo", sem equipe nem link (`mascararPessoa`); a própria pessoa e o admin veem o nome. Para os outros, o perfil da pessoa anônima também não mostra a patente nem as conquistas.
- **Todos os perfis veem os rankings.** É a exceção à regra de que o técnico não vê desempenho por pessoa: o ranking e o bloco da equipe mostram pontos e patente, nunca os indicadores.

## 6. Equipe

- **Soma:** tudo o que foi creditado à equipe (os pontos dos membros enquanto eram membros e os do supervisor, que conta integralmente em cada equipe que supervisiona).
- **Média por membro:** a soma dividida pelas pessoas da equipe, que são os técnicos ativos e liberados mais o supervisor, quando ele não é membro. A temporada aberta usa as pessoas de hoje; a fechada, o número gravado no fechamento. Quem foi desativado deixa os pontos na soma, mas sai da divisão.
- **Patente da equipe:** a escada de patentes aplicada à média, com a imagem das equipes. **Maior patente:** a maior que a média já alcançou (`maioresPatentesDasEquipes`); equipe sem pontos mostra a primeira da escada.
- **Ranking pela média,** para a equipe maior não ganhar só por ser maior. Equipe sem ninguém fica fora.
- **Conquistas próprias,** com critérios de equipe (7.3), que não dão pontos.

## 7. Conquistas

### 7.1 Regras

- **Troféus de pessoa e de equipe,** permanentes: não zeram com a temporada. Não há conquista secreta.
- **Valem para o passado:** ao criar, editar ou reativar uma conquista, o servidor confere todo mundo. Quem já tinha batido a meta recebe na hora, com a data em que bateu (lida do extrato), e os pontos entram na temporada aberta.
- **Quando o servidor confere:** a cada lançamento novo (para a pessoa e as equipes creditadas), no fechamento da temporada, ao aplicar cada evento que chegou pela fila offline (só para quem o enviou) e nos cadastros do admin ([conquistas.ts](../api/src/dominio/conquistas.ts)). A conferência repete até estabilizar, porque os pontos de uma conquista podem cumprir a meta de outra.
- **Editar a meta:** quem já tem não perde; se a meta baixar, quem passa a cumpri-la recebe. Mudar os pontos vale dali em diante.
- **Desativar:** deixa de ser dada; quem tem continua com ela. Excluir só vale se ninguém a tiver (`409 conquista_em_uso`).
- **Na tela:** as obtidas coloridas, com a data; as que faltam em cinza, com a meta e o progresso (37/50); todas com a raridade (a fração dos técnicos ativos, ou das equipes, que a têm) e os pontos.
- **Aviso:** "Conquista desbloqueada" e "Nova patente" na próxima vez que a pessoa abrir a web ou o app.

### 7.2 Cadastro (admin)

Título (único), descrição, meta (um critério de 7.3 e a quantidade, ou a patente nos critérios de patente; a tela mostra a meta em texto, como "Complete 50 APRs", por `textoDaMeta`), imagem do troféu (as mesmas regras das patentes: até 5 MB, quadrada), pontos (inteiro ≥ 0; sempre 0 nas de equipe) e ativa. O critério diz se a conquista é de pessoa ou de equipe, e uma não vira a outra.

### 7.3 Critérios da meta

A lista é `CRITERIOS_INFO` ([conquistas.ts](../api/src/dominio/conquistas.ts)). Nenhum critério conta bloqueios ou interrupções de quem bloqueou ou interrompeu.

| Critério | Tipo | O que conta |
|---|---|---|
| `aprs_completas`, `responsavel_apr`, `execucoes_concluidas`, `preventivas_em_dia`, `locais_criticos`, `os_retomadas`, `os_apoio`, `tecnicos_novos` | pessoa | os lançamentos da tarefa correspondente (2.1) |
| `ciencias_no_prazo`, `intervalos_definidos` | pessoa | os lançamentos de assinatura final no prazo e de intervalo definido |
| `campo_de_treino` | pessoa | o Campo de treino concluído (sem quantidade) |
| `treinamentos_servico_concluidos` | pessoa | os treinamentos de serviço concluídos |
| `treinamentos_gabaritados` | pessoa | os treinamentos com todas as fases certas na tentativa que pontuou, se ela for também a primeira tentativa aberta daquele treinamento (abandonar a primeira e gabaritar a segunda não conta) |
| `sincronizacoes_offline` | pessoa | OS distintas com ao menos um evento da pessoa que chegou pela fila (7.5) |
| `locais_diferentes` | pessoa | locais de instalação distintos com execução concluída |
| `pontos_gerais` / `pontos_numa_temporada` | pessoa | os pontos desde a criação da conta / a melhor temporada |
| `patente` | pessoa | a melhor temporada alcança a pontuação atual da patente-meta |
| `posicao` | pessoa | terminar uma temporada fechada entre os N primeiros |
| `temporadas` | pessoa | temporadas com ao menos 1 ponto |
| `aprs_da_equipe`, `execucoes_da_equipe`, `preventivas_em_dia_da_equipe` | equipe | OS distintas com o lançamento creditado à equipe |
| `pontos_gerais_da_equipe` | equipe | a soma geral |
| `patente_da_equipe` | equipe | a média alcança a patente-meta numa temporada |
| `posicao_da_equipe` | equipe | terminar uma temporada fechada entre as N primeiras |
| `temporadas_impecaveis` | equipe | temporadas fechadas impecáveis (seção 4) |

### 7.4 Carga inicial

Os dados ficam em `CONQUISTAS_DA_CARGA` ([gamificacao-dados.ts](../api/src/db/seed/gamificacao-dados.ts)), em [treinamento-servico-dados.ts](../api/src/db/seed/treinamento-servico-dados.ts) e em [sincronizacao-offline-dados.ts](../api/src/db/seed/sincronizacao-offline-dados.ts). Entram uma vez por banco, pelas migrações: o que o admin apagar ou ajustar não volta. Cada uma vem com uma imagem simples, gravada pela subida da `api` se faltar.

**Pessoa**

| Título | Meta | Pontos |
|---|---|---|
| Primeiro passo | 1 APR completa | 25 |
| Olho vivo | 50 APRs completas | 50 |
| Guardião da APR | 500 APRs completas | 100 |
| Líder de campo | 50 vezes responsável pela APR | 50 |
| Mão na massa | 50 execuções concluídas | 50 |
| Veterano de campo | 500 execuções concluídas | 100 |
| Relógio suíço | 25 preventivas em dia | 50 |
| Ponto crítico | 25 OS em locais críticos | 50 |
| Resgate | 5 OS retomadas | 50 |
| Reforço | 3 OS de apoio | 50 |
| Mentor | 10 técnicos novos acompanhados | 50 |
| Explorador | 20 locais diferentes | 50 |
| Pronto para o campo | Campo de treino concluído | 25 |
| De olho na equipe | 50 assinaturas finais no prazo | 50 |
| Planejador | 10 intervalos definidos | 50 |
| Pódio | posição ≤ 3 numa temporada | 100 |
| Brilho de diamante | patente Diamante numa temporada | 100 |
| Aprendiz | 3 treinamentos de serviço concluídos | 25 |
| Especialista | 10 treinamentos de serviço concluídos (o sistema não liga serviços a equipes, então não é "todos os serviços da equipe") | 50 |
| Nota máxima | 1 treinamento gabaritado na primeira tentativa | 25 |
| Sem sinal, sem problema | 1 OS sincronizada depois de trabalhar sem sinal | **0** |

**Equipe** (sem pontos): Equipe em campo (100 execuções da equipe), Plano em dia (100 preventivas em dia da equipe), Temporada impecável (1 temporada impecável), Equipe de ouro (patente Ouro da equipe), Equipe diamante (patente Diamante da equipe) e Campeã da temporada (posição 1 numa temporada).

### 7.5 Conquista de sincronização offline

- **Vale 0 ponto, de propósito:** sincronizar não pontua (2.4). O admin pode dar pontos a ela no cadastro, mas o risco é premiar desligar o sinal de propósito.
- **Quem marca a origem é a `api`:** ao aplicar um evento com mais de 60 s entre o relógio do aparelho e o da `api` (`ATRASO_OFFLINE_MS`), grava `evento_campo.offline`. O aparelho não diz que veio da fila. O evento recusado não deixa linha, então não conta.
- **Conta OS distintas,** não eventos. A data do troféu é a chegada do primeiro evento da OS ao servidor.
- **Vale para o passado:** os eventos já gravados com atraso maior que 60 s foram marcados como offline, e quem os tinha recebeu o troféu, sem lançamento.
- **Limite conhecido:** um aparelho com o relógio atrasado mais de 60 s também gera evento "offline". Como o troféu é um só e vale 0 ponto, os dois casos não são separados.

## 8. Treinamentos de serviço

### 8.1 Regras

1. **Um treinamento por serviço do catálogo** (a `atividade`), com versões, como o modelo de APR: rascunho → publicada → substituída. A versão publicada não muda; editar cria um rascunho a partir dela, que passa de novo pela validação (8.10).
2. **Duas partes:** a explicação, narrada pela Vitória, e o jogo, com os minijogos.
3. **Quem treina:** os técnicos, supervisores inclusos, e quem aguarda liberação (pratica enquanto espera, na tela de espera, ao lado do Campo de treino). O admin não joga, só testa o rascunho.
4. **Só o servidor corrige e pontua.** O gabarito não chega ao aparelho antes da resposta (com a exceção controlada de 8.5).
5. **O técnico continua sem saber o que é eliminatório.** O treinamento ensina o comportamento seguro ("pare se houver vazamento"), não o mapa dos itens da APR.
6. **Nomes:** tudo usa `treinamento_servico` / `treinamento-servico`, para não confundir com o Campo de treino (o tutorial fictício, outra funcionalidade).

Os 10 treinamentos fictícios da demonstração estão em [demonstracao/treinamentos-ficticios.md](demonstracao/treinamentos-ficticios.md).

### 8.2 Quem cria e o editor

- **Criam o treinamento de um serviço:** o admin e o supervisor (ou o representante no comando) de uma equipe que já faz o serviço, isto é, que tem OS dele fora as canceladas e as devolvidas (`podeCriarTreinamento`, [treinamento-servico-validacao.ts](../api/src/dominio/treinamento-servico-validacao.ts)). Técnico e supervisor de equipe que nunca fez o serviço ficam de fora.
- **O rascunho é de quem o criou.** Há um rascunho por serviço; só o autor e o admin o editam. Outro supervisor recebe `403 rascunho_de_outra_pessoa` ("O rascunho deste treinamento é de {nome}").
- **O editor** fica em Catálogo › Serviços › {serviço} › treinamento: a visão geral (o caminho até publicar: Conteúdo, Validação, Teste e Publicação), Criar (a escolha entre "Gerar com a Vitória" e "Criar manualmente"), Gerar, as abas Explicação, Fases do jogo, Revisão, Versões e Problemas, e Publicar. Sem a IA disponível, "Gerar com a Vitória" fica desativado com o motivo.
- **O editor manual é a base;** a IA só preenche um rascunho no mesmo formato (seção 9). Sem a IA, tudo continua.
- **Abrir as telas de consulta não cria versão:** só as abas de edição, Criar e Gerar criam o rascunho quando ele não existe.
- **"Testar o jogo"** abre o jogo do rascunho na mesma janela de quem treina, sem pontuar e sem ranking. Testam o admin, o autor e os validadores da rodada.

### 8.3 Parte 1: a explicação

- **De 1 a 12 passos** para publicar, cada um com texto (até 600 caracteres), a reação da Vitória ao mostrar o passo e, se quiser, uma imagem. A capa pode ter a imagem do cenário.
- **A reação** é uma das 7 chaves (`EXPRESSOES_VITORIA`): `padrao`, `feliz` e `explicando` não animam; `pensando`, `alerta`, `comemorando` e `ops` tocam a figurinha ao mostrar o passo. As figurinhas são as da Vitória ([ia-e-vitoria.md](ia-e-vitoria.md)).

### 8.4 Parte 2: os minijogos

O jogo tem **ao menos 3 fases** para publicar e não tem máximo no produto: a `api` guarda só o teto técnico `TETO_DE_FASES` (50, [jogos.ts](../shared/treinamento-servico/jogos.ts)), que não aparece nas telas. As fases seguem a ordem do autor e são de 10 minijogos, todos por toque (sem arrastar), cada um com a sua cor, o seu ícone e uma frase curta do que é o jogo. Os limites estão em [treinamento-servico-esquema.ts](../api/src/dominio/treinamento-servico-esquema.ts).

| Minijogo | Como funciona | Certa quando | Limites |
|---|---|---|---|
| Quiz | escolher uma opção | a opção certa | 3 ou 4 opções |
| Decisão | uma situação; depois da resposta, cada atitude mostra a consequência | a atitude segura | 3 ou 4 opções |
| Ligar | ligar cada item da esquerda ao par da direita | todos os pares | 2 a 5 pares |
| Pôr em ordem | tocar nas etapas na sequência | todas as etapas no lugar | 2 a 6 etapas |
| Verdadeiro ou falso | uma afirmação e duas cartas | a carta certa | afirmação até 400 caracteres |
| Caça-palavras | tocar na primeira e na última letra de cada palavra | achou todas | 2 a 5 palavras de 3 a 12 letras; grade de 10 a 14 (3 a mais que a maior palavra); linha, coluna e as duas diagonais, lidas da esquerda para a direita, se cruzando quando dá |
| Memória | virar duas cartas por vez e formar os pares (termo e correspondente) | formou todos, sem limite de tentativas nem de erros | 2 a 5 pares, carta até 80 caracteres |
| Selecione | marcar tudo o que atende ao pedido | todas as certas e nenhuma errada | 3 a 16 opções escritas, de 1 a 10 certas e ao menos uma errada; ou "Montar com os materiais do serviço": de 1 a 10 materiais certos do catálogo e de 1 a 15 itens de outros serviços sorteados a cada partida |
| Desembaralhe | tocar nas letras de uma palavra na ordem, com a dica | formou a palavra inteira | banco de 10 palavras de 3 a 14 letras (com acento), cada uma com a dica |
| Termo | digitar palavras; cada letra fica verde (lugar certo), amarela (em outro lugar) ou cinza (não tem) | acertou dentro das tentativas | banco de 10 palavras de 4 a 7 letras, dica opcional; tentativas = letras + 1 (`tentativasDoTermo`); sem acento ("mao" vale "mão"); não confere se o palpite existe |

- **Caça-palavras:** o autor escolhe se quem joga vê as palavras (com a pista embaixo, se houver) ou só as pistas (a palavra escondida, com o número de letras). A grade não tem acento nem cedilha (`letrasDaGrade`). Achar a palavra formada de novo em outro lugar também vale; marcar do fim para o começo também.
- **Desembaralhe e Termo:** cada partida sorteia uma palavra do banco. O rascunho aceita de 1 a 10 palavras; publicar exige as 10 (`422 palavras_insuficientes`). Palavra repetida é recusada.
- **Selecione com materiais** era o antigo "Separar os itens". Os materiais precisam existir e estar ativos no catálogo.
- **"1 de cada":** no editor e no plano da geração, acrescenta uma fase de cada minijogo, em ordem aleatória.
- **Teclado:** no computador, também 1 a 4 ou A a D, V/F, 1 a 9 no Selecione, letras e Backspace no Desembaralhe e no Termo, Enter para confirmar.

### 8.5 Embaralhamento e o que vai ao aparelho

- **Cada tentativa é aberta a cada "Começar o jogo", "Jogar de novo" ou recarga,** e a ordem é sorteada e guardada nela (a `apresentacao`): as opções, os itens, os dois lados do ligar, as etapas, as cartas, a grade e as letras. As opções **nunca saem na ordem em que o autor as escreveu** (`permutacaoDesordenada`): no pôr em ordem ela é a resposta, e no quiz a certa costuma vir primeiro. No ligar, a direita nunca fica na mesma ordem da esquerda.
- **A correção usa só o que foi gravado na tentativa.** No caça-palavras, o servidor lê as letras na grade gravada; na memória, refaz a partida e recusa jogada impossível (`422`); no Termo, confere o tamanho e o limite de palpites.
- **A exceção do retorno imediato:** caça-palavras, memória e Termo precisam responder na hora se a marcação é uma palavra, se as cartas são par e a cor de cada letra. Por isso vão ao jogo a impressão de cada palavra (`chaveDaPalavra`), o grupo de cada carta (um número sorteado) e a palavra do Termo codificada (`codificarTermo`). Não é segredo de verdade; a nota que vale é a do servidor.
- **Quem treina não vê a meta da IA** (8.10 e 9.4): o `GET` do treinamento tira o `ia` dos passos, e as fases só chegam pela apresentação.

### 8.6 Navegação, tempo e retorno

- **Em toda fase:** Voltar (menos na primeira), Avançar (mesmo sem responder) e Confirmar; na última, Finalizar. A resposta confirmada fica travada: voltar mostra a correção, e responder de novo devolve a correção gravada.
- **O progresso** de uma fase não confirmada vai ao servidor enquanto a pessoa mexe e na troca de fase; ao voltar, a fase aparece como estava. Ao finalizar, o que foi feito nas fases não confirmadas é corrigido, e o resto vale zero. Finalizar com fase pendente, avançar sem confirmar, recomeçar uma fase, jogar de novo e sair no meio pedem confirmação.
- **O tempo de cada fase é o do servidor:** a tentativa guarda um cronômetro por fase, que pausa ao sair dela e continua ao voltar; ao responder, para. Pular o aviso de entrada não zera o tempo. O cronômetro e o tempo do jogo todo na tela são só para acompanhar.
- **O retorno:** verde no acerto, vermelho no erro e amarelo ("Quase!") quando acertou parte de uma fase com várias respostas certas (Selecione, Ligar, Pôr em ordem, Caça-palavras e Memória), com a figurinha da Vitória, a explicação e, na decisão, a consequência.
- **Em cada fase, "Reportar problema"** manda um aviso com texto livre aos administradores, que tratam na aba Problemas.

### 8.7 A nota do treinamento

A nota é **só do treinamento** e ordena o ranking dele (8.9); não entra na gamificação geral, que segue com 5 pelo concluído e 1 por fase certa (8.8). As contas ficam em [nota.ts](../shared/treinamento-servico/nota.ts), usadas pela `api` (que calcula e grava) e pela web (que mostra).

- **Base da fase:** 10 × acertos ÷ respostas certas possíveis (`pontosBase`). Quiz, decisão, verdadeiro ou falso e desembaralhe: 1 possível (tudo ou nada). Selecione: as certas marcadas menos as erradas marcadas, sobre as certas (senão marcar tudo daria 10). Ligar: os pares certos. Pôr em ordem: as etapas na posição certa. Caça-palavras: as palavras achadas. Memória: os pares formados. Termo: 10 ÷ a tentativa em que acertou (na 1ª, 10; na 2ª, 5; na 5ª, 2).
- **Multiplicador do tempo:** 5 degraus (`DEGRAUS_DO_TEMPO`): 1,0×, 0,875×, 0,75×, 0,625× e 0,5× (o piso). Cada minijogo tem o seu tempo cheio T (`TEMPO_CHEIO_SEGUNDOS`): até T vale 1,0×, e cada degrau seguinte dura outro T; o limite é inclusive.

| Minijogo | T (100% até) | 87,5% até | 75% até | 62,5% até | 50% depois de |
|---|---|---|---|---|---|
| Verdadeiro ou falso | 10 s | 20 s | 30 s | 40 s | 40 s |
| Quiz | 15 s | 30 s | 45 s | 1 min | 1 min |
| Decisão | 20 s | 40 s | 1 min | 1 min 20 s | 1 min 20 s |
| Selecione, ligar, pôr em ordem e desembaralhe | 30 s | 1 min | 1 min 30 s | 2 min | 2 min |
| Memória | 45 s | 1 min 30 s | 2 min 15 s | 3 min | 3 min |
| Caça-palavras | 1 min | 2 min | 3 min | 4 min | 4 min |
| Termo | 1 min 30 s | 3 min | 4 min 30 s | 6 min | 6 min |

- **Pontos da fase** = base × multiplicador, com duas casas (`pontosDaFase`).
- **Nota** = a soma dos pontos das fases × (total de fases × 10), arredondada (`notaDoTreinamento`). Fase sem resposta vale zero, mas conta no total. A nota máxima é 100 × fases² (`notaMaxima`; 5 fases, 2.500).
- **"Fase certa"** (as estrelas, a gamificação e a conquista Nota máxima) é a que teve todos os acertos possíveis.
- **Tentativas antigas** guardam a nota da regra em que foram jogadas; o ranking mistura as regras.
- **O resultado** mostra a nota num anel sobre a máxima, a conta, o tempo total, cada fase (pontos, acertos, tempo, multiplicador), três estrelas (todas certas: 3; ao menos 60%: 2; alguma: 1), os pontos ganhos (ou por que não houve) e "Nova melhor nota!" ou "Sua melhor nota continua X".

### 8.8 Pontos e conquistas dos treinamentos

- **5 pontos pelo concluído e 1 por fase certa, até 10:** no máximo 15 por treinamento ([pontuacao.ts](../api/src/dominio/pontuacao.ts), `pontuarTreinamentoServico`).
- **Só a primeira conclusão pontua** (`concluirTentativa`, [treinamento-servico.ts](../api/src/dominio/treinamento-servico.ts)): jogar de novo, uma versão nova do treinamento e o teste do admin não pontuam. Errar não tira ponto.
- **Quem aguarda liberação pontua,** como no Campo de treino, mas não aparece no ranking geral até ser liberado.
- **O total é limitado** pelo número de treinamentos publicados; fazer todos na primeira semana é o comportamento desejado.
- **Conquistas:** Aprendiz, Especialista e Nota máxima (7.4).

### 8.9 Ranking do treinamento

- **Cada treinamento tem o seu ranking** ([treinamento-servico-ranking.ts](../api/src/dominio/treinamento-servico-ranking.ts)), pela **melhor nota** de cada pessoa entre todas as suas tentativas concluídas. Jogar de novo pode subir a posição, mas não dá pontos na gamificação.
- **Empate:** quem chegou àquela nota primeiro (a tentativa concluída mais cedo); depois, o nome.
- **Quem aparece:** técnicos ativos que já concluíram, inclusive quem aguarda liberação; quem foi recusado ou desativado sai. O admin não aparece, mas vê. O teste do admin não entra. O anonimato é o mesmo da gamificação.
- **Onde aparece:** no resultado do jogo ("Você está em Nº", as dez primeiras posições e a linha da pessoa, se estiver mais abaixo), na capa do treinamento e no "Ver ranking" do cartão do serviço. A rota aceita até 100 linhas (`LINHAS_DO_RANKING` é o padrão, 10).

### 8.10 Revisão, validação e publicação

**"Revisão" não é "Validação".** A **Revisão** é a aba do editor em que o autor (ou o admin) confere o próprio rascunho: o treinamento como o técnico vai ver, com a resposta certa marcada e, nos itens da Vitória, o trecho de origem, as pendências, "Confirmar como está", "Editar" e "Regerar com a Vitória". A **Validação** é a aprovação do treinamento pelos supervisores de outras equipes, depois de enviado.

**A validação pelos supervisores** ([treinamento-servico-validacao.ts](../api/src/dominio/treinamento-servico-validacao.ts)):

| Regra | Como funciona |
|---|---|
| Quem valida | as 3 equipes que mais fazem o serviço (`MAX_VALIDADORES`; mais OS, depois mais pontos, depois ordem alfabética), **sem as equipes do autor** (a dele e as que ele supervisiona), uma pessoa por equipe: o supervisor ou, no lugar dele, o representante no comando. O autor em 1º lugar é validado pelo 2º, 3º e 4º; o admin como autor, pelo 1º, 2º e 3º |
| Mesma pessoa em duas equipes | ocupa uma vaga só; a próxima equipe da fila entra. Só entram equipes que têm quem responda por elas |
| Quórum | **2 dos 3** (`ASSINATURAS_NECESSARIAS`); com 2 validadores possíveis, os 2; com 1, o 1. Fechou o quórum, o treinamento é publicado sozinho |
| Enviar | o autor (ou o admin) envia com a assinatura do perfil; exige o mesmo que publicar (conteúdo completo, sem pendências). Sem ninguém para validar: `409 sem_validadores` |
| Grupo fixo | os validadores são fixados ao enviar; o ranking das equipes muda, e o grupo não troca no meio da rodada |
| Rascunho travado | enviado, não se salva nem se pede à IA (`409 em_validacao`); o autor ou o admin pode "retirar da validação" para editar |
| Aprovar | o validador vê o treinamento com as respostas certas, pode testá-lo e aprova assinando o termo de revisão com a assinatura do perfil |
| Recusar | qualquer validador recusa, com **motivo obrigatório**; o rascunho volta ao autor, e o reenvio abre uma rodada nova, com as assinaturas zeradas e os validadores de agora |
| Avisos | `treinamento_para_validar` (a quem valida), `treinamento_devolvido` (ao autor, com o motivo) e `treinamento_validado` (ao autor, ao publicar), na categoria de e-mail Treinamentos |
| Onde se valida | na página Validações do supervisor ([pessoas-e-equipes.md](pessoas-e-equipes.md)), que leva à tela de validar do treinamento |
| Prazo | não há; um treinamento parado pode ser publicado direto pelo admin |

**A publicação direta do admin** é a exceção: com a validação possível (o rascunho já está em validação, ou haveria validadores se fosse enviado), a **justificativa é obrigatória** (`422 justificativa_obrigatoria`) e fica na versão e na auditoria. Sem ninguém para validar (ex.: serviço sem OS), publica sem justificar.

**Publicar** (pela validação ou direto) exige: de 1 a 12 passos, ao menos 3 fases, o banco cheio no Desembaralhe e no Termo e nenhuma pendência da IA aberta (`422 pendencias_abertas`).

- **O termo:** "Declaro que revisei este treinamento e que a explicação, as fases e as respostas estão de acordo com as normas da empresa e com o fluxo correto do serviço {código} — {descrição}." A assinatura é a do perfil, como nas outras ações assinadas ([pessoas-e-equipes.md](pessoas-e-equipes.md)).
- **A versão publicada** guarda a assinatura de quem fechou o quórum (ou do admin, na publicação direta); as de todos os validadores ficam na rodada. A aba Versões mostra cada versão com a via (`validacao` ou `direta`), as assinaturas e a justificativa.
- **A auditoria** registra a publicação, quem assinou, se o rascunho veio da IA e o texto de origem.
- **A primeira publicação avisa os técnicos** (ativos, liberados ou aguardando liberação); as seguintes corrigem o que já está lá.
- **A assinatura define quem responde pelo conteúdo,** mas não garante que ele foi conferido; por isso existem as pendências da IA, a validação e o "Reportar problema".
- **Os reportes** chegam só aos administradores.

### 8.11 Onde quem treina joga

- **Catálogo › Serviços** mostra primeiro "Com treinamento" (serviços com versão publicada; rascunho não conta) e depois "Outros serviços". No cartão do serviço, com treinamento publicado: o cartãozinho da Vitória (com o selo de concluído, as fases certas e "Ver ranking") e "Jogar treinamento". Para o admin, no mesmo lugar, "Abrir treinamento" ou "Criar treinamento".
- **A tela de espera** de quem aguarda liberação lista os treinamentos publicados.
- **O jogo abre numa janela** (tela inteira no celular): capa (o cenário, a Vitória, a duração estimada, quem assinou), explicação, a passagem "Agora é a sua vez!" (a tentativa só é aberta nela), as fases e o resultado. `/treinar` é a capa do treinamento, destino dos avisos e da Vitória.
- **No Campo de treino** não há treinamentos: eles usam a `api` real.

## 9. Rascunho de treinamento pela IA

A função de IA "Criação de jogos" (`minigames`) monta o rascunho a partir do procedimento colado por quem cria. O interruptor da função, a leitura de dados e os provedores (Gemini gratuito na demonstração, só com dados fictícios; Claude com dados reais) estão em [ia-e-vitoria.md](ia-e-vitoria.md). O domínio fica em [treinamento-servico-ia.ts](../api/src/dominio/treinamento-servico-ia.ts).

### 9.1 Gerar com a Vitória

- **A tela** (Criar › Gerar com a Vitória) orienta como escrever o procedimento (o que o serviço usa, os passos na ordem, os cuidados, os números exatos), traz um exemplo com "Usar este exemplo" e o campo do texto, de 40 a 20.000 caracteres (`LIMITE_TEXTO_PROCEDIMENTO`).
- **O plano das fases:** quantas fases (ao menos 3; começa em 5) e o minijogo de cada uma, ou "A Vitória escolhe"; "Todas como" e "1 de cada" preenchem o plano. Há o pedido "Selecione com os materiais do serviço", recusado sem materiais no catálogo (`422 plano_sem_materiais`). O plano vale mais que "varie os tipos"; sem plano, a IA monta de 3 a 10 fases.
- **A espera:** a Vitória pensando em loop, a frase do momento ("Montando a fase 3 de 5…"), a barra, as etapas e o tempo corrido. A geração continua no servidor e é gravada mesmo se a pessoa sair da tela. Pronto, a Revisão abre sozinha.

### 9.2 O que a IA recebe

- **Sempre:** as regras (só o texto do procedimento, sem conhecimento de fora; o trecho de origem copiado sem mudar palavra; números só se estiverem no texto; o comportamento seguro; nunca falar de APR, checklist, item eliminatório ou resposta que bloqueia), o formato, o código e a descrição do serviço, os materiais ativos dele com a categoria e um código curto (`M1`, `M2`…, nunca o id), o texto e o plano. Nos ajustes, também o rascunho atual e o pedido.
- **Nunca:** o modelo de APR, os tipos de item, o que é eliminatório, pessoas, OS, textos livres ou ids.
- **Com a leitura de dados autorizada pelo admin** ([treinamento-servico-dados.ts](../api/src/dominio/treinamento-servico-dados.ts)), recebe também um resumo agregado das OS do serviço, até 8 linhas por lista: os motivos de pausa e de suspensão e quantas vezes; **o texto dos itens de APR marcados com problema** (o texto fixo do modelo, nunca a observação) e quantas vezes; e os materiais das sugestões aceitas. A instrução diz que esses dados só escolhem em que assuntos os jogos insistem: o conteúdo continua saindo só do procedimento. Sem a autorização, ou se a leitura falhar, nada muda.

### 9.3 Formato e streaming

- **A IA devolve linhas JSON,** um objeto por linha: o `plano` (quantos passos e fases), um `passo` por linha, uma `fase` por linha e o `resumo`. Cada objeto que fecha vira um passo de progresso, e um item fora do formato é descartado sozinho (`descartados`), sem perder o resto (`LeitorDeObjetosJson`).
- **As rotas** (`POST .../rascunho/gerar` e `.../rascunho/ajustar`) respondem em SSE: `progresso` a cada item e a cada 5 s com o tempo corrido; `final` com o rascunho já gravado, a situação dos limites, o resumo e os descartados; `erro` (`ia_indisponivel`, `resposta_ia_invalida` ou `rascunho_mudou`). Com erro, nada é gravado e a rodada não conta.
- **Antes do streaming,** os erros são HTTP: `503 ia_indisponivel`, `409 limite_ia`, `409 em_validacao`, e `422` para texto curto ou longo, ajuste sem geração (`sem_texto_origem`), fase inexistente (`fase_invalida`), pedido vazio (`pedido_vazio`) ou plano inválido.
- **Conversão para o editor:** texto acima do tamanho é cortado com reticências (com pendência); expressão desconhecida vira `explicando`; fase incoerente é descartada (`problemaDaFase`); o resultado passa pela mesma validação do `PUT` do rascunho. Depois, fase de outro tipo que o plano pedia ganha a pendência `fora_do_plano`, o que passar do número pedido fica de fora, e fase a menos vai no resumo.
- **Tempo limite de 6 minutos** por chamada: o modelo pode pensar alguns minutos antes do primeiro item.

### 9.4 Conferências e pendências

Cada passo e fase da IA leva `ia`: o trecho de origem, a impressão do conteúdo (`impressaoDoItem`), as pendências e `conferido` ([ia.ts](../shared/treinamento-servico/ia.ts)). Item feito à mão não tem `ia`.

| Pendência | Quando |
|---|---|
| `origem_vazia` | a IA não indicou o trecho de origem |
| `origem_fora_do_texto` | alguma frase do trecho não está no texto (compara frase por frase, sem acento, maiúscula nem pontuação: a IA pode juntar frases e pular com reticências, mas não trocar palavra) |
| `numero_fora_do_texto` | um número que quem treina lê não aparece no texto ("1,5" e "1.5" valem o mesmo) |
| `fase_sem_opcao_certa`, `fase_com_mais_de_uma_certa` | no quiz e na decisão; fica certa a primeira marcada até o autor escolher |
| `fase_sem_gabarito` | verdadeiro ou falso sem dizer se é verdadeira |
| `material_fora_do_catalogo` | o Selecione citou material fora da lista do serviço; o material é tirado |
| `palavra_invalida`, `palavra_fora_do_texto`, `palavras_insuficientes` | palavra com espaço, número ou tamanho errado (tirada), palavra que não está no texto, banco do Desembaralhe ou do Termo com menos de 10 |
| `fora_do_plano` | o plano pedia outro minijogo nesta fase |
| `texto_cortado` | um texto passou do tamanho do editor e foi cortado |

- **A pendência some** quando o item é editado (a impressão deixa de bater) ou confirmado ("Confirmar como está"). Reordenar não conta como editar. A web recalcula as pendências a cada edição com o mesmo código da `api`.
- **Pendência aberta impede publicar e enviar para validação** (`422 pendencias_abertas`, com a lista nos detalhes).

### 9.5 Ajustes pelo chat e fase regerada

- **No chat** ("encurte a explicação", "faça uma fase sobre aterramento"), a IA devolve o rascunho inteiro. O item que volta igual a um já editado, confirmado ou feito à mão volta confirmado; a imagem de um passo volta pelo texto igual. Um ajuste nunca apaga uma parte inteira: se a IA devolveu só os passos, as fases ficam.
- **"Regerar com a Vitória"** troca só uma fase; sem pedido, a IA tenta outro ponto do texto. Os ajustes e a fase regerada não usam o plano.
- **A conversa fica só na tela;** o servidor guarda o rascunho e o texto de origem.

### 9.6 Limites

| Variável | Padrão | O que é |
|---|---|---|
| `TREINAMENTO_IA_LIMITE_TREINAMENTOS` | 3 | quantos treinamentos podem usar a IA (um treinamento passa a usar quando alguma versão tem `gerado_com_ia`) |
| `TREINAMENTO_IA_LIMITE_RODADAS` | 4 | rodadas por treinamento, somando as versões: cada pedido no chat, fase regerada ou nova geração |
| `TREINAMENTO_IA_MAX_TOKENS` | 16000 | o tamanho máximo da resposta da IA |

- **A primeira geração de um treinamento não conta como rodada;** gerar de novo conta. Só conta a chamada que deu certo e foi gravada.
- **Esgotado o limite:** `409 limite_ia`, e a tela desativa os botões com "Limite da demonstração atingido". O editor manual continua.
- **Os limites são globais,** feitos para a demonstração, e separados dos da Vitória. Com mais autores (supervisores), talvez precisem ser por pessoa (ver [pendencias.md](../pendencias.md)).

### 9.7 Versões e auditoria

- **Editar um treinamento publicado parte da versão publicada:** o rascunho novo copia a explicação, as fases, o cenário, o texto de origem e `gerado_com_ia`.
- **A auditoria da publicação** registra `gerado_com_ia` e o `texto_origem`, e o resumo diz "(rascunho feito com a IA)".
- **Quem publica (ou valida) assina,** mesmo o que veio da IA (8.10).
- **Conferência contra a IA real:** `pnpm treinamento:conferir-ia` ([conferir-rascunho-ia.ts](../api/scripts/conferir-rascunho-ia.ts)) gera e ajusta um rascunho fictício com a IA configurada (gasta 2 chamadas).
