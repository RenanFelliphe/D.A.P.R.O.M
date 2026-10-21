## Definições
Informações de cada processo
- Título
- Descrição
- Tipo de atividade
- Material (os materiais recomendados do serviço, só para consulta)
- Local
- Responsável (líder da atividade; é quem preenche a APR)
- Criticidade
- Prioridade

Recebimento da OS
- A OS vem do SAP: pela leitura da API, pela planilha exportada ou pelo PDF da OS, conferido campo a campo antes de registrar. A única OS que nasce no sistema é a de apoio
- A OS chega para a equipe toda (a equipe sai do centro de trabalho). O supervisor da equipe pode reservá-la a uma pessoa, que passa a ser a única a iniciá-la, ou devolvê-la ao SAP com uma justificativa, se a ordem tiver erro

Análise preliminar de risco
- Notificação para o supervisor da equipe avisando que a atividade não pode ser executada (sem supervisor, vai a quem responde pela equipe e aos admins). Só existem os perfis técnico e admin: o supervisor é a pessoa que a equipe aponta
- As OS cuja APR foi bloqueada continuam como pendentes
- O checklist é preenchido por inteiro; só depois o sistema valida a APR. Não se bloqueia no primeiro "não"
- O técnico não sabe quais perguntas são eliminatórias: todas têm a mesma aparência e o modelo que ele recebe não traz essa informação (nem o tipo do item, nem a resposta que bloqueia, nem a evidência exigida). Se soubesse, bastaria responder "certo" nesses itens para poder fazer o serviço. Só o admin, que edita o modelo, vê e define o que é eliminatório
- A validação é feita pelo servidor, depois que tudo foi respondido. Só então o técnico fica sabendo o resultado e, se reprovou, quais itens reprovaram. Com a APR reprovada as respostas ficam travadas: falta só a evidência e o registro do impedimento
- Todos os itens reprovados são listados, e cada um exige evidência: foto quando houver obstáculo físico; justificativa em texto quando não houver (ex.: condição psicológica, direito de recusa); PDF quando o modelo pedir. A evidência é pedida apenas depois da validação, e não durante o checklist
- Toda APR é nova e vale para uma única OS. Não se reaproveitam nem se pré-preenchem respostas de outra APR
- A APR exige ao menos 2 participantes (ninguém trabalha sozinho)
- O técnico escolhe o modelo de APR a cada APR, entre os publicados; o sistema lê a OS e recomenda um, mas não o aplica sozinho (o mesmo serviço pode pedir APRs diferentes conforme a situação no local). São 8 modelos, homologados pela Segurança do Trabalho, que define o critério de bloqueio mas não usa o sistema; o admin o cadastra no editor
- Só as medidas dos riscos que a equipe marca na APR são respondidas
- Aprovada, a APR é assinada por cada participante na própria conta, só no começo. Quem não concorda exerce o direito de recusa (com motivo) e sai da APR; se restarem menos de 2, ou se quem recusou foi o responsável, é preciso uma APR nova
- A OS com APR bloqueada guarda o histórico de todas as APRs. Qualquer pessoa da equipe pode fazer uma APR nova e retomar a OS, sem esperar reprogramação do supervisor; o supervisor é avisado e acompanha
- A execução só começa com uma APR aprovada e assinada por todos. A OS pendente não é duplicada

Execução da OS
- Iniciar, pausar, continuar e encerrar, com cronômetro e tempo de pausa
- O número de pessoas é informado ao iniciar; início e fim ficam registrados com data e hora
- A atividade pode durar vários dias e trocar de executor; cada retomada começa com uma APR nova
- Pausar (almoço, café) e suspender exigem motivo; lesão e enfermidade avisam o supervisor na hora. Interromper por risco (com motivo, foto e assinatura) é diferente das duas
- A localização é gravada no início, na pausa, na suspensão, na interrupção e no encerramento; sem GPS o serviço segue "sem localização"
- Todos os participantes acompanham a execução e agem sobre ela. Encerrar e suspender por outro motivo viram um pedido de 2 minutos ao responsável; o que foi feito sem sinal em aparelhos diferentes é conferido depois
- O encerramento tem dois passos: "Encerrar OS" (com confirmação), que para o tempo, e o preenchimento com a assinatura do responsável. Descrição e fotos são opcionais; nas preventivas entra o checklist de inspeção do plano
- O supervisor da equipe lê o relatório da execução e assina por último; só então a OS está concluída

Após a execução do processo, gerar um documento PDF de registro, com a APR e a OS, no modelo do SAP, como o papel (o que o sistema acrescenta, como tempos, pausas, localização e fotos, vai no relatório da execução)
- Data e hora de início e fim, número de pessoas, descrição da atividade
- Assinatura de cada executante (dada na APR, no começo da atividade)
- Responsável pela manutenção (líder) e assinatura final do supervisor
- A baixa no SAP é feita por planilha (Encerradas, Sem ordem SAP, Impedimentos e Devolvidas)

---

# Telas
## Painel Pessoal (Do funcionário)
- Histórico de OS
- Registro de assinaturas a partir do painel pessoal. A assinatura (rubrica ou por extenso) fica cadastrada no perfil, é a primeira coisa a fazer depois da liberação e é confirmada a cada assinatura
- Ausências, preferências de e-mail, avisos, pontos da gamificação e a Vitória (a assistente do sistema)

## Painel de gestão (web)
- Quadro de OS, alertas, importação do SAP, indicadores e modelos de APR
- Indicadores de tempo de execução e de pausa, e de produtividade por equipe, técnico e OS
- Equipes e usuários: o supervisor cadastra os técnicos da equipe e o admin libera; o cadastro só vale para quem está no registro de funcionários. Não há autocadastro: quem não tem conta pode só pedir uma na tela de entrada
- Catálogo de serviço, ciclo das preventivas, treinamentos de serviço e controle da IA

Site (https://esgasplanomanutencao.lovable.app/controle)

---

## Outras funcionalidades

### Prioridades
- [x] Ter um catálogo de serviço, com os materiais que cada serviço utiliza (só consulta, sem estoque)
- [x] Escaneamento das OS e APR antigas para o sistema (leitura por IA, conferida antes de registrar)
- [x] Monitoramento de tempo de intervalo de OS preventivas (intervalo entre um ciclo e outro; não é o cronômetro de execução)
- [x] Assinatura digital de documentos (rubrica ou por extenso, cadastrada no perfil). A validade jurídica (ZapSign, gov.br) ainda depende de conta
- [x] OS de apoio

### Extras
- [x] API de funcionários para registro rápido, validação e segurança (simulada, com dados fictícios)
- [x] Gameficação para os Técnicos/Funcionários
- [x] Chatbot de consulta, por exemplo "o que eu executei em maio" (a Vitória, com os treinamentos de serviço)

### Surgidas durante o projeto
- [x] Atribuição individual da OS e devolução ao SAP
- [x] Usuário ausente e representante da equipe
- [x] Avisos no sino e por e-mail, com resumo diário (falta configurar o SMTP)
- [x] Sugestão e contestação dos materiais de um serviço
- [x] Execução compartilhada entre os participantes
- [x] Pedido de conta na tela de entrada
- [x] Controle da IA por função, com a leitura de dados reais autorizada por assinatura
- [x] Treinamentos validados pelos supervisores das equipes que mais fazem o serviço

---

## Funcionalidades essenciais

- [x] Validação de permissão de execução de OS após análise da APR
- [x] Documentação comprobatória (imagem, pdf...) do obstáculo para execução da OS, por item reprovado
- [x] Sincronização automática e manual dos dados offline (no app; falta ver num aparelho)
- [x] Armazenamento local de um token temporário para login offline (hash salgado da senha, válido por 7 dias desde a última confirmação do servidor)
- [x] Leitura da equipe definida na OS (atribuição automática: a OS já vem com a equipe do SAP)

--

## Correções
- As OS não serão escritas/definidas através do sistema e sim, através do SAP. Nosso sistema deve, ler as OS do SAP (Por importação manual ou por requisição HTTP de uma API) e renderizá-las na nossa plataforma para que o funcionário possa aplicar uma APR em cima dela. A única OS que nasce no sistema é a OS de apoio, aberta pelo supervisor da equipe ou pelo admin a partir de um impedimento e ligada à OS original.

- A API do SAP existe, mas o protótipo não usa dados reais. Criamos uma API simulada, com dados fictícios, para mostrar o fluxo final funcionando dentro da empresa. A importação por planilha continua como alternativa.

- A relação entre OS e APR é de 1:1; Ou seja. Não deve ser possível usar a mesma APR para mais de uma OS, como estávamos planejando. Toda aplicação para OS deve exigir o preenchimento de uma APR nova. Portanto, a seção OS Cobertas por Esta APR deve ser removida

- A equipe para qual a OS será designada vem definida no documento. Precisamos encontrar a equipe definida no documento dentro da base de dados no sistema e renderizar seus participantes na seção Participantes do detalhe da APR.

- Tecnologia: web em Next.js (React + TypeScript), mobile em React Native com Expo, back-end em Node com TypeScript e banco no Supabase (Postgres), incluindo autenticação, armazenamento de fotos, geração de PDF e e-mail. Hospedagem no Coolify. É um monorepo separado em /api, /web e /mobile, com o código comum em /shared. Deve sempre seguir esse padrão, usando Dockerfile para facilitar o deploy, sempre (o do mobile gera o APK).
