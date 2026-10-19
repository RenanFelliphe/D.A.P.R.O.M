# Pendências para concluir o MVP — diagnóstico em 18/10/2026

> O que falta para dar o MVP do SYNQ OS como completo. **É o guia de trabalho a partir de agora:** cada item concluído é marcado aqui e registrado no arquivo da própria demanda, na pasta [funcionalidades/](funcionalidades/).
>
> O diagnóstico saiu da leitura do código da `api` e da `web` e dos documentos: [funcionalidades.md](funcionalidades.md), [especificação](base/.design/especificacao.md), [DesignDoc](DesignDoc.md), [Questoes.md](Questoes.md) e [correções da Reunião 3](funcionalidades/correcoes-da-reuniao-3.md). Em 18/10/2026 o `tsc` da `api` e da `web` saiu sem erros. Os ajustes de interface, design e UX ficam para a rodada antes da apresentação final e não estão listados aqui.

## Critério de conclusão

A seção "Sucesso" da especificação pede o caminho **ler OS → APR → executar → PDF**:

| Onde | Situação |
|---|---|
| No navegador, online | **Atende** |
| No app Android, online | **Não atende:** o app não existe |
| Num Android em modo avião, chegando ao painel quando o sinal volta | **Não atende:** não há fila local nem login sem sinal |

O MVP está completo quando as três linhas atenderem e os itens 🔴 da tabela abaixo estiverem feitos.

## Tabela de pendências

**Prioridade:** 🔴 bloqueia o MVP; 🟡 deve entrar antes da apresentação; 🟢 extra ou depois do MVP.
**Tipo:** código (o time faz), terceiros (espera alguém de fora) ou decisão (espera uma resposta do cliente ou do time).

| # | Pendência | Tipo | Prioridade | Depende de | Situação |
|---|---|---|---|---|---|
| 0 | Commitar as correções da Reunião 3 | código | 🔴 | — | [ ] |
| 1 | App Android: esqueleto, login e lista/detalhe das OS | código | 🔴 | 0 | [ ] |
| 2 | App Android: APR e execução online | código | 🔴 | 1 | [ ] |
| 3 | App Android: perfil, assinatura, avisos e gamificação | código | 🔴 | 1 | [ ] |
| 4 | Modo offline: cópia da equipe e fila em SQLite | código | 🔴 | 2 | [ ] |
| 5 | Modo offline: login sem sinal e aviso de pendentes | código | 🔴 | 4 | [ ] |
| 6 | Modo offline: envio em segundo plano | código | 🔴 | 4 | [ ] |
| 7 | Dockerfile que gera o APK | código | 🔴 | 1 | [ ] |
| 8 | Conquista de sincronização offline (gamificação) | código | 🟡 | 4 | [ ] |
| 9 | Digitalização: pergunta antes da importação | código | 🟢 | — | [x] 19/10/2026 |
| 10 | Digitalização: PDF digitalizado em lote (OCR + IA) | código | 🟢 | 9 | [x] 19/10/2026 |
| 11 | Digitalização: foto de folhas avulsas | código | 🟢 | 10 | [ ] |
| 12 | Digitalização: APRs antigas | código | 🟢 | 10 | [ ] |
| 13 | Validação (React Hook Form e Zod) nos demais formulários | código | 🟡 | — | [ ] |
| 14 | Rodar a bateria inteira da Vitória (53 perguntas) | código | 🟡 | cota da IA | [ ] |
| 15 | Atualizar README, especificação e READMEs da `api` e da `web` | código | 🟡 | 1 a 7 | [ ] |
| 16 | Configurar o servidor de e-mail (SMTP) | terceiros | 🟡 | TI da empresa | [ ] |
| 17 | Assinatura com validade jurídica (ZapSign, gov.br) | terceiros | 🟢 | conta e Iago (questão 38) | [ ] |
| 18 | Login corporativo (conta Microsoft com segundo fator) | terceiros | 🟢 | diretório da empresa | [ ] |
| 19 | Dados reais: planilha de 2025, critério de bloqueio, materiais, ciclo no SAP, formulário de inspeção | terceiros | 🟢 | Iago, Mario, ES Gás | [ ] |
| 20 | Supervisor devolve a OS ao responsável em vez de assinar | decisão | 🟡 | questão 69 | [ ] |
| 21 | Equipe com só 1 pessoa disponível (mínimo de 2 na APR) | decisão | 🟡 | questão 72 | [ ] |
| 22 | "Houve desvio?" e "Tempo parada" na folha do SAP | decisão | 🟢 | questão 70 | [ ] |
| 23 | Mais de 3 executantes na folha do SAP | decisão | 🟢 | questão 71 | [ ] |

**Ordem sugerida:** 0 → 1 → 2 → 3 → 7 → 4 → 5 → 6 → 8, com as 🟡 em paralelo quando houver folga. A digitalização (9 a 12) corre à parte, quando o app online já estiver de pé, ou antes, se a apresentação precisar dela.

---

## 1. Antes de tudo

### 0. Commitar as correções da Reunião 3

- **Situação:** 177 arquivos alterados ou novos estão fora do git, entre eles a migração `0032_execucao_em_dois_passos_e_assinaturas` (já aplicada no banco de desenvolvimento, que é o Supabase real), a assinatura da APR por participante, o encerramento em dois passos, os motivos de parada, a localização e o relatório da execução.
- **Por que primeiro:** o app é construído sobre esse contrato. Perder ou misturar esse trabalho com o do app custa caro, e a migração já aplicada não pode ser regerada.
- **Como:** commits separados por assunto (`api`, `web`, documentação), com os testes da `api` rodados antes.

## 2. App Android e modo offline (bloqueiam o MVP)

**O plano detalhado, em 20 etapas, está em [funcionalidades/mobile.md](funcionalidades/mobile.md).** Os itens 1 a 8 abaixo são o resumo; o andamento é marcado lá e aqui.

A `api` já está pronta para o app: envio idempotente (`POST /eventos`), snapshot da equipe (`POST /sync/pull`), a regra dos 60 s que reconhece o evento da fila, o início da execução que fica pendente esperando a assinatura de outro aparelho, a assinatura presencial (`assinatura_presencial: true`) e o aviso de relógio errado do aparelho no detalhe da OS. **O app é um cliente:** as regras de negócio já vivem no servidor.

A referência das telas é a `web` em `/app/*`. As regras que o app herda da Reunião 3 estão no [README do mobile](mobile/README.md).

**Stack recomendada:** React Native com Expo (câmera, SQLite, armazenamento seguro e geração local do APK), como na Decisão-chave 1 da especificação.

### 1. Esqueleto, login e OS da equipe

- Projeto Expo em `mobile/`, Android, TypeScript.
- Login pelo e-mail institucional, troca da senha provisória e a assinatura obrigatória depois da liberação (`403 assinatura_pendente`).
- Lista das OS da equipe (`GET /os`) e detalhe (`GET /os/{id}`), com a reserva ("Reservada para você"), a devolução e os materiais recomendados.

### 2. APR e execução online

- **APR:** a janela de escolha do modelo, com a recomendação e a troca (`GET /os/{id}/modelos-apr`); o checklist inteiro, sem mostrar o que é eliminatório; a validação em `POST /aprs/avaliar`; a evidência dos itens reprovados (foto, texto ou PDF); o mínimo de 2 participantes.
- **Assinaturas da APR:** cada participante assina na própria conta (`apr_assinada`) ou recusa (`apr_recusada`); a faixa "APR aguardando a sua assinatura" (`GET /me/aprs-para-assinar`).
- **Execução:** iniciar, pausar e suspender com motivo, interromper por risco (motivo, foto e assinatura), cancelar por engano, encerrar em dois passos (`execucao_encerrada` e, depois, `encerramento_assinado` com o checklist de inspeção).
- **Localização** nos cinco momentos, sem bloquear o serviço quando não houver GPS.
- **Câmera nativa**, com a foto comprimida a ~1600 px e qualidade 70% (questão 16), e envio por `PUT /arquivos/{id}` antes do evento.

### 3. Perfil, assinatura, avisos e gamificação

- Perfil com a assinatura desenhada e o histórico das OS encerradas do próprio técnico (60 dias).
- O sino de avisos.
- Gamificação só de consulta: Minha pontuação, Ranking, Conquistas, os avisos de conquista e de patente, o "+N pontos" das telas de APR e de execução e o anonimato no perfil ([gameficacao.md](funcionalidades/gameficacao.md), seção 8.4).
- A Vitória no app.
- O indicador "Online", que saiu da web e ficou para o app.
- Quais telas de gestão entram no app fica para depois da demo (questão 55).

### 4. Modo offline: cópia da equipe e fila

- Cópia local da equipe por `POST /sync/pull`, com a escolha do modelo de cada OS e a orientação dos modelos.
- Fila de eventos e de arquivos em SQLite: toda ação de campo é gravada na fila e enviada em seguida (os arquivos antes dos eventos).
- Sincronização automática ao abrir o app e ao voltar o sinal, e o botão "Sincronizar".
- O snapshot nunca apaga do aparelho uma OS com evento local pendente.
- APR offline com `assinatura_presencial: true` no aparelho do responsável.

### 5. Login sem sinal e aviso de pendentes

- Hash salgado da senha guardado no aparelho, válido por até 7 dias desde o último login online.
- "Sem conexão — N registros pendentes" e "Sincronizado hh:mm".
- Logout recusado enquanto houver fila.

### 6. Envio em segundo plano (item 18 da Reunião 3)

- Com o app aberto, a fila sai assim que o sinal volta.
- Com o app fechado, sai no próximo intervalo que o Android libera (por volta de 15 minutos).

### 7. Dockerfile que gera o APK

- Exigido pela Decisão-chave 1 da especificação ("cada uma com Dockerfile") e pelo padrão do DesignDoc.

### 8. Conquista de sincronização offline

- A gamificação prevê a conquista, mas ela não existe na carga (`api/src/db/seed/gamificacao-dados.ts`). Precisa que o evento da fila seja reconhecido como vindo dela, o que a regra dos 60 s já faz na `api`.

## 3. Digitalização de OS antigas (extra)

A especificação deixa o escaneamento para depois do MVP, mas ele é prioridade no DesignDoc e foi redesenhado na Reunião 3 (item 15 do [resumo](base/reunioes/correcoes-reuniao-3-resumo.md)). O desenho anterior está na seção 10 do [vitoria.md](funcionalidades/vitoria.md#10-digitalização-de-os-antigas).

**Hoje (19/10/2026):** os itens 9 e 10 estão feitos (detalhes em [vitoria.md, seção 10](funcionalidades/vitoria.md#10-digitalização-de-os-antigas)). A câmera da tela de importação ainda só abre e captura, sem ler nem enviar (item 11); das APRs antigas não há nada (item 12).

### 9. Pergunta antes da importação — feito em 19/10/2026

- Antes de abrir o seletor de arquivos, a tela pergunta se a OS **já foi concluída no papel** ou se é **para liberar no sistema**, com uma explicação curta de cada caminho.
- **Para liberar:** o PDF padrão, como hoje.
- **Feito:** a janela `PerguntaDaImportacao` abre ao clicar no cartão Importação ou ao soltar um arquivo sobre ele; só depois da escolha o seletor de arquivos abre (o de "papel" aceita só PDF). O PDF sem texto enviado pelo caminho "para liberar" é recusado com a mensagem que aponta para o caminho do papel.

### 10. PDF digitalizado em lote — feito em 19/10/2026

- O OCR local lê o que consegue; a IA de visão entra só nos recortes que o OCR não lê (a parte escrita à mão), já que a folha do SAP tem formato fixo.
- Assinaturas e rubricas ficam como imagem, sem transcrição.
- A OS entra **encerrada, como histórico**, e o admin confere o que foi lido antes de registrar (pode reaproveitar a conferência do PDF de hoje).
- O modelo de IA e os demais pontos em aberto da seção 10 do [vitoria.md](funcionalidades/vitoria.md#10-digitalização-de-os-antigas) precisam ser fechados antes; o primeiro passo é testar a leitura com folhas fictícias.
- **Descartado:** treinar um modelo próprio (LGPD e falta de folhas transcritas).
- **Feito:** tarefa em segundo plano `digitalizacao` (PDF → folhas → OCR Tesseract local → IA de visão só no manuscrito → conferências), leitura guardada, tela de conferência com as folhas ao lado e registro das OS como `encerrada` de histórico (`os.origem = digitalizacao`, `os_digitalizacao`, PDF das folhas). **Fora (itens 11 e 12):** foto de folhas avulsas pela câmera e a APR antiga. **Em aberto:** o modelo de IA (testar com `pnpm pdf:digitalizado` e o Gemini; o Claude segue como destino com dados reais) e a escolha do limite de folhas por OS enviadas à IA.

### 11. Foto de folhas avulsas

- Continua para 1 ou 2 folhas avulsas, pelo mesmo caminho do lote.

### 12. APRs antigas

- Não há nada definido. Decidir se entram junto com a OS digitalizada ou ficam fora.

## 4. Antes da apresentação

### 13. Validação nos demais formulários (item 16 da Reunião 3)

- Os formulários da Reunião 3 já usam React Hook Form com Zod ([correções da Reunião 3](funcionalidades/correcoes-da-reuniao-3.md), seção 6).
- **Faltam:** usuários, equipes, modelos de APR, OS de apoio, reprogramação, simuladores e os demais da gestão, que ainda desativam o botão sem dizer por quê. Foi uma reclamação direta do Mario.

### 14. Bateria da Vitória

- `pnpm vitoria:bateria`, 53 casos (15 de provocação). A primeira rodada parou na cota diária do Gemini gratuito; falta rodá-la inteira e corrigir o que falhar ([vitoria.md](funcionalidades/vitoria.md), seção 2.9.1).

### 15. Documentação desatualizada

Lista completa na seção 7.2 do [funcionalidades.md](funcionalidades.md). Em resumo:

- **[README.md](README.md):** ainda fala em telas ilustrativas e em arquitetura "não implementada".
- **[Especificação](base/.design/especificacao.md):** a "Situação" diz que só a `web` tem código, o Campo de treino aparece "EM CONSTRUÇÃO" e a seção "Protótipo" lista diferenças que já não existem.
- **[api/README.md](api/README.md)** e **[web/README.md](web/README.md):** rotas, permissões, logins e telas desatualizados.
- **Comentário** em `api/src/rotas/sap.ts` sobre quem abre a OS de apoio.
- **Código sem uso na web:** a propriedade `aviso` do `Button` e um `return` inalcançável em `app/app/treino/estado/route.ts`.

Fica para o fim, depois do app, para atualizar tudo de uma vez.

## 5. Dependem de terceiros

| # | O quê | De quem | O que destrava |
|---|---|---|---|
| 16 | Servidor de e-mail (SMTP): endereço, porta, conta, remetente e SPF/DKIM | TI da empresa, pelo Iago (questão 68) | Os e-mails dos avisos e o resumo diário. O código está pronto: basta preencher `SMTP_URL`, `EMAIL_REMETENTE` e `PAINEL_URL` e conferir com `pnpm --dir api email:testar` |
| 17 | Assinatura com validade jurídica (ZapSign, token ou gov.br) | Conta e credenciais; o Iago diz se a desenhada vale (questão 38) | Assinatura aceita em auditoria. Hoje vale a desenhada no perfil |
| 18 | Login corporativo (conta Microsoft com segundo fator) | Acesso ao diretório da empresa | Uso real; hoje o registro de funcionários simulado garante que só funcionário tenha conta |
| 19 | Dados reais | Iago (planilha de 2025, ciclo no SAP, formulário de inspeção, PDF do SAP com texto), Mario e a Segurança do Trabalho (critério de bloqueio dos 8 modelos, questões 59 e 61), ES Gás (materiais por serviço, questão 65) e a empresa (aprovação para enviar dados ao fornecedor de IA) | O piloto. Para a demo, a carga fictícia basta |

## 6. Decisões em aberto

Detalhadas em [Questoes.md](Questoes.md).

| # | Questão | Impacto se a resposta for "sim" | Hoje |
|---|---|---|---|
| 20 | O supervisor pode devolver a OS ao responsável em vez de assinar? (69) | Funcionalidade nova: a OS volta ao encerramento, com regras próprias | O supervisor só assina |
| 21 | O que faz a equipe com só 1 pessoa disponível? (72) | Participante de outra equipe na APR | A APR é recusada (`participantes_insuficientes`) e a OS espera |
| 22 | O SYNQ OS preenche "Houve desvio?" e "Tempo parada"? (70) | Ajuste pequeno no PDF | Em branco, como no papel |
| 23 | O que fazer com mais de 3 executantes na folha? (71) | Ajuste pequeno no PDF | Os extras seguem em novas linhas de blocos |

## 7. Fora do MVP, por decisão

Não entram nesta lista (seção 7.4 do [funcionalidades.md](funcionalidades.md)): escrita no SAP por API, notificação push, iOS, terceiros no app, MFA e vínculo do aparelho com o usuário (RFC), estoque e baixa de material, escolha automática do modelo da APR, atraso na entrega da OS, cadastro de equipamentos como entidade, importação de OS pelo supervisor e o nível 4 da Vitória (a IA lendo as OS).
