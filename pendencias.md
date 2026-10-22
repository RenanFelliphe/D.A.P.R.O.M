# Pendências do SYNQ OS — 22/10/2026

Só o que ainda não foi realizado. Ao concluir um item, apague-o daqui; a regra em si fica no documento do assunto, em [docs/](docs/).

**Prioridade:** 🔴 bloqueia o MVP; 🟡 antes da apresentação; 🟢 extra ou depois do MVP. **Tipo:** código (o time faz), terceiros (espera alguém de fora) ou decisão (espera uma resposta).

## 1. Situação

| # | Item | Tipo | Prioridade |
|---|---|---|---|
| 1 | Ver o app num aparelho, online e em modo avião (APK em montagem; o `docker build` do `mobile/Dockerfile` nunca rodou) | código | 🔴 |
| 2 | Rodar a bateria inteira da Vitória (66 casos) contra a IA real; depende da cota | código | 🟡 |
| 4 | Servidor de e-mail (SMTP) | terceiros | 🟡 |
| 5 | Supervisor devolve a OS ao responsável em vez de assinar (questão 69) | decisão | 🟡 |
| 6 | Equipe com só 1 pessoa disponível (questão 72) | decisão | 🟡 |
| 10 | Reincidência | código | 🟢 |
| 11 | Tempo típico de serviço | código | 🟢 |
| 12 | Nota de passagem | código | 🟢 |
| 13 | Assinatura com validade jurídica: feita (api, web, app); falta a conta e o token da ZapSign, o teste no sandbox e decidir o plano de produção | terceiros | 🟡 |
| 14 | Login corporativo (conta Microsoft com segundo fator) | terceiros | 🟢 |
| 15 | Dados reais (planilha de 2025, critério de bloqueio, materiais, ciclo no SAP, formulário de inspeção) | terceiros | 🟢 |
| 16 | "Houve desvio?" e "Tempo parada" na folha do SAP (questão 70) | decisão | 🟢 |
| 17 | Mais de 3 executantes na folha do SAP (questão 71) | decisão | 🟢 |

O MVP está completo quando o caminho **ler OS → APR → executar → PDF**, com a OS encerrada no painel na hora, for visto num aparelho de verdade, online e sem sinal com o envio quando o sinal volta (item 1).

## 2. O que falta antes da apresentação

### 2.1 O app num aparelho

- **Montar o APK** (`pnpm apk` na pasta `mobile`, com Docker) e corrigir o `Dockerfile` se algum passo falhar (download do SDK, Gradle, R8, `apksigner`). Ver [mobile/README.md](mobile/README.md).
- **Roteiro da demo, ensaiado nos aparelhos da apresentação:** o caminho online no app e no navegador; o mesmo caminho em modo avião; a volta do sinal com a OS chegando ao painel; o envio com o app fechado.
- **Nunca visto rodando:** a assinatura desenhada com o dedo e o PNG gerado; a câmera, o seletor de PDF e o GPS; o banco SQLite abrindo; o NetInfo mudando no modo avião; a tarefa em segundo plano (a economia de bateria do fabricante pode adiá-la); o tempo da derivação da senha no Hermes; as figurinhas animadas da Vitória; o teclado nos campos longos e o botão voltar do Android.
- **Câmera da digitalização:** afinar `NITIDEZ_MINIMA` com fotos reais.

### 2.2 IA real (só dados fictícios)

- Rodar `pnpm vitoria:bateria` inteira (66 casos) e corrigir o que falhar ([ia-e-vitoria.md, seção 4.15](docs/ia-e-vitoria.md)). A primeira rodada parou na cota do Gemini gratuito.
- Testar contra a IA real a recomendação do modelo de APR, a APR em papel da digitalização (`pnpm pdf:digitalizado`) e a leitura de dados autorizada do chatbot e da criação de jogos.
- Depois do teste de leitura, escolher o modelo da digitalização e o limite de folhas por OS enviadas à IA.
- Ligar a Recomendação e a Digitalização antes da demo: vêm desligadas e só ligam com a assinatura do admin (ver 5.6).

### 2.3 Conferência visual e serviços reais

- Ver nas telas: controle da IA, validação dos treinamentos, Validações, mapa de calor (a radiação e as camadas), previsão do tempo (quadro, janela da APR, relatório), configurações e os formulários com React Hook Form (ordem do foco, mensagens dentro de tabelas e janelas).
- Rodar a previsão do tempo contra o Open-Meteo de verdade (os testes usam um provedor em memória).
- No banco da hospedagem oficial, se não for o de desenvolvimento: `pnpm demo:espalhar-gps` e, se quiser o mapa cheio, `pnpm demo:mais-os-mapa-calor`.

### 2.4 Código

- **Ver no aparelho (push, convite e emergência):** receber a notificação com o app fechado e abrir a tela certa ao toque; o convite entre dois aparelhos (aceitar, recusar, prazo de 15 minutos); o botão de emergência com e sem sinal (o aviso guardado que sobe depois) e o discador abrindo com o número.
- **Ver a assinatura com validade jurídica rodando:** nunca vista numa tela nem contra a ZapSign real. Conferir no sandbox: a aba do provedor abrindo no clique (pop-up da web) e o navegador do Android abrindo e voltando ao app; o formato de `GET /docs/{token}/` quando o signatário assina e quando recusa (a documentação só descreve `pending` e `signed`); se o sandbox limita documentos por mês; o webhook chegando à api publicada. A `AssinarConferencia` da web não recebe a OS, então o termo daquele ato sai sem o número dela.
- **Convite e push, o que ficou de fora:** o push de "OS nova" (não há aviso por OS importada; avisaria a equipe a cada leitura do SAP), convidar alguém de outra equipe (questões 10 e 72) e a notificação sem os serviços do Google (cairia no que o app consulta com a tela aberta).

- **Sugestão de materiais:** marcar "Cadastrar como novo" num item e depois tirá-lo no "Ajustar e aceitar" ainda cria o material (as `resolucoes` valem antes da `lista`).
- **Teste automático** da conferência dentro da fila de Validações (o cenário de dois aparelhos está em `api/test/conferencia-execucao.test.ts`).
- **Texto assinado do Chatbot:** `shared/ia/funcoes.ts` diz "da equipe", mas o código lê o escopo de quem pergunta. Alinhar o texto sobe a versão e exige nova assinatura do admin.

## 3. Funcionalidades novas (depois do MVP)

| # | Funcionalidade | O que é |
|---|---|---|
| 10 | **Reincidência** | Detectar OS corretiva repetida no mesmo local ou equipamento em N dias, mostrar no detalhe da OS e em "Precisa de atenção", e sugerir uma preventiva. N a definir com o Iago |
| 11 | **Tempo típico de serviço** | Tempo médio e mediana das execuções encerradas, por serviço do catálogo, mostrado na programação e no detalhe da OS, com alerta de execução fora do padrão. É um indicador observado, sem meta; não é SLA |
| 12 | **Nota de passagem** | Na OS pendente, quem interrompe ou suspende deixa uma nota estruturada ("onde parei, o que falta, o que já foi feito"), que a equipe lê ao retomar com a APR nova. Hoje quem retoma começa sem contexto |

## 4. Dependências de terceiros

| O quê | De quem | O que destrava |
|---|---|---|
| SMTP: servidor, porta, conta, remetente, SPF e DKIM do domínio, e o aceite do que vai nos e-mails (questão 68) | TI da empresa, pelo Iago | Os e-mails dos avisos e o resumo diário. Basta preencher `SMTP_URL`, `EMAIL_REMETENTE` e `PAINEL_URL` e conferir com `pnpm --dir api email:testar` |
| Assinatura com validade jurídica (ZapSign): conta e token do sandbox (`ASSINATURA_PROVEDOR=zapsign`, `ZAPSIGN_TOKEN`, webhook `/webhooks/zapsign?segredo=`); depois, a conta de produção e o plano (um documento por ato, ver [pessoas-e-equipes.md, seção 3.3](docs/pessoas-e-equipes.md)) | Conta e credenciais; o Iago diz se a assinatura eletrônica vale em auditoria (questão 38) | Assinatura aceita em auditoria. Sem token a api sobe com o provedor desligado (ou `ASSINATURA_PROVEDOR=simulado` para mostrar o fluxo sem conta) |
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
| Contatos do PAE (nome e telefone) | Segurança do Trabalho | Botão de emergência: o admin cadastra em Configurações › Sistema; até lá o botão mostra só SAMU e Bombeiros |
| Google Play Services nos aparelhos do piloto (questão 41) | TI da empresa | Notificação push: sem ele o aparelho não recebe (os avisos seguem no sino) |
| Projeto no Firebase, `google-services.json` e as credenciais do FCM na conta da Expo (`eas credentials`) | quem administra a conta da Expo | Notificação push chegando de verdade (e um APK novo, versão 0.2.0) |

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
- **Equipe com só 1 pessoa disponível:** hoje a APR é recusada (`participantes_insuficientes`) e a OS espera; a alternativa é chamar alguém de outra equipe (questão 72, ligada à 10; o convite de participação já existe, mas só para a equipe da OS).

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

### 5.7 Funcionalidades novas (seção 3)

- **Convite de participação:** o aceite bloqueia o início do checklist e o registro da APR para quem foi convidado (feito; o convite em si é opcional). Confirmar o bloqueio e o prazo de resposta de 15 minutos (`PRAZO_DO_CONVITE_MIN`), e se o convite deve ser obrigatório no app com sinal.
- **Reincidência:** em quantos dias, e por local, por equipamento ou pelos dois?

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
| — | Existe prazo de atendimento por criticidade (SLA, por exemplo "local crítico em 24 h")? O sistema não tem hoje; mediria o cumprimento junto do tempo típico de serviço | Iago |

## 7. Fora do MVP

- Escrita no SAP por API: a baixa é por planilha.
- iOS e terceiros no app.
- MFA, SSO e vínculo do aparelho com o usuário (RFC).
- Estoque, saldo e devolução de materiais, e baixa do material gasto.
- Cadastro de equipamentos como entidade (e o QR code que leria o equipamento no local).
- Importação de OS pelo supervisor (questão 63): só o admin importa.
- Horário individual por executante e função de trabalho na APR (questões 60 e 62).
- Conquista de colaboração ("5 sugestões aceitas") e sugestão de materiais sem sinal.
- Na digitalização: recorte automático dos cantos, captura automática, os riscos marcados "( )" da APR em papel e reatribuir a APR a outra OS na conferência.
- O nível em que a Vitória lê as OS livremente: ela só lê as listas autorizadas no controle da IA.
