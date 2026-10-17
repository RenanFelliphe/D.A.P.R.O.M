# SYNQ OS — resumo das funcionalidades

**APR e Ordens de Manutenção 100% digitais.** Do recebimento da OS ao PDF assinado, sem papel.

> Tudo o que está listado abaixo funciona hoje na `api` e na `web`, com **dados fictícios**. O SAP e o registro de funcionários são simulados dentro do próprio sistema, com o mesmo contrato que a empresa usaria. O app Android e o modo offline ainda não foram iniciados (ver o final).

## Em uma frase

O SYNQ OS obriga a equipe de campo a analisar os riscos **antes** de executar cada Ordem de Manutenção, bloqueia a execução quando a APR reprova e guarda tudo (respostas, fotos, assinaturas, horários) num registro digital que a gestão consulta na hora.

## O sistema em números

| | |
|---|---|
| Modelos de APR na carga inicial | **8** (APR 01 a 07 e APR 09), com 65 riscos e 287 itens |
| Serviços no catálogo | **116** |
| Dashboards | **5** |
| Tipos de alerta | **19** |
| Tarefas que pontuam | **16** |
| Patentes | **5** (Bronze, Prata, Ouro, Platina e Diamante) |
| Conquistas | **26** (17 de pessoa, 6 de equipe e 3 de treinamento) |
| Tipos de fase nos treinamentos | **5** |
| Passos do tutorial do Campo de treino | **18** |
| Testes automatizados | **mais de 700** |

## Quem usa

| Perfil | O que faz |
|---|---|
| **Técnico** | Recebe as OS da equipe, faz a APR, executa e encerra. Joga a gamificação e os treinamentos |
| **Supervisor** | É o técnico designado como supervisor da equipe. Faz tudo o que o técnico faz e ainda gerencia a equipe: ciência, reserva e devolução de OS, reprogramação, ausências, cadastro de técnicos, ciclo das preventivas |
| **Admin** | Cuida da plataforma: importação de OS, modelos de APR, catálogo, usuários, equipes, gamificação, treinamentos e auditoria. **Não executa OS** |

A Segurança do Trabalho não usa o sistema: ela define o critério de bloqueio da APR, e o admin o cadastra no editor de modelos.

## O caminho de uma OS

1. **Entra** pelo SAP (leitura automática), por planilha ou pelo PDF da OS.
2. **A equipe faz a APR** da OS: escolhe o modelo, marca os riscos e responde o checklist inteiro.
3. **O servidor valida.** Item eliminatório reprovado bloqueia a execução: a OS fica pendente e o supervisor recebe alerta e e-mail.
4. **APR aprovada**: os participantes assinam e a execução é liberada.
5. **Execução**: início, pausas, evidências e encerramento com as assinaturas.
6. **Sai o PDF** de 2 páginas (APR e OS), o supervisor dá ciência e a OS entra na planilha de baixa do SAP.

---

## Funcionalidades

### 1. Acesso e conta

- Login pelo **e-mail institucional**. Não há recuperação por conta própria: o admin redefine a senha, e ela aparece uma única vez.
- **Senha provisória** trocada no primeiro acesso.
- **Assinatura desenhada** no perfil: é a primeira coisa a cadastrar depois da liberação, para todos os perfis. Sem ela, nada abre.
- **Técnico pendente**: o técnico cadastrado pelo supervisor entra, troca a senha, faz o Campo de treino e os treinamentos de serviço, e espera o admin liberar ou recusar (com motivo). A tela de espera confere a liberação sozinha.
- **Estados que travam a conta**: senha provisória, pendente, sem assinatura, ausente (só leitura), desativado e recusado.
- Cada pessoa só vê o que é da(s) sua(s) equipe(s).

### 2. Entrada de OS

- **Leitura automática do SAP**, a cada 15 minutos (configurável), ou na hora pelo botão "Sincronizar agora".
- **Planilha** .xlsx, com cabeçalhos reconhecidos sem exigir ordem de colunas.
- **PDF da OS** impresso pelo SAP: o sistema lê, mostra a conferência campo a campo ao lado do PDF, e o admin escolhe quais OS registrar. Um PDF pode trazer várias OS.
- A **equipe** é atribuída sozinha, pelo centro de trabalho. O local e a atividade novos são cadastrados na leitura.
- **Regras:**
  - só entra OS liberada no SAP (`LIB`); as demais são ignoradas, com o motivo;
  - ler de novo nunca duplica nem reabre OS encerrada;
  - OS cancelada ou encerrada no SAP vira cancelada aqui. Se havia execução em andamento, ela segue e sai um alerta de conflito;
  - a reprogramação feita no sistema vence a data do SAP;
  - falha de leitura não altera nada e gera o alerta de falha de importação.
- **Histórico de importações** (admin): resultado de cada leitura ou arquivo, linhas ignoradas com o motivo e a data da última leitura sem erro.
- Nenhuma OS é criada à mão. A única que nasce no sistema é a **OS de apoio**.
- O SYNQ OS **nunca escreve no SAP**: a baixa é por planilha.

### 3. Quadro e detalhe da OS

- **Quadro** em quatro colunas: Liberada, Pendente, Em execução e Encerrada. Há ainda os estados Cancelada e Devolvida.
- Filtros por equipe, tipo, criticidade, período e busca. Ordenação por prioridade ou data limite.
- Cartões com selos de **atrasada**, **execução aberta há mais de 12 horas**, **reservada para alguém** e, para a gestão, ciência pendente e PDF pronto.
- **Detalhe da OS**: dados do SAP, local, instruções, materiais recomendados, ciclo da preventiva, checklist de inspeção, todas as APRs e execuções, fotos, PDF, alertas e **linha do tempo** (APRs, pausas, reprogramações, reserva, devolução e ciência).
- **Histórico por local e por equipamento**, e o selo de **local crítico**, marcado pelo admin.
- A tela se atualiza sozinha a cada 30 segundos.

### 4. APR (Análise Preliminar de Risco)

- Uma **APR nova para cada OS e cada tentativa**, nunca copiada de outra. Cada APR ampara uma única execução e vale só no dia.
- O **técnico escolhe o modelo**. O sistema lê a OS e **recomenda** o que mais combina (palavras-chave no título, na descrição do serviço e na descrição da OS), mas nunca escolhe sozinho.
- **Participantes**: um responsável e os executores. Todos precisam ser da equipe, ter assinatura e não estar ausentes.
- **Riscos**: a equipe marca os riscos presentes, e só as medidas desses riscos são respondidas.
- **Checklist** (Sim, Não e NA) respondido por inteiro, uma pergunta por vez, e **validado no servidor**. O NA só existe onde o modelo permite e exige observação.
- O técnico **não sabe o que é eliminatório**: todos os itens têm a mesma aparência, e só o admin vê essa classificação. O técnico descobre ao validar.
- **Item reprovado exige documentação**: observação sempre, mais foto ou PDF quando o item pede. Item do tipo alerta registra, mas não bloqueia.
- **APR bloqueada** fica registrada na hora, a OS fica pendente e a equipe pode retomar com uma APR nova, sem esperar o supervisor.
- **Troca de modelo** durante o preenchimento, aproveitando as respostas equivalentes.
- **Materiais, ferramentas e EPIs recomendados** do serviço aparecem como lembrete na revisão.
- Os participantes **assinam** com a assinatura do perfil para registrar a APR aprovada.
- O rascunho fica salvo no navegador, para continuar depois.

### 5. Modelos de APR (admin)

- **Editor** de modelos: riscos, itens de verificação e medidas preventivas, contatos de emergência (PAE), tipo do item (eliminatório ou alerta), resposta que bloqueia, evidência pedida (foto, PDF ou texto) e se aceita NA.
- **Versões imutáveis**: editar cria um rascunho da próxima versão. Só publica com pelo menos um item eliminatório, e a APR guarda a versão exata que usou.
- Criar do zero ou **copiando outro modelo**; excluir (arquiva, se já foi publicado) e restaurar.
- **Orientação para o técnico** de cada modelo (descrição, exemplos e palavras-chave), que alimenta a recomendação. Vale na hora.
- Tela **"Onde é usado"**: APRs respondidas, aprovadas e bloqueadas por modelo.
- **Atividades** do plano de manutenção, com código e descrição.
- O critério de bloqueio da carga inicial é **provisório**, até a Segurança do Trabalho validar.

### 6. Execução

- **Iniciar** só com APR aprovada, do dia, da própria OS e com a pessoa entre os participantes.
- **Pausar** (motivo opcional: almoço, descanso ou outro) e continuar. O tempo de pausa alimenta os indicadores.
- **Suspender** no fim do expediente: a OS fica pendente, sem alerta.
- **Interromper por risco**: exige motivo, ao menos uma foto e assinatura. A OS fica pendente e o supervisor recebe alerta e e-mail.
- **Cancelar por engano**: só até 10 minutos depois do início, sem pausa nem foto, com assinatura.
- **Encerrar**: descrição, de 1 a 10 fotos (com GPS, quando o aparelho permite), até 5 PDFs e a assinatura de todos os participantes.
- **Execução esquecida** de outro dia: o sistema exige suspendê-la, informando a hora real, antes de iniciar outra.
- Quem executa é quem encerra, e cada retomada da OS exige uma APR nova.

### 7. Documento (PDF) e baixa no SAP

- **PDF de 2 páginas**, gerado em segundo plano, com nova tentativa automática se falhar:
  - **página 1**: a APR (modelo, participantes com assinatura, riscos, todas as respostas, itens reprovados e alertas em cor, contatos de emergência e observação geral);
  - **página 2**: a OS (dados do SAP, horários, tempo líquido, pausas, checklist de inspeção, assinaturas, ciência do supervisor e fotos com data, hora e GPS).
- Cada página é reduzida (até 45%) para caber numa folha A4.
- O PDF é **gerado de novo depois da ciência**, para ela constar no documento.
- **Ciência do supervisor**: só o supervisor da equipe, com assinatura. Não segura o PDF nem a baixa.
- **Planilha de baixa do SAP** (admin), com 4 abas: **Encerradas**, **Sem ordem SAP**, **Impedimentos** e **Devolvidas**. Cada OS sai uma vez só.

### 8. Impedimentos, reprogramação e OS de apoio

- OS com APR bloqueada ou execução interrompida fica **pendente**, com a APR preservada no histórico.
- **Reprogramar** (supervisor da equipe ou admin): nova data ou outra equipe, com justificativa e assinatura. O atraso passa a contar como justificado.
- **OS de apoio**: aberta pelo supervisor da equipe de origem ou pelo admin, ligada à OS original e para qualquer equipe. Não tem número SAP, então sai na aba "Sem ordem SAP". Ao encerrar, avisa a equipe da OS original. Só o admin a cancela.

### 9. Alertas

- **Sino** em toda tela, com os últimos avisos. Abrir o alerta o marca como lido.
- **19 tipos**:
  - **operação (8)**: bloqueio, conflito de planejamento, execução duplicada, apoio encerrado, falha de importação, preventiva próxima, preventiva vencida e inspeção com pendência;
  - **ausência (9)**: pedida, aprovada, recusada, registrada, fim pedido, fim respondido, alterada, vencida e cancelada;
  - **representação (2)**: iniciada e encerrada.
- Vão para o supervisor da equipe e, se estiver no comando, para o representante. Sem supervisor, vão para os admins.
- **E-mail** só para o bloqueio (APR bloqueada ou interrupção por risco), com os itens reprovados e links de 7 dias para fotos e PDFs. Os demais ficam no sino.
- Tela de alertas da gestão, com lista, detalhe e filtros por tipo e equipe.

### 10. Atribuição individual e devolução de OS

- O **supervisor reserva a OS a uma pessoa**, que passa a ser a única a iniciar a APR e a execução. A OS continua no quadro, com a marca "Reservada para …". Os colegas podem ser participantes.
- O **supervisor devolve ao SAP** a OS liberada que tem erro, com justificativa e assinatura. A justificativa segue na aba "Devolvidas" da baixa.
- Se o SAP trouxer a ordem de novo, a OS volta ao quadro.

### 11. Assinaturas e auditoria

- A assinatura do perfil **valida as ações importantes**: participantes da APR, encerramento, ciência, liberação ou recusa de cadastro, reprogramação, cancelamento e devolução de OS, interrupção por risco, cancelamento por engano, publicação de treinamento e os atos de ausência.
- Cada ato guarda uma **cópia da imagem usada**: refazer a assinatura só vale dali em diante.
- **Auditoria** (admin): trilha que só cresce, com filtros por tipo, autor, texto e período, e os detalhes do que mudou. Cobre usuários, equipes, modelos, atividades, materiais, OS, importações, exportações, ciclos de preventiva, gamificação, registro de funcionários, ausências e treinamentos.

### 12. Preventivas

- **Ciclo das preventivas**: contagem regressiva por plano e item, com alerta de ciclo próximo e vencido. Conta do encerramento da última OS ou da data programada. O sistema não cria a OS do próximo ciclo.
- O intervalo vem do PDF, da planilha ou da API, ou é definido na tela (dia, semana, quinzena, mês, bimestre, trimestre, semestre ou ano).
- **Checklist de inspeção** por plano (até 50 perguntas), definido no editor do ciclo e respondido no encerramento. Item não marcado exige observação, não bloqueia e avisa o supervisor.
- Janela "OS preventivas" no quadro, com a situação de cada plano, histórico de ciclos e próximas datas.

### 13. Catálogo de serviço

- O admin cadastra **materiais, ferramentas e EPIs** e monta a lista de cada serviço, com quantidade e observação.
- Todos os perfis consultam o catálogo, que também aparece no detalhe da OS e na revisão da APR.
- É só **recomendação**: não há item obrigatório, foto nem bloqueio por material.

### 14. Indicadores (5 dashboards)

- **Geral**, **Equipes e usuários**, **OS**, **APR** e **Meus resultados**.
- Filtro de período (7 dias, 30 dias, 90 dias, 12 meses ou um mês) e de equipe, comparando com o período anterior.
- Medem carteira de OS, atrasos, tempo de execução e de pausa (por equipe, técnico, motivo e OS), interrupções, reprogramações, locais com mais OS, preventivas em dia e atrasadas, e APRs aprovadas e bloqueadas.
- **Precisa de atenção**: ciência pendente, baixa no SAP e execuções abertas há mais de 12 horas, com atalho para cada um.
- Privacidade: o técnico só vê a própria equipe e não vê colegas. Só o admin vê o que é eliminatório e a entrada de OS.

### 15. Equipes e usuários

- Cadastro **só de quem está no registro de funcionários**: o admin ou o supervisor informa matrícula e e-mail, e nome, cargo e registro profissional vêm de lá, sem edição.
- O **supervisor cadastra técnicos** do setor das equipes que supervisiona. Eles nascem pendentes até o admin liberar.
- O admin cria equipes e perfis, redefine senha, desativa, reativa, atualiza do registro e exclui quem não tem histórico.
- **Desligamento em tempo real**: o registro avisa o SYNQ OS e a conta é desativada em segundos. Uma leitura completa por dia (às 3h) pega o que o aviso perdeu. Uma trava impede desativar mais da metade dos usuários de uma vez, e o último admin nunca é desativado.
- **Perfis de pessoa e de equipe**, com membros, representante, OS recentes e histórico das OS encerradas nos últimos 60 dias.
- **Busca global** por OS, usuário e equipe, com prévia ao digitar e filtros na página de resultados.

### 16. Ausências e representante da equipe

- **Usuário ausente**: continua ativo, mas só visualiza. O técnico pede, o supervisor aprova (podendo ajustar as datas) ou recusa, e o técnico confirma assinando. O supervisor também registra a ausência de alguém ou a própria.
- Fim antecipado, prorrogação e encerramento. A ausência não termina sozinha: vencida a data, fica pendente até o retorno ser confirmado.
- No início, as OS reservadas à pessoa voltam para a equipe toda e a execução aberta é suspensa.
- **Representante da equipe**: um membro assume a supervisão quando o supervisor se ausenta ou fica 3 dias sem usar o sistema, e devolve quando ele volta. O sistema escolhe o técnico mais antigo, e o supervisor ou o admin pode designar outro.

### 17. Gamificação

- **16 tarefas pontuam**, calculadas só no servidor, entre elas APR completa, execução concluída, responsável pela APR, preventiva concluída e em dia, local crítico, resgate de OS, apoio, acompanhar técnico novo, assinatura cadastrada, Campo de treino, treinamentos de serviço e, para o supervisor, ciência no prazo e intervalo de preventiva definido. O admin edita os valores.
- **Temporadas trimestrais** (Verão, Outono, Inverno e Primavera), com fechamento automático.
- **Ranking** de pessoas e de equipes (a equipe pela média por membro), por temporada ou geral, com opção de **anonimato**.
- **5 patentes** (com imagem de pessoa e de equipe) e **26 conquistas**.
- Telas: Minha pontuação, Ranking, Conquistas, Patentes e Como pontuar. Avisos "+N pontos", "Conquista desbloqueada" e "Nova patente".
- **A segurança nunca custa pontos**: a execução interrompida por risco vale o mesmo que a encerrada, e nenhuma regra olha a resposta de um item. O admin não joga, mas edita tarefas, patentes e conquistas.

### 18. Vitória, a assistente

- Botão flutuante nas telas do sistema, para todos os perfis, inclusive no Campo de treino e para quem aguarda liberação.
- Responde pelo **manual** do perfil de quem pergunta (técnico ou admin), com 3 sugestões por tela.
- **"Me leve lá"** leva à tela certa, a partir de uma lista fechada de destinos. **"Mostrar na tela"** navega e faz o botão piscar. Consultas simples viram link já filtrado.
- **O que ela não faz**: não lê as OS, não orienta segurança de campo e nunca diz o que é eliminatório.
- **Privacidade**: a conversa não é guardada no servidor. As perguntas que ela não soube responder são gravadas sem identificar quem perguntou, e o admin as trata numa tela própria.
- **IA configurável** (Gemini gratuito na demonstração, só com dados fictícios, ou Claude). Sem IA, com a cota estourada ou com falha, ela responde por busca no manual e nunca mostra tela de erro.
- Limites: 20 mensagens por conversa, 40 por conta por dia e 1.000 no total por dia.

### 19. Treinamentos de serviço

- Um treinamento por serviço do catálogo. O admin cria uma **explicação em passos** (a Vitória narra) e um **jogo de 3 a 10 fases**, de 5 tipos: quiz, decisão, separar os itens, ligar e pôr em ordem.
- **Publicação** com termo e assinatura. A versão publicada não muda, e o admin pré-visualiza sem pontuar.
- O técnico joga, inclusive quem aguarda liberação. O gabarito só aparece depois da resposta.
- Pontua até 15 por treinamento (5 pela conclusão e 1 por fase certa de primeira) e rende 3 conquistas.
- O técnico pode **reportar problema** em qualquer fase, e o admin trata os reportes.

### 20. Campo de treino

- Ambiente de prática com **dados fictícios**, que não afeta nada real. É para técnicos e supervisores.
- **Tutorial direcionado** de 18 passos (OS, APR, checklist, assinatura, execução, encerramento, perfil e bloqueio) ou **modo livre**.
- Selo "TREINO" sempre visível e botão "Recomeçar treino". Concluir dá 10 pontos, uma vez por conta.

### 21. Sistemas simulados da empresa

- **Registro de funcionários** e **SAP** simulados, com tela própria (`/simulador/funcionarios` e `/simulador/ordens`, só para o admin, fora do menu).
- Criar manualmente ou em lote aleatório, buscar, editar, excluir e agir em massa (mudar setor e situação nos funcionários; mudar status, centro de trabalho e data nas ordens).
- A tela do SAP mostra, em cada ordem, **como o SYNQ OS reagiu**: ainda não lida, ignorada com o motivo ou o status da OS.

### 22. Plataforma

- **Tarefas em segundo plano** com fila no banco: PDF, e-mails e leituras. Até 5 tentativas, com espera crescente, e recuperação se o servidor cair.
- **Arquivos privados** (fotos, assinaturas, PDFs, importações, documentos, gamificação e treinamentos), entregues por link temporário só a quem enxerga aquela equipe.
- **Registro de campo idempotente**: reenviar um evento não duplica nada. É a base do modo offline.
- **Segurança**: validação de toda entrada no servidor, isolamento por equipe, auditoria que só cresce (o próprio banco recusa alterar), 50 tabelas com acesso restrito por linha e cookies de sessão protegidos.
- **Responsivo**: funciona no navegador do celular, com menu inferior em telas pequenas. Interface em português do Brasil, com foco visível, rótulos para leitores de tela e respeito ao movimento reduzido.
- **Como subir**: modo local sem nada instalado (`pnpm dev:local`), ou Docker Compose com Supabase. Carga de demonstração com OS em todos os estados do fluxo.

---

## Pontos fortes para destacar

- **Barreira digital real**: sem APR aprovada, a execução não começa.
- **Rastreabilidade**: cada tentativa, bloqueio, foto, assinatura e horário ficam registrados, e a auditoria não pode ser apagada.
- **Zero papel**, do recebimento da OS ao PDF final.
- **Segurança não penaliza**: a gamificação premia quem reporta risco.
- **O técnico decide, o sistema orienta**: a recomendação do modelo nunca é aplicada sozinha.
- **Funciona no celular e no computador**, com a mesma conta.
- **Convive com o SAP**: lê as ordens e devolve a baixa por planilha, sem escrever no SAP.
- **Acesso sempre em dia**: o desligamento no RH tira o acesso em segundos.

## O que ainda não está pronto

- **App Android e modo offline** (fila local, login sem sinal): não iniciados. O servidor já está pronto para eles, e a web funciona no navegador do celular, sem instalação.
- **Digitalização de OS antigas por IA**: decidida, não iniciada. A tela de câmera só abre a câmera, sem ler nada, e PDF escaneado (sem texto) é recusado.
- **Rascunho de treinamento gerado por IA**: não iniciado.
- **Vitória com IA**: a primeira chamada real ao Gemini ainda não foi conferida. Perguntas como "mês passado" ainda não são confiáveis.
- **E-mail**: só o alerta de bloqueio é enviado, e só com o SMTP configurado. Os avisos de ausência e representação ficam no sino.
- **Equipe sem supervisor** e reativação da conta na readmissão: fora do escopo atual.
- **Dados reais**: o critério de bloqueio dos modelos, os 116 serviços do catálogo e a lista de materiais por serviço são provisórios ou fictícios, e dependem da Segurança do Trabalho e da operação.
- **Fora do escopo, por decisão**: escrita no SAP por API, notificação push, iOS, MFA e SSO, estoque de materiais e certificado digital (ICP-Brasil).
