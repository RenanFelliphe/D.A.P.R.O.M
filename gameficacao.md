# Gamificação — decisões de 13/10/2026

> Registro da discussão sobre a gamificação: as regras do jogo, a pontuação de cada tarefa, as patentes, as temporadas, o ranking, as conquistas e a gamificação por equipe, com as páginas, as tabelas, as rotas e a ordem de implementação. A segunda rodada da discussão (também em 13/10) aumentou as tarefas que pontuam e listou as páginas.
>
> **Situação:** implementada em 13/10/2026 na `api` e na web (as quatro etapas da [seção 10](#10-rotas-e-ordem-de-implementação), de uma vez). A [especificação](base/.design/especificacao.md#gamificação) traz o contrato; o app recebe as páginas de consulta quando existir. A [seção 12](#12-implementação) registra o que mudou ou foi acrescentado ao implementar.
>
> Fontes: a análise das extras em [funcionalidades.md](funcionalidades.md) (seção 2.2), a especificação (Supervisão, Ciclo das preventivas, Execução, Impedimento e Painel), o volume de OS e os locais críticos da [Reunião 1](base/reunioes/Transcricao_Reuniao1.md) e o número de pessoas por atividade da [Reunião 2](base/reunioes/Transcricao_Reuniao2.md).

## Resumo

- **Entram:** pontuação, patentes, ranking por temporada e geral, conquistas (troféus) e gamificação por equipe.
- **Saiu:** a sequência de APRs completas (ver [Descartado e pendente](#11-descartado-e-pendente)).
- **Regra central:** a segurança nunca custa pontos. Bloquear a APR ou interromper por risco rende o mesmo que aprovar e encerrar.
- **Quanto vale uma OS:** para cada pessoa que trabalhou nela, 20 pontos de base (APR + execução), mais bônus de 5 por preventiva em dia, local crítico, liderar a APR, resgate, apoio a outra equipe e técnico novo acompanhado. Em média, cerca de 29 pontos, não importa quantas tentativas a OS levou.
- **Outras fontes de pontos:** as boas-vindas (assinatura e treino), a ciência e o intervalo das preventivas, para o supervisor, e as conquistas, que dão pontos como os troféus do PlayStation.
- **Temporada:** um trimestre. Os pontos e a patente da temporada zeram; os pontos gerais, a maior patente e as conquistas ficam.
- **O admin configura** os pontos de cada tarefa, as patentes e as conquistas.
- **Na web,** uma seção nova, **Gamificação**, com 5 abas, e ajustes no menu, na barra, nos perfis, na equipe e nas telas de APR e execução ([seção 8](#8-páginas)).

---

## 1. Regras do jogo

1. **A segurança não custa pontos.** APR bloqueada vale o mesmo que aprovada, e execução interrompida por risco vale o mesmo que encerrada, com os mesmos bônus. Nenhuma regra dá pontos a mais por bloquear ou interromper (faria bloquear para não trabalhar) nem tira pontos por isso (faria marcar tudo "certo").
2. **O técnico continua sem saber o que é eliminatório.** Nenhuma regra nem conquista olha a resposta de um item da APR (Decisão-chave 5 da especificação).
3. **Só o servidor calcula.** Os pontos saem dos registros gravados (APR, execução, ciência, treino, assinatura, plano de preventiva), na mesma transação que os grava. O aparelho nunca envia pontuação, e reenviar um evento não pontua de novo.
4. **Quem quiser fica anônimo no ranking.** Os pontos continuam valendo para a pessoa e para a equipe.
5. **O admin ajusta as regras:** pontos por tarefa, patentes e conquistas, cada um no seu cadastro.
6. **Quem trabalha mais ganha mais.** A pontuação soma tarefas, e isso é aceito: quem tem mais OS recebe mais pontos.
7. **O admin não joga.** Não pontua e não aparece no ranking; ele não aplica APR nem executa OS.

As regras 1, 3, 4 e 5 são as "regras de justiça" escolhidas na discussão.

---

## 2. Pontuação

### 2.1 Tarefas que pontuam

| Tarefa | Quem ganha | Pontos | Quando conta | Limite |
|---|---|---|---|---|
| **Principais** | | | | |
| APR completa | todos os participantes da APR | 10 | aprovada: quando chega com as assinaturas (`apr_concluida`); bloqueada: quando chega a evidência dos itens reprovados (o `apr_concluida` da mesma APR) | uma por pessoa, por OS |
| Execução concluída | todos os participantes da APR que amparou a execução | 10 | OS encerrada com as assinaturas de todos, **ou** execução interrompida por risco | uma por pessoa, por OS |
| **Bônus da OS** (somam-se às principais) | | | | |
| Responsável pela APR | o participante `responsavel` | 5 | junto com a APR completa, aprovada ou bloqueada | uma por pessoa, por OS |
| Preventiva em dia | quem tem "Execução concluída" na OS, inclusive quem interrompeu por risco | 5 | quando a preventiva é encerrada até a data limite (fim programado, senão início, como no indicador de preventivas), ou depois dela com atraso justificado: a OS ficou pendente antes da data ou foi reprogramada | uma por pessoa, por OS |
| Local crítico | quem tem "Execução concluída" na OS | 5 | junto com a execução concluída (encerrada ou interrompida), quando o local da OS é crítico | uma por pessoa, por OS |
| Resgate | quem concluiu a execução de uma OS pendente por APR bloqueada ou execução interrompida **de outras pessoas** | 5 | junto com a execução concluída; quem participou de alguma tentativa anterior da OS não ganha | uma por pessoa, por OS |
| Apoio a outra equipe | quem concluiu a execução de uma OS de apoio | 5 | junto com a execução concluída | uma por pessoa, por OS |
| Técnico novo acompanhado | o responsável pela APR | 5 | junto com a APR completa, quando outro participante tem a conta há menos de 60 dias | uma por OS |
| **Boas-vindas** | | | | |
| Assinatura cadastrada | o técnico | 5 | ao cadastrar a assinatura no perfil | uma por conta |
| Campo de treino concluído | o técnico | 10 | quando o treino passa a `concluido` | uma por conta |
| **Supervisor** | | | | |
| Ciência no prazo | o supervisor que deu a ciência | 3 | até 72 h depois do encerramento | uma por OS |
| Intervalo de preventiva definido | o supervisor que definiu | 3 | ao definir o intervalo de um plano que estava sem | uma por plano |
| **Conquistas** | | | | |
| Conquista obtida | a pessoa | o que estiver na conquista (sugestão: 25, 50 ou 100) | quando a conquista é concedida | uma por conquista |

- **APR bloqueada sem evidência não pontua.** Os pontos chegam junto com a evidência, o que também incentiva enviá-la.
- **72 h para a ciência** cobrem o fim de semana: de sexta à noite até segunda à noite.
- **O supervisor não ganha ciência da própria OS:** a ciência já é recusada a quem participou da execução (`409 ciencia_propria`).
- **Conquistas de equipe não dão pontos;** só as de pessoa.

### 2.2 O que não pontua

| O quê | Por quê |
|---|---|
| Sincronização offline → online | Pontuaria desligar o sinal de propósito, e o sistema é online primeiro. O que foi feito offline pontua normalmente quando chega |
| Iniciar a execução | Premiaria começar sem terminar |
| Pausa, suspensão (fim do expediente) e cancelamento por engano | A OS continua; os pontos vêm quando a execução é concluída |
| Evidência a mais (fotos e PDFs além do exigido), observação e descrição longas | Inflariam anexos e textos de enchimento |
| Bônus por bloqueio ou interrupção | Faria bloquear para não trabalhar (regra 1) |
| Ler o alerta de bloqueio e tratar a OS pendente (supervisor) | Dependeriam do número de bloqueios da equipe (regra 1) |
| Reprogramar e abrir OS de apoio (supervisor) | São decisões de planejamento; pontuar empurraria a decisão. Reprogramar ainda torna o atraso justificado |
| Ciência depois de 72 h | O ponto é pela ciência em dia |
| Entrar no sistema todo dia | Não é trabalho |
| Formulário de inspeção da preventiva | A estrutura ainda não está definida (questão 57); pode virar bônus quando estiver |
| Ações do admin | O admin não joga (regra 7) |

### 2.3 Como chegamos nesses valores

**Por que a lista cresceu.** A primeira versão tinha 5 tarefas, e a pontuação parecia lenta. Entraram os bônus da OS, as boas-vindas, o intervalo de preventiva e os pontos das conquistas. Com isso, uma OS comum passou de 20 ou 25 pontos para cerca de 29 em média, e o dia tem mais momentos de ganho. Quem define a velocidade de subida, porém, são os limites das patentes; eles foram ajustados para a primeira subida vir na primeira semana ([seção 3.3](#33-carga-inicial)).

- **APR e execução valem o mesmo (10).** Num sistema de segurança, a APR é tão importante quanto o serviço.
- **Os bônus valem 5, metade de uma tarefa principal.** Reconhecem o que pesa mais sem desequilibrar.
  - **Responsável pela APR:** quem lidera a APR responde por ela. A Reunião 2 lembra que sempre há um líder, e é ele quem preenche a APR.
  - **Preventiva em dia:** é o indicador que a gerência e a diretoria acompanham (Reunião 1). O atraso justificado mantém o bônus, e quem interrompeu por risco também o recebe quando a OS fecha em dia: parar não custa pontos.
  - **Local crítico:** são os locais que a gerência prioriza (pontos de recebimento, ERP, ERS, autorizações e clientes Vale e Suzano, pela Reunião 1). Vem junto com a execução concluída, também na interrupção, para que parar num local crítico não custe pontos.
  - **Resgate:** conta só a pendência por bloqueio ou interrupção de outras pessoas. A suspensão no fim do expediente é rotina; se contasse, bastaria trocar quem vai no dia seguinte para ganhar o bônus.
  - **Apoio a outra equipe:** premia ajudar quem precisou.
  - **Técnico novo acompanhado:** incentiva levar os novos junto com quem tem experiência.
- **O limite por OS mantém a segurança neutra.** Quem bloqueia e refaz a APR, ou interrompe e retoma, recebe o mesmo que quem fez tudo de uma vez. Também impede que alguém estique o serviço por vários dias para somar APRs.
- **A ciência e o intervalo de preventiva valem 3.** São ações rápidas. O supervisor de uma equipe com 80 OS por mês soma uns 700 pontos por temporada só com a ciência, além do que faz em campo: não domina o ranking nem some dele. O intervalo importa porque o ciclo das preventivas só funciona com ele, e todo plano novo chega sem.
- **As boas-vindas** (assinatura 5, treino 10) dão os primeiros pontos já no primeiro dia.
- **As conquistas dão pontos** como os troféus do PlayStation. O admin define o valor de cada uma: 25 para as fáceis, 50 para as médias, 100 para as difíceis.

Exemplos (pontos de cada participante):

| Cenário | Pontos |
|---|---|
| Corretiva sem bônus | APR 10 + execução 10 = **20** |
| Preventiva no prazo, em local crítico, como responsável pela APR | 10 + 10 + 5 + 5 + 5 = **35** |
| A APR bloqueia; o problema é resolvido, a APR nova aprova e a OS é encerrada | 10 + 10 = **20** (o mesmo) |
| Interrompe por risco numa preventiva; outra pessoa retoma e encerra (atraso justificado) | quem interrompeu: 10 + 10 + 5 = **25**, o mesmo que se tivesse encerrado; quem retomou: 10 + 10 + 5 + 5 (resgate) = **30** |
| Serviço de 3 dias, suspenso no fim de cada expediente | **20** mais os bônus: as APRs dos outros dias não somam |
| Preventiva atrasada sem justificativa | 10 + 10 = **20** |
| Responsável por uma APR com um técnico de 3 semanas de casa | + 5 (responsável) + 5 (técnico novo) |

### 2.4 Extrato de pontos

- **Cada pontuação é uma linha do extrato** (`lancamento_pontos`), gravada pelo servidor na mesma transação que grava a APR, a execução, a ciência, o treino, a assinatura, o plano ou a conquista.
- **Uma chave por pessoa:** `apr:<os>`, `responsavel:<os>`, `execucao:<os>`, `preventiva:<os>`, `local_critico:<os>`, `resgate:<os>`, `apoio:<os>`, `tecnico_novo:<os>`, `assinatura`, `treinamento`, `ciencia:<os>`, `intervalo:<plano>` ou `conquista:<id>`. A chave é única por pessoa, então o limite da tabela 2.1 e a proteção contra reenvio são a mesma restrição (`on conflict do nothing`).
- **O lançamento guarda os pontos do momento.** Se o admin muda o valor de uma tarefa, a mudança vale dali em diante; o que já foi lançado não muda.
- **A data do lançamento** é quando a tarefa aconteceu, no fuso de São Paulo:
  - APR: o evento que a completou;
  - execução: o fim;
  - ciência: `ciencia_em`;
  - treino: `treinamento_em`;
  - conquista: `obtida_em`;
  - demais: o momento do registro.

  Essa data define a temporada. Se aquela temporada já fechou, o lançamento entra na temporada aberta.
- **Equipes creditadas** (`lancamento_equipe`): a equipe da pessoa naquele momento e todas as equipes que ela supervisionava. Quem muda de equipe deixa os pontos onde os fez.
- **Na implantação,** o extrato é preenchido a partir do histórico (APRs, execuções, ciências, treinos, assinaturas e planos já gravados), com as mesmas regras. As temporadas passadas já nascem fechadas.
- **A pessoa vê o próprio extrato** ("APR da OS 4019821 — 10 pontos") e confere de onde veio cada ponto.

---

## 3. Patentes

### 3.1 Regras

- **Só valem na temporada** e zeram com ela. No geral aparece apenas a **maior patente já alcançada**.
- **A patente da pessoa** é a de maior pontuação necessária que ela já atingiu na temporada. Abaixo da primeira, aparece "Sem patente"; com a carga inicial isso não acontece, porque Bronze começa em 0.
- **A equipe usa a mesma tabela,** aplicada à média por membro ([seção 6](#6-equipe)).
- **Mudar uma patente** vale na hora para a temporada aberta. As temporadas fechadas guardam a patente gravada no fechamento.

### 3.2 Cadastro (admin)

| Campo | Obrigatório | Regra |
|---|---|---|
| Nome | sim | único |
| Pontuação necessária | sim | inteiro ≥ 0, único entre as ativas; define a ordem das patentes |
| Imagem | sim | o admin envia; PNG, JPEG ou WebP, até 1 MB, quadrada (512 × 512 recomendado) |
| Cor | sim | hexadecimal; destaca o nome e a barra de progresso |
| Descrição | não | texto livre |
| Ativa | sim | a desativada deixa de ser atribuída, mas continua no histórico |

Excluir só vale para a patente que nunca foi gravada numa temporada fechada nem é meta de uma conquista. Nos outros casos, o admin a desativa.

### 3.3 Carga inicial

| Patente | Pontuação necessária | O técnico médio chega em | Cor |
|---|---|---|---|
| Bronze | 0 | na largada | `#CD7F32` |
| Prata | 300 | ~1 semana | `#A8A9AD` |
| Ouro | 1.500 | ~5 semanas | `#D4AF37` |
| Platina | 3.000 | ~11 semanas, perto do fim da temporada | `#9DB4C0` |
| Diamante | 5.000 | só quem rende cerca de 40% acima da média | `#4FC3F7` |

A carga traz uma imagem simples para cada metal, que o admin pode trocar.

Como chegamos nos limites:

- **Volume:** a Reunião 1 registra de 200 a 409 OS encerradas por mês (cerca de 390 no último mês), quase todas preventivas (355 em agosto). A Reunião 2 diz que uma atividade tem no máximo 3 pessoas.
- **Suposições:** 2 participantes por OS, cerca de 20 técnicos, 90% das OS preventivas e quase todas em dia, 30% em locais críticos, e cada pessoa responsável pela APR em metade das OS que faz.
- **Conta:** dá uns 40 OS por técnico por mês e uns 120 por temporada, a cerca de 29 pontos por OS, ou seja, uns 3.500 pontos. Com as conquistas, o técnico médio fica em torno de **3.600 pontos** por temporada, ou 280 por semana.
- **A curva começa rápida e fica difícil no fim:** a primeira subida vem na primeira semana, e o Diamante fica para 10% a 15% dos técnicos.
- **O número de técnicos é uma suposição:** com 10 técnicos, a média dobra. Os limites devem ser revistos no fim da primeira temporada real. Nessa primeira temporada, as conquistas dadas pelo histórico na implantação ainda inflam os pontos.

---

## 4. Temporadas

- **Uma temporada é um trimestre do calendário,** no fuso de São Paulo. O nome vem da estação que ocupa a maior parte do trimestre:

  | Código | Meses | Nome |
  |---|---|---|
  | T1 | janeiro a março | Verão |
  | T2 | abril a junho | Outono |
  | T3 | julho a setembro | Inverno |
  | T4 | outubro a dezembro | Primavera |

  A temporada de 13/10/2026 é a **Primavera 2026** (`2026-T4`).
- **Trimestre do calendário, e não as datas das estações,** porque as estações começam em dias diferentes a cada ano (por volta do dia 21), e os relatórios da empresa são por mês e trimestre.
- **O que zera:** os pontos e a patente da temporada. **O que fica:** os pontos gerais (desde a criação da conta), a maior patente alcançada e as conquistas.
- **Fechamento:** 7 dias depois do último dia, de tolerância para a fila offline. O executor de tarefas confere a cada 60 minutos, como faz com o ciclo das preventivas. O fechamento grava os pontos, a patente e a posição de cada pessoa e de cada equipe, e esse registro forma o histórico das temporadas.
- **Depois do fechamento,** o que chegar com data da temporada fechada entra na temporada aberta (ver 2.4).

---

## 5. Ranking

| Ranking | Ordena por | Mostra |
|---|---|---|
| Pessoas — temporada | pontos da temporada | posição, nome, equipe, patente e pontos |
| Pessoas — geral | pontos gerais | posição, nome, equipe, maior patente alcançada e pontos |
| Equipes — temporada | média por membro | posição, equipe, patente, média, soma e número de pessoas |
| Equipes — geral | média geral por membro | posição, equipe, média e soma |

- **Temporadas fechadas** podem ser consultadas, com o ranking como ficou no fechamento.
- **Empate:** fica na frente quem chegou primeiro àquela pontuação, ou seja, quem tem o último lançamento mais antigo.
- **Quem aparece:** técnicos ativos e liberados, supervisores inclusos.
  - O admin não aparece.
  - Quem é desativado sai dos rankings abertos e continua nas temporadas fechadas.
  - Quem aguarda liberação não aparece.
- **Anônimo:** os outros veem "Participante anônimo"; a própria pessoa e o admin veem o nome. Para os outros, a pessoa anônima também não mostra a patente nem as conquistas no perfil.
- **Todos os perfis veem os rankings.**
- **Exceção a uma regra do painel:** hoje o técnico não vê desempenho por pessoa (Minha equipe e os dashboards). O ranking e o bloco da equipe são a exceção: mostram os pontos e a patente de cada pessoa, nunca os indicadores, e quem não quiser fica anônimo.

---

## 6. Equipe

- **Pontos da equipe (soma):** tudo o que foi creditado a ela, que são os pontos dos membros enquanto eram membros e os do supervisor. O supervisor conta integralmente em cada equipe que supervisiona.
- **Média por membro:** a soma dividida pelas pessoas da equipe, que são os técnicos ativos e liberados mais o supervisor, quando ele não é membro. A temporada aberta usa as pessoas de hoje; a fechada, o número gravado no fechamento.
- **Patente da equipe:** a tabela de patentes aplicada à média. Os limites servem porque a média está na escala de uma pessoa.
- **Ranking das equipes pela média,** para que a equipe maior não ganhe só por ser maior. A soma aparece ao lado.
- **Equipe sem ninguém** fica fora do ranking.
- **Conquistas próprias,** com critérios de equipe ([seção 7.3](#73-critérios-da-meta)). Elas não dão pontos.

---

## 7. Conquistas

### 7.1 Regras

- **São troféus no estilo do PlayStation,** de pessoas e de equipes. São permanentes: não zeram com a temporada.
- **Valem para o passado:** ao criar, editar ou reativar uma conquista, o servidor confere todo mundo. Quem já tinha batido a meta recebe na hora, com a data em que bateu (calculada pelo extrato), e os pontos da conquista entram na temporada aberta.
- **Quando o servidor confere:** a cada lançamento novo, para a pessoa e as equipes creditadas, e no fechamento da temporada, para as metas de temporada.
- **Editar a meta:** quem já tem a conquista não perde; se a meta baixar, quem passa a cumpri-la recebe. Mudar os pontos da conquista vale dali em diante.
- **Desativar:** a conquista deixa de ser dada, e quem a tem continua com ela. Excluir só vale se ninguém a tiver.
- **Na tela:**
  - as obtidas aparecem coloridas, com a data;
  - as que faltam aparecem em cinza, com a meta e o progresso (37/50);
  - todas mostram a raridade: a porcentagem dos técnicos ativos (ou das equipes) que a têm;
  - não há conquista secreta.
- **Aviso:** "Conquista desbloqueada" (e "Nova patente") na próxima vez que a pessoa abrir a web ou o app.

### 7.2 Cadastro (admin)

| Campo | Obrigatório | Regra |
|---|---|---|
| Id | — | gerado |
| Título | sim | único |
| Descrição | sim | texto livre |
| Meta | sim | um critério da lista 7.3 e a quantidade (a patente, quando o critério é de patente). O sistema mostra a meta em texto, por exemplo "Complete 50 APRs" |
| Imagem | sim | o troféu; o admin envia; PNG, JPEG ou WebP, até 1 MB, quadrada (512 × 512 recomendado) |
| Pontos | sim | inteiro ≥ 0; o que a pessoa ganha ao obter a conquista (sugestão: 25 fácil, 50 média, 100 difícil). Nas conquistas de equipe, sempre 0 |
| Ativa | sim | |

O critério escolhido diz se a conquista é de pessoa ou de equipe.

### 7.3 Critérios da meta

Nenhum critério conta bloqueios ou interrupções de quem bloqueou ou interrompeu (regra 1).

**Pessoa**

| Critério | O que conta |
|---|---|
| APRs completas | lançamentos "APR completa" (um por OS) |
| Responsável pela APR | lançamentos "Responsável pela APR" |
| Execuções concluídas | lançamentos "Execução concluída" (encerrada ou interrompida por risco) |
| Preventivas em dia | lançamentos "Preventiva em dia" |
| Locais críticos | lançamentos "Local crítico" |
| OS retomadas | lançamentos "Resgate" |
| OS de apoio | lançamentos "Apoio a outra equipe" |
| Técnicos novos acompanhados | lançamentos "Técnico novo acompanhado" |
| Locais diferentes | locais de instalação distintos com execução concluída pela pessoa |
| Ciências no prazo | lançamentos "Ciência no prazo" (supervisor) |
| Intervalos definidos | lançamentos "Intervalo de preventiva definido" (supervisor) |
| Campo de treino | treino concluído (quantidade 1) |
| Pontos gerais | pontos desde a criação da conta |
| Pontos numa temporada | a melhor temporada da pessoa |
| Patente | alcançar a patente escolhida numa temporada |
| Posição | terminar uma temporada entre os N primeiros |
| Temporadas | temporadas com pelo menos 1 ponto |

**Equipe**

| Critério | O que conta |
|---|---|
| APRs da equipe | OS distintas com APR completa creditada à equipe |
| Execuções da equipe | OS distintas com execução concluída creditada à equipe |
| Preventivas em dia da equipe | OS distintas com "Preventiva em dia" creditada à equipe |
| Pontos gerais da equipe | soma geral |
| Patente da equipe | a média alcança a patente escolhida numa temporada |
| Posição da equipe | terminar uma temporada entre as N primeiras |
| Temporadas impecáveis | temporadas fechadas em que a equipe teve preventivas e nenhuma atrasada sem justificativa |

### 7.4 Carga inicial

Sugestão para a primeira carga, que o admin ajusta. Cada conquista vem com uma imagem simples.

**Pessoa**

| Título | Descrição | Meta | Pontos |
|---|---|---|---|
| Primeiro passo | Todo serviço seguro começa com uma APR. | 1 APR completa | 25 |
| Olho vivo | Cinquenta análises antes de pôr a mão no serviço. | 50 APRs completas | 50 |
| Guardião da APR | A segurança virou hábito. | 500 APRs completas | 100 |
| Líder de campo | Liderou a equipe na APR. | 50 vezes responsável pela APR | 50 |
| Mão na massa | Cinquenta serviços concluídos em campo. | 50 execuções concluídas | 50 |
| Veterano de campo | Quinhentos serviços concluídos em campo. | 500 execuções concluídas | 100 |
| Relógio suíço | O plano de manutenção em dia. | 25 preventivas em dia | 50 |
| Ponto crítico | De confiança onde a operação não pode parar. | 25 OS em locais críticos | 50 |
| Resgate | Retomou o que ficou pendente. | 5 OS retomadas | 50 |
| Reforço | Apoiou outra equipe quando ela precisou. | 3 OS de apoio | 50 |
| Mentor | Levou quem está chegando para aprender em campo. | 10 técnicos novos acompanhados | 50 |
| Explorador | Conhece a operação de ponta a ponta. | 20 locais diferentes | 50 |
| Pronto para o campo | Treinou antes de ir a campo. | Campo de treino concluído | 25 |
| De olho na equipe | Acompanhou de perto o trabalho da equipe. | 50 ciências no prazo | 50 |
| Planejador | Deixou o ciclo das preventivas pronto para avisar. | 10 intervalos definidos | 50 |
| Pódio | Entre os três melhores da temporada. | posição ≤ 3 numa temporada | 100 |
| Brilho de diamante | Chegou ao topo numa temporada. | patente Diamante | 100 |

**Equipe** (sem pontos)

| Título | Descrição | Meta |
|---|---|---|
| Equipe em campo | Cem serviços concluídos juntos. | 100 execuções da equipe |
| Plano em dia | Cem preventivas em dia. | 100 preventivas em dia da equipe |
| Temporada impecável | Uma temporada sem preventiva atrasada sem justificativa. | 1 temporada impecável |
| Equipe de ouro | A média da equipe chegou ao Ouro. | patente Ouro da equipe |
| Equipe diamante | A média da equipe chegou ao Diamante. | patente Diamante da equipe |
| Campeã da temporada | A melhor equipe da temporada. | posição 1 numa temporada |

---

## 8. Páginas

A web vem primeiro. A gamificação ganha uma seção própria no menu, **Gamificação**, com abas, como o Catálogo e o Dashboard: as mesmas páginas para todos os perfis, e só o admin edita, ali mesmo. O app recebe as páginas de consulta quando existir.

### 8.1 Páginas novas

A seção fica em `web/src/app/app/(portal)/gamificacao/(secao)/`, com o layout das abas (`layout.tsx`), e as abas de cada perfil ficam em `components/web/gamificacao/secao.ts`. `/app/gamificacao` sozinho abre "Minha pontuação"; o admin, que não joga, vai para o Ranking.

| Página | Endereço | Quem vê | O que tem |
|---|---|---|---|
| Minha pontuação | `/app/gamificacao/minha` | técnico (supervisor incluso) | a patente da temporada, com a imagem e a barra até a próxima; os pontos da temporada e os gerais; a maior patente; a posição na temporada e no geral; as últimas conquistas; o extrato, com filtro por temporada |
| Ranking | `/app/gamificacao/ranking` | todos | Pessoas ou Equipes; temporada atual, geral ou uma temporada fechada (`?tipo=` e `?temporada=`); a própria linha em destaque; os anônimos como "Participante anônimo" |
| Conquistas | `/app/gamificacao/conquistas` | todos | a galeria de pessoa e de equipe: as obtidas coloridas, com a data; as que faltam em cinza, com o progresso; a raridade e os pontos. **Admin:** nova, editar, trocar a imagem, desativar e excluir, numa janela |
| Patentes | `/app/gamificacao/patentes` | todos | a escada das patentes, com a imagem e os pontos de cada uma, e "você está aqui". **Admin:** nova, editar, trocar a imagem, desativar e excluir |
| Como pontuar | `/app/gamificacao/pontos` | todos | as tarefas, os pontos e as regras de cada uma (a seção 2 em linguagem simples). **Admin:** muda o valor e ativa ou desativa a tarefa ali mesmo |

Componentes novos, em `web/src/components/web/gamificacao/`:

- `secao.ts`: as abas por perfil;
- `SeloPatente.tsx`: a imagem e o nome da patente, usados na barra, no ranking, no perfil e na equipe;
- `CartaoPatente.tsx`: a patente com a barra até a próxima;
- `ExtratoPontos.tsx`;
- `TabelaRanking.tsx` e `SeletorTemporada.tsx`;
- `CartaoConquista.tsx` e `GaleriaConquistas.tsx`;
- `FormularioConquista.tsx` e `FormularioPatente.tsx`, na `JanelaModal`, com o envio da imagem;
- `TabelaRegras.tsx`;
- `AvisoConquista.tsx`: a janela "Conquista desbloqueada" ou "Nova patente";
- `PontosGanhos.tsx`: o aviso "+N pontos" depois de uma ação.

Também são novos o `web/src/data/gamificacao.ts` (as leituras da `api`, como os outros arquivos de `data/`) e o `web/src/styles/gamificacao.css`.

### 8.2 Páginas e componentes alterados

Os caminhos são relativos a `web/src/`.

| Onde | Arquivo | O que muda |
|---|---|---|
| Menu | `components/shell/itensDoMenu.ts` | o item "Gamificação" para todos, antes do Dashboard (que continua o último), com as abas no dropdown. O menu do Campo de treino não muda |
| Barra superior | `components/shell/Casca.tsx`, `Barras.tsx` e `MenuUsuario.tsx` | o selo da patente com os pontos da temporada, que leva a "Minha pontuação" (técnico, fora do treino); "Minha pontuação" no menu do usuário; a Casca abre o `AvisoConquista` quando há aviso pendente |
| Meu perfil | `app/app/(portal)/perfil/page.tsx` | a opção "Aparecer como anônimo no ranking" e o cartão da patente |
| Perfil de outra pessoa | `components/perfil/PerfilUsuario.tsx` (`/app/perfil/[id]`) | a patente da temporada, a maior patente e as conquistas da pessoa; nada disso para os outros se ela estiver anônima |
| Equipe e Minha equipe | `components/perfil/PerfilEquipe.tsx` (`/app/equipes/[id]` e `/app/usuarios`) | o bloco da equipe: soma, média, patente, posição e conquistas, e os pontos de cada membro na temporada, com os anônimos como anônimos |
| APR | `components/app/checklist/ChecklistScreen.tsx`, `components/app/aprovada/AprovadaScreen.tsx` e a tela de bloqueio | o "+N pontos" quando a APR completa é registrada: aprovada, ou bloqueada com a evidência |
| Execução | `components/app/execucao/FormularioEncerrar.tsx`, `FormularioInterromper.tsx` e `ExecucaoEncerrada.tsx` | o "+N pontos" ao encerrar ou ao interromper por risco |
| Ciência | `components/web/detalhe/BotaoCiencia.tsx` | o "+3 pontos" quando a ciência está no prazo |
| Ciclo das preventivas | `components/web/preventivas/EditorDoCiclo.tsx` | o "+3 pontos" ao definir o intervalo de um plano que estava sem |
| Envio de eventos | `lib/cliente-api.ts` (`enviarEvento`) | lê os pontos que a `api` devolve no `POST /eventos` |
| Auditoria | `data/auditoria.ts` e `components/web/auditoria/TabelaAuditoria.tsx` | as entidades `patente`, `conquista` e `regra_pontuacao`, com o link para a página de cada uma |
| Ícones | `components/ui/Icon.tsx` | o ícone de troféu, para o menu e as conquistas |
| Rotas e tipos | `lib/rotas.ts` e `lib/tipos.ts` | as rotas da seção; `ranking_anonimo` e o resumo da gamificação no usuário |
| Campo de treino | `treino/api-ficticia.ts` | nada obrigatório: a API fictícia não devolve pontos e responde `404` às rotas da gamificação. As telas precisam funcionar sem os pontos, e a barra não mostra o selo no treino |

### 8.3 Arquivos da `api`

Novos:

- `api/src/db/schema/gamificacao.ts` e a migração;
- `api/src/dominio/pontuacao.ts`: as regras da seção 2 e os lançamentos;
- `api/src/dominio/temporadas.ts`: a temporada de cada data e o fechamento;
- `api/src/dominio/ranking.ts`;
- `api/src/dominio/conquistas.ts`: os critérios e a concessão;
- `api/src/rotas/gamificacao.ts`;
- a carga inicial: as regras, as 5 patentes, as conquistas e as imagens.

Alterados:

- `dominio/eventos-apr.ts` e `dominio/eventos-execucao.ts`: os lançamentos ao aplicar a APR, o encerramento e a interrupção;
- `dominio/eventos.ts`: o `POST /eventos` devolve os pontos;
- `rotas/painel.ts`: a ciência;
- `rotas/me.ts`: o treino, a assinatura, o anonimato e o resumo no `GET /me`;
- `rotas/preventivas.ts` e `dominio/preventivas.ts`: o intervalo definido;
- `servicos/tarefas.ts`: o fechamento das temporadas;
- `servicos/armazenamento.ts`: o bucket `gamificacao`;
- `db/schema/plataforma.ts`: as entidades da auditoria.

### 8.4 App (quando existir)

O app recebe:
- Minha pontuação, Ranking e Conquistas, só para consulta;
- o aviso de conquista;
- o "+N pontos" nas telas de APR e de execução;
- a opção de anonimato no perfil.

Os cadastros (pontos, patentes e conquistas) ficam só na web.

---

## 9. Dados

| Tabela | Colunas | Nota |
|---|---|---|
| `regra_pontuacao` | `codigo` (PK), `nome`, `descricao`, `pontos`, `ativa`, `atualizada_em`, `atualizada_por` | códigos `apr_completa`, `responsavel_apr`, `execucao_concluida`, `preventiva_em_dia`, `local_critico`, `resgate`, `apoio`, `tecnico_novo`, `assinatura_cadastrada`, `treinamento_concluido`, `ciencia_no_prazo`, `intervalo_definido` e `conquista_obtida` (esta sem valor próprio: os pontos vêm da conquista; desativá-la desliga os pontos de todas). As tarefas são fixas no código, e o admin muda só o valor e o estado |
| `temporada` | `codigo` (PK, `2026-T4`), `nome`, `inicio`, `fim`, `fechada_em` | criada quando a primeira pontuação do trimestre chega |
| `lancamento_pontos` | `id`, `usuario_id`, `regra`, `pontos`, `chave`, `os_id`, `ocorrido_em`, `temporada`, `criado_em` | único (`usuario_id`, `chave`); índice (`temporada`, `usuario_id`) |
| `lancamento_equipe` | `lancamento_id`, `equipe_id` | PK composta; as equipes creditadas no momento |
| `patente` | `id`, `nome`, `pontos_necessarios`, `imagem_path`, `cor`, `descricao`, `ativa`, `criada_em`, `atualizada_em` | `pontos_necessarios` único entre as ativas |
| `conquista` | `id`, `titulo`, `descricao`, `criterio`, `quantidade`, `patente_id`, `pontos`, `imagem_path`, `ativa`, `criada_em`, `criada_por` | `patente_id` só nos critérios de patente; `pontos` = 0 nas de equipe |
| `conquista_usuario` | `conquista_id`, `usuario_id`, `obtida_em`, `vista_em` | PK composta; `vista_em` nulo = aviso pendente |
| `conquista_equipe` | `conquista_id`, `equipe_id`, `obtida_em` | PK composta |
| `temporada_usuario` | `temporada`, `usuario_id`, `pontos`, `patente_id`, `posicao` | gravada no fechamento |
| `temporada_equipe` | `temporada`, `equipe_id`, `pontos`, `membros`, `media`, `patente_id`, `posicao` | gravada no fechamento |
| `usuario.ranking_anonimo` | boolean, padrão `false` | |

- **Imagens:** ficam num bucket privado novo, `gamificacao`, e são servidas por URL assinada, como as outras.
- **Auditoria:** a trilha passa a registrar `patente`, `conquista` e `regra_pontuacao`.

---

## 10. Rotas e ordem de implementação

Rotas (todas autenticadas; as de cadastro só para o admin):

- `GET /gamificacao/eu` — a patente, os pontos da temporada e os gerais, a maior patente, a posição, as conquistas com o progresso e os avisos pendentes
- `GET /gamificacao/extrato?temporada=` — os lançamentos da própria pessoa
- `GET /gamificacao/ranking?tipo=pessoas|equipes&temporada=<codigo>|geral`
- `GET /gamificacao/equipes/{id}` — a soma, a média, a patente, as conquistas e os membros
- `GET /gamificacao/temporadas`
- `GET /gamificacao/regras`, `GET /gamificacao/patentes` e `GET /gamificacao/conquistas` — para todos, que consultam as abas "Como pontuar", "Patentes" e "Conquistas"
- `POST /gamificacao/avisos/vistos` — marca os avisos de conquista como vistos
- `PUT /me/ranking-anonimo` `{anonimo}`; o `GET /me` passa a trazer `ranking_anonimo` e um resumo (patente, pontos da temporada e avisos pendentes), usado pela barra superior
- As rotas que geram pontos (`POST /eventos`, `POST /os/{id}/ciencia`, `PUT /preventivas/{id}`, `PUT /me/assinatura` e `PUT /me/treinamento`) devolvem também `pontos_ganhos`, para o aviso "+N pontos"
- Admin:
  - `PATCH /gamificacao/regras/{codigo}`;
  - `POST /gamificacao/patentes`, `PATCH|DELETE /gamificacao/patentes/{id}` e `PUT /gamificacao/patentes/{id}/imagem`;
  - o mesmo conjunto em `/gamificacao/conquistas`.

Ordem de implementação (cada etapa entra com os testes da `api`, `tsc` e `eslint`, e a auditoria de cada cadastro entra com ele):

1. **Extrato e temporadas.**
   - `api`: as tabelas `regra_pontuacao`, `temporada`, `lancamento_pontos` e `lancamento_equipe`; as regras da seção 2 nas rotas que pontuam; a carga do histórico.
   - web: a seção Gamificação, com "Como pontuar" e "Minha pontuação" (pontos e extrato); o item de menu; o "+N pontos" nas telas de APR, execução, ciência e preventivas.

   Tudo depende disso.
2. **Patentes.**
   - `api`: o cadastro, as imagens e a carga dos 5 metais.
   - web: a aba Patentes; o `SeloPatente` e o `CartaoPatente` em "Minha pontuação" e na barra superior.
3. **Ranking e equipe.**
   - `api`: os rankings, o anonimato e o fechamento da temporada.
   - web: a aba Ranking, a opção de anonimato no perfil, o bloco da equipe e a patente no perfil de outra pessoa.
4. **Conquistas.**
   - `api`: o cadastro, os critérios, a concessão (inclusive a retroativa), os pontos da conquista, a raridade e a carga inicial.
   - web: a aba Conquistas, o `AvisoConquista` e as conquistas no perfil e na equipe.

---

## 11. Descartado e pendente

Descartado na discussão de 13/10/2026:

| Ideia | Por quê |
|---|---|
| Sequência (streak) de APRs completas | O servidor não enxerga a APR incompleta: a aprovada abandonada nunca chega a ele, e a bloqueada já é registrada na validação. A sequência viraria um simples contador |
| Ponto por sincronização offline | Incentivaria trabalhar offline de propósito |
| APR bloqueada valendo menos que a aprovada (3 × 5 no primeiro exemplo) | Faria marcar tudo "certo" para ganhar mais |
| APR pontuando por dia, e não por OS | Pagaria mais a quem estica o serviço por vários dias |
| Resgate valendo também para OS suspensa | A suspensão no fim do expediente é rotina; bastaria trocar quem vai no dia seguinte |
| Pontos para o supervisor por alerta lido ou OS pendente tratada | Dependeriam do número de bloqueios da equipe |
| Patentes com nomes de cargo (Trainee, Júnior, Pleno, Sênior) | Coincidem com cargos reais da empresa |
| Soma pura no ranking das equipes | A equipe maior ganharia só por ser maior |
| Temporada pelas datas das estações | Elas começam em dias diferentes a cada ano |

Pendente:

- Rever os limites das patentes no fim da primeira temporada real (seção 3.3).
- Trocar as imagens da carga inicial pelas definitivas.
- O bônus do formulário de inspeção, quando a estrutura dele for definida (questão 57).
- A conquista de sincronização offline precisaria de uma marcação de origem no evento enviado pela fila; fica para quando o app existir.

---

## 12. Implementação

Feita em 13/10/2026, nas quatro etapas da seção 10 de uma vez: a `api` (migração `0016_gamificacao`, `dominio/pontuacao.ts`, `lancamentos.ts`, `temporadas.ts`, `fechamento-temporada.ts`, `ranking.ts`, `conquistas.ts`, `patentes.ts`, `gamificacao-leituras.ts`, `gamificacao-cadastros.ts`, `rotas/gamificacao.ts`) e a web (a seção Gamificação, o selo na barra, os blocos do perfil e da equipe e o "+N pontos"). O que foi decidido ou acrescentado no caminho, além do que as seções acima já dizem:

- **A carga inicial entra pela migração.** As 13 tarefas, as 5 patentes e as 23 conquistas são `INSERT`s da própria `0016`: entram uma vez por banco, então o que o admin apagar ou ajustar não volta. As imagens (`imagem_path` = id do arquivo no bucket `gamificacao`) são gravadas pela subida da `api` se faltarem. São PNGs de 192 × 192 desenhados em código (medalha por metal, troféu por nível: bronze, prata, ouro; azul nas de equipe), simples de propósito.
- **O histórico entra na primeira subida com o extrato vazio**, numa transação só (se falhar, nada é gravado, a `api` sobe e a próxima subida tenta de novo). Usa as mesmas funções de pontuação dos eventos, e um teste confere que o extrato refeito do histórico é idêntico ao que as regras lançaram na hora. A assinatura já gravada de cada técnico também pontua na implantação. A demonstração (`pnpm demo:popular`) completa o extrato com o mesmo preenchimento.
- **Acréscimos ao desenho de dados:** `usuario.patente_avisada_id` e `patente_avisada_temporada` (o aviso "Nova patente" precisa lembrar a última patente avisada; sem chave estrangeira, para excluir uma patente não travar) e `temporada_equipe.impecavel` (guarda, no fechamento, se a equipe teve preventivas no trimestre e nenhuma atrasada sem justificativa).
- **Rotas acrescentadas:** `GET /gamificacao/usuarios/{id}` (o perfil de outra pessoa pedia a patente, a maior patente e as conquistas). `POST` de patentes e de conquistas é `multipart/form-data` (os campos e a `imagem`, obrigatória na criação); trocar a imagem é `PUT .../imagem`, e o arquivo antigo é apagado do bucket. `GET /gamificacao/eu`, o extrato e os avisos são só de quem joga (o admin recebe `403`). `GET /gamificacao/conquistas` traz também os critérios e as patentes que o formulário do admin usa.
- **Fechamento:** a temporada fecha no dia seguinte ao sétimo dia depois do último dia do trimestre (os 7 dias inteiros de tolerância valem), conferido de hora em hora pelo executor de tarefas. Quem foi desativado antes do fechamento não entra no resultado gravado; quem é desativado depois continua nele.
- **Equipe com pessoa desativada:** a soma continua com tudo o que foi creditado à equipe (inclusive o que a pessoa fez), mas a média divide só pelas pessoas de hoje (técnicos ativos e liberados mais o supervisor).
- **Preventiva em dia, atraso justificado:** "a OS ficou pendente antes da data" é ter havido, até a data limite, uma APR bloqueada, uma execução interrompida ou uma suspensa; `reprogramacao` também justifica.
- **Critérios de meta:** são 17 de pessoa e 7 de equipe. "Posição" e "Temporadas impecáveis" só contam em temporada fechada; "Patente" conta os pontos da melhor temporada (aberta ou fechada) contra a pontuação atual da patente-meta; a conferência repete até estabilizar (os pontos de uma conquista podem cumprir a meta de outra). Uma conquista de pessoa não vira de equipe, nem o contrário.
- **Remover um usuário** apaga o extrato, as conquistas e os resultados de temporada dele na mesma transação; o que continua impedindo a remoção é o histórico de campo (APR, execução, alerta).
- **O relógio é o da `api`:** um lançamento com data no futuro (relógio errado no aparelho) é trazido para agora, e o que chega com data de temporada fechada, ou já fora da tolerância, entra na temporada aberta.
- **Campo de treino:** a `api` fictícia não pontua e responde `404` às rotas da gamificação; a barra não mostra o selo e nenhuma tela do treino depende dos pontos. Concluir o treino na `api` real pontua (10) e concede "Pronto para o campo".
