# Pendências do SYNQ OS — 21/10/2026

O que falta para dar o MVP por completo, o que depende de terceiros, o que espera uma decisão e o que está fora do MVP. Cada item concluído é marcado aqui; a regra em si fica no documento do assunto, em [docs/](docs/). Os ajustes de interface e acabamento ficam para a rodada antes da apresentação e não estão listados.

## 1. Critério de conclusão do MVP

O critério de sucesso pede o caminho **ler OS → APR → executar → PDF**, com a OS encerrada aparecendo no painel na hora:

| Onde | Situação |
|---|---|
| No navegador, online | **Atende** |
| No app Android, online | **Atende no código**; falta ver num aparelho ou emulador |
| Num Android em modo avião, chegando ao painel quando o sinal volta | **Atende no código** (fila em SQLite, entrada sem sinal, envio com o app fechado); falta ver num aparelho, e o APK do `mobile/Dockerfile` nunca foi montado |

O MVP está completo quando as três linhas atenderem num aparelho de verdade e os itens 🔴 abaixo estiverem feitos.

## 2. Situação

**Prioridade:** 🔴 bloqueia o MVP; 🟡 antes da apresentação; 🟢 extra ou depois do MVP. **Tipo:** código (o time faz), terceiros (espera alguém de fora) ou decisão (espera uma resposta).

| # | Item | Tipo | Prioridade | Situação |
|---|---|---|---|---|
| 0 | Commitar as correções da Reunião 3 | código | 🔴 | [x] |
| 1 | App: esqueleto, login e lista e detalhe das OS | código | 🔴 | [x] no código |
| 2 | App: APR e execução online | código | 🔴 | [x] no código |
| 3 | App: perfil, assinatura, avisos, ausência, pontos e Vitória | código | 🔴 | [x] no código |
| 4 | Modo offline: cópia da equipe e fila em SQLite | código | 🔴 | [x] no código |
| 5 | Modo offline: entrada sem sinal e aviso de pendentes | código | 🔴 | [x] no código |
| 6 | Modo offline: envio com o app fechado | código | 🔴 | [x] no código |
| 7 | Dockerfile que gera o APK | código | 🔴 | [x] escrito; o `docker build` nunca rodou |
| 8 | Conquista de sincronização offline | código | 🟡 | [x] |
| 9 | Digitalização: pergunta antes da importação | código | 🟢 | [x] |
| 10 | Digitalização: PDF escaneado em lote (OCR e IA) | código | 🟢 | [x] |
| 11 | Digitalização: foto de folhas avulsas | código | 🟢 | [x] |
| 12 | Digitalização: APR em papel junto com a OS | código | 🟢 | [x] |
| 13 | React Hook Form e Zod nos demais formulários | código | 🟡 | [x] |
| 14 | Rodar a bateria inteira da Vitória (66 casos) contra a IA real | código | 🟡 | [ ] depende da cota da IA |
| 15 | Documentação consolidada em [docs/](docs/) | código | 🟡 | [x] |
| 16 | Servidor de e-mail (SMTP) | terceiros | 🟡 | [ ] |
| 17 | Assinatura com validade jurídica | terceiros | 🟢 | [ ] |
| 18 | Login corporativo (conta Microsoft com segundo fator) | terceiros | 🟢 | [ ] |
| 19 | Dados reais (planilha de 2025, critério de bloqueio, materiais, ciclo no SAP, formulário de inspeção) | terceiros | 🟢 | [ ] |
| 20 | Supervisor devolve a OS ao responsável em vez de assinar (questão 69) | decisão | 🟡 | [ ] |
| 21 | Equipe com só 1 pessoa disponível (questão 72) | decisão | 🟡 | [ ] |
| 22 | "Houve desvio?" e "Tempo parada" na folha do SAP (questão 70) | decisão | 🟢 | [ ] |
| 23 | Mais de 3 executantes na folha do SAP (questão 71) | decisão | 🟢 | [ ] |
| 24 | Execução compartilhada: acompanhar | código | 🟢 | [x] |
| 25 | Execução compartilhada: agir (na hora ou por pedido de 2 min) | código | 🟢 | [x] |
| 26 | Execução compartilhada: conferência do que foi feito sem sinal | código | 🟢 | [x] |
| 27 | Página Validações no app | código | 🟡 | [ ] |
| 28 | Textos de tela com regra antiga (pontuação, revisão do treinamento, simulador, IA desligada) | código | 🟡 | [x] |

## 3. O que falta antes da apresentação

### 3.1 O app num aparelho

- **Montar o APK** (`pnpm apk` na pasta `mobile`, com Docker) e corrigir o `Dockerfile` se algum passo falhar (download do SDK, Gradle, R8, `apksigner`). Ver [mobile/README.md](mobile/README.md).
- **Roteiro da demo, ensaiado nos aparelhos da apresentação:** o caminho online no app e no navegador; o mesmo caminho em modo avião; a volta do sinal com a OS chegando ao painel; o envio com o app fechado.
- **O que nunca foi visto rodando:** a assinatura desenhada com o dedo e o PNG gerado; a câmera, o seletor de PDF e o GPS; o banco SQLite abrindo; o NetInfo mudando no modo avião; a tarefa em segundo plano (a economia de bateria do fabricante pode adiá-la); o tempo da derivação da senha no Hermes; as figurinhas animadas da Vitória; o teclado nos campos longos e o botão voltar do Android.
- **Câmera da digitalização:** afinar `NITIDEZ_MINIMA` com fotos reais.

### 3.2 IA real (só dados fictícios)

- Rodar `pnpm vitoria:bateria` inteira (66 casos) e corrigir o que falhar ([ia-e-vitoria.md, seção 4.15](docs/ia-e-vitoria.md)). A primeira rodada parou na cota do Gemini gratuito.
- Testar contra a IA real a recomendação do modelo de APR, a APR em papel da digitalização (`pnpm pdf:digitalizado`) e a leitura de dados autorizada do chatbot e da criação de jogos.
- Depois do teste de leitura, escolher o modelo da digitalização e o limite de folhas por OS enviadas à IA.
- Ligar a Recomendação e a Digitalização antes da demo: elas vêm desligadas e só ligam com a assinatura do admin (ver 5.6).

### 3.3 Conferência visual e serviços reais

- Ver nas telas: controle da IA, validação dos treinamentos, Validações, mapa de calor (a radiação e as camadas), previsão do tempo (quadro, janela da APR, relatório), configurações e os formulários com React Hook Form (ordem do foco, mensagens dentro de tabelas e janelas).
- Rodar a previsão do tempo contra o Open-Meteo de verdade (os testes usam um provedor em memória).
- No banco da hospedagem oficial, se não for o de desenvolvimento: `pnpm demo:espalhar-gps` e, se quiser o mapa cheio, `pnpm demo:mais-os-mapa-calor`.

### 3.4 Código

- **Validações no app:** a mesma fila, ligada a `GET /me/validacoes` (a `api` e o contrato em `shared/api/validacoes.ts` estão prontos).
- **Sugestão de materiais:** marcar "Cadastrar como novo" num item e depois tirá-lo no "Ajustar e aceitar" ainda cria o material (as `resolucoes` valem antes da `lista`).
- **Teste automático** da conferência dentro da fila de Validações (o cenário de dois aparelhos está em `api/test/conferencia-execucao.test.ts`).
- **Texto assinado do Chatbot:** `shared/ia/funcoes.ts` diz "da equipe", mas o código lê o escopo de quem pergunta. Alinhar o texto sobe a versão e exige nova assinatura do admin.

## 4. Dependências de terceiros

| O quê | De quem | O que destrava |
|---|---|---|
| SMTP: servidor, porta, conta, remetente, SPF e DKIM do domínio, e o aceite do que vai nos e-mails (questão 68) | TI da empresa, pelo Iago | Os e-mails dos avisos e o resumo diário. Basta preencher `SMTP_URL`, `EMAIL_REMETENTE` e `PAINEL_URL` e conferir com `pnpm --dir api email:testar` |
| Assinatura com validade jurídica (ZapSign, token ou gov.br) | Conta e credenciais; o Iago diz se a desenhada vale (questão 38) | Assinatura aceita em auditoria |
| Login corporativo (conta Microsoft com segundo fator) e vínculo do aparelho com o usuário | Diretório da empresa (TI) | Uso real; hoje o registro simulado garante que só funcionário tenha conta |
| Planilha de OS de 2025 (questão 54) | Iago | Mapeamento definitivo da planilha e base fictícia mais fiel |
| Um PDF de OS gerado pelo SAP com texto | Iago | Conferir a leitura do PDF real (os exemplos são digitalizações) |
| Critério de bloqueio dos 8 modelos e a tabela de atividades (116 provisórias) | Mario e a Segurança do Trabalho | Modelos reais; a carga atual é provisória |
| Orientação real dos modelos (descrição, exemplos, palavras-chave) | Segurança do Trabalho e operação, cadastrada pelo admin | Recomendação do modelo mais certeira |
| Limites e frases da previsão do tempo (`LIMITES_DO_CLIMA`) | Segurança do Trabalho | Aviso de clima validado |
| Plano pago do Open-Meteo (o gratuito é só para uso não comercial) | Empresa | Previsão do tempo em produção |
| Lista de materiais por serviço (questão 65) | ES Gás | Catálogo de materiais real |
| Onde o SAP guarda o ciclo do plano (questão 66) e o formulário de inspeção (questão 57) | Iago | Preventivas com dado real |
| Aprovação para enviar dados ao fornecedor de IA, e se a assinatura do admin no controle da IA basta como registro dela | Empresa | Vitória com dados, recomendação por IA e digitalização no piloto |
| Ajustes do desenho da Vitória: marca da ES Gás, jugular do capacete, cabelo e cordão do crachá, a expressão `atencao` inteira | Empresa e Segurança do Trabalho | Avatar definitivo ([vitoria/README.md](vitoria/README.md)) |
| Documento de arquitetura (SharePoint e Power Apps) e tabela de equipes | Iago e Mario (prometidos na Reunião 2) | Equipes reais |

## 5. Decisões a confirmar com o usuário

O código já faz o que está descrito; a confirmação só muda o valor ou a regra citada.

### 5.1 Execução compartilhada ([operacao-de-campo.md, seção 6](docs/operacao-de-campo.md))

- **Prazos da conferência:** 72 h para fechar com o que existe e 7 dias (o Iago diz se o ritmo de folgas e turnos pede mais).
- **"Continuar" depois de pausa por lesão ou enfermidade:** qualquer participante, com confirmação reforçada; poderia ser só o supervisor ou o próprio acidentado.
- **Pausa de rotina feita por participante:** vale na hora, com aviso ao responsável; poderia virar pedido (`ACOES_COM_PEDIDO`).
- **Resultado divergente** (um suspendeu, outro encerrou) decidido pelo supervisor; horários e pausas, pelo responsável da conferência, com tolerância de 5 min.
- **O supervisor assina só depois da conferência**, para o relatório estar completo.

### 5.2 Itens que a Reunião 3 não fechou

- Na lesão e na enfermidade o complemento ("o que aconteceu") é opcional.
- A caixa do logotipo do PDF leva "SYNQ OS".
- O representante no comando assina por último no lugar do supervisor ausente.
- O relatório mostra o ponto do GPS e o endereço, sem calcular a distância entre eles.

### 5.3 Pessoas e equipes

- **Os 3 dias do representante** (`DIAS_SEM_ATIVIDADE`) são corridos; um feriado emendado o faria assumir sem ausência de fato (questão 67, para o Iago também).
- **Representante também ausente:** ninguém responde pela equipe até um dos dois voltar.
- **A `api` aceita apontar um admin como supervisor** de equipe. Bloquear?
- **Pedido de conta:** não traz a matrícula nem verifica que o e-mail é da própria pessoa.
- **Fila de pendências do admin** (liberações, sugestões, treinamentos), como a Validações do supervisor.
- **Supervisor devolve a OS ao responsável** em vez de assinar (questão 69).
- **Equipe com só 1 pessoa disponível:** hoje a APR é recusada (`participantes_insuficientes`) e a OS espera; a alternativa é chamar alguém de outra equipe (questão 72, ligada à 10).

### 5.4 Gamificação e treinamentos ([gamificacao-e-treinamentos.md](docs/gamificacao-e-treinamentos.md))

- **Sugestão de materiais:** 30 pontos ao autor na aceitação e 3 ao avaliador; a equipe responsável conta as OS do serviço de qualquer data (poderia ser só o último ano).
- **Criar e validar treinamento pontuam?** Quanto, e só na aprovação ou também na recusa.
- **Validação de treinamento parada:** sem prazo hoje (proposta: 7 dias).
- **Reportes de problema dos técnicos:** só ao admin ou também à equipe responsável.
- **Limites do rascunho pela IA** (3 treinamentos, 4 rodadas) globais ou por pessoa.
- **Patentes:** rever os limites no fim da primeira temporada real e trocar as imagens provisórias.

### 5.5 Sistema

- **Configurações:** atalho para outros limites (como os pontos da gamificação).
- **Pull incremental** (questão 4): hoje a cópia da equipe é um snapshot completo; o cursor fica para quando o volume pedir.
- **Telas de gestão no app** (questão 55): hoje o app tem só as de campo.
- **APR de hoje de outra pessoa:** reservar a OS a outra pessoa deixa sem uso a APR aprovada do dia.

### 5.6 IA

- **Quem assina para ligar a Recomendação e a Digitalização na demonstração** (ligar por script não teria a assinatura de uma pessoa real).

## 6. Perguntas em aberto aos especialistas

Os números são os da antiga lista de questões, para rastreio. Cada uma já tem uma solução adotada no código; a resposta só ajusta o que está citado.

| # | Pergunta (e o que vale hoje) | Quem responde |
|---|---|---|
| 3 | Uma OS pode exigir mais de um modelo de APR (APR 03 e APR 06 juntas)? Hoje, um modelo por APR | Mario |
| 5 | Qual é o código de uma ordem cancelada no SAP? E uma ordem `ENCE LIB` (exemplo 4031236) continua com o `LIB`? Hoje ela entra como liberada | Iago |
| 8 | A APR vale para uma execução, no dia em que foi concluída? | Iago e Mario |
| 9 | "NA" em item eliminatório: hoje passa com observação, só onde o item permite | Mario |
| 10 | Alguém de fora da equipe (apoio, terceiro) pode ser participante da APR? Hoje, só a equipe da OS | Iago e Mario |
| 12, 13 | A OS de apoio (aba Sem ordem SAP) e os impedimentos (aba Impedimentos) na planilha de baixa servem ao SAP? | Iago |
| 21, 22 | Supervisor e admin reprogramam e abrem OS de apoio para qualquer equipe: confere com a prática? | Iago |
| 24 | Domínio do e-mail institucional e homônimos (dois `joao.silva`) | TI da empresa |
| 26 | Volume: ~390 ou ~900 OS por mês? | Iago |
| 27 | O solicitante da OS fica opcional, só no PDF? | Iago |
| 28 | Observação geral e contatos de emergência (PAE) no modelo e no PDF? | Mario |
| 29 | Só OS liberadas no SAP descem para a equipe? | Iago |
| 33 | OS do módulo MM (APR 09, almoxarifado) entram na leitura de manutenção? | Iago |
| 35 | O celular precisa ser intrinsecamente seguro em área classificada? | Mario |
| 36 | Terceiros usam o app? Hoje, não | Iago |
| 38 | A assinatura desenhada vale para auditoria? | Iago |
| 40, 51 | As colunas da planilha de baixa servem? O encerramento não atualiza o SAP por API | Iago |
| 41 | Aparelhos do piloto e versão mínima do Android; têm Google Play Services (PDAs industriais costumam não ter)? | TI da empresa |
| 48 | Preventiva pendente do ciclo anterior e a OS nova do mês: hoje, sem vínculo automático | Iago |
| 50 | Quais itens aceitam justificativa em texto no lugar de foto? | Mario |
| 54 | Planilha de OS de 2025 (ver seção 4) | Iago |
| 56 | Algum gestor puro, que não executa, precisaria de um perfil próprio? | Iago |
| 57 | O checklist de inspeção por plano cobre o formulário real, ou as perguntas precisam de tipo (número com unidade, opções)? | Iago |
| 59 | Só as medidas dos riscos marcados são respondidas? Marcar nenhum risco é permitido? | Mario |
| 60 | "Função da atividade" nas APR 04, 05 e 09: cargo ou papel? Hoje, só `responsavel` e `executor` | Mario |
| 61 | O item de espaço confinado da APR 06 aceita "NA"? Hoje, sim, com observação | Mario |
| 62 | Horário de início e fim por executante? Hoje, um por execução | Iago |
| 65 | Lista de materiais por serviço e código do material no SAP | ES Gás |
| 66 | Onde o SAP guarda o ciclo do plano e se conta do encerramento da última ordem ou da data planejada | Iago |
| 67 | Os 3 dias sem atividade do supervisor descontam fim de semana e feriado? | Iago |
| 68 | SMTP (ver seção 4) | TI, pelo Iago |
| 70 | "Houve desvio?" e "Tempo parada" na folha do SAP: hoje em branco. Na Reunião 2 (57:04) o Iago disse que o tempo de parada fica em branco quando não há e que a duração dá para calcular. Preencher com pausas e suspensões? | Iago |
| 71 | Mais de 3 executantes na folha: o Iago disse (Reunião 2, 59:55) que no máximo 3 executam. Hoje os extras seguem em novas linhas de blocos; basta? | Iago |
| — | Quem lê a aba Devolvidas e corrige a ordem no SAP | Iago |
| — | Até quando vai o acervo de OS antigas e quem as digitaliza | Iago |

## 7. Fora do MVP

- Escrita no SAP por API: a baixa é por planilha.
- Notificação push no celular: a OS nova aparece quando a lista é atualizada.
- iOS e terceiros no app.
- MFA, SSO e vínculo do aparelho com o usuário (RFC).
- Estoque, saldo e devolução de materiais, e baixa do material gasto.
- Escolha automática do modelo da APR: o técnico escolhe a cada APR.
- Atraso na entrega da OS para o supervisor triar antes da equipe: a reserva visível resolve.
- Cadastro de equipamentos como entidade.
- Importação de OS pelo supervisor (questão 63): só o admin importa.
- Horário individual por executante e função de trabalho na APR (questões 60 e 62).
- Conquista de colaboração ("5 sugestões aceitas") e sugestão de materiais sem sinal.
- Na digitalização: recorte automático dos cantos, captura automática, os riscos marcados "( )" da APR em papel e reatribuir a APR a outra OS na conferência.
- O nível em que a Vitória lê as OS livremente: ela só lê as listas autorizadas no controle da IA.
