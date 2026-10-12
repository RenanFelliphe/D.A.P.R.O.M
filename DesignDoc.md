## Definições
Informações de cada processo
- Título
- Descrição
- Tipo de atividade
- Material
- Local
- Responsável (líder da atividade; é quem preenche a APR)
- Criticidade
- Prioridade

Análise preliminar de risco
- Notificação para o supervisor da equipe avisando que a atividade não pode ser executada (sem supervisor, vai aos admins). Só existem os perfis técnico e admin: o supervisor é o técnico que a equipe aponta
- As OS cuja APR foi bloqueada continuam como pendentes
- O checklist é preenchido por inteiro; só depois o sistema valida a APR. Não se bloqueia no primeiro "não"
- Todos os itens eliminatórios reprovados são listados, e cada um exige evidência: foto quando houver obstáculo físico; justificativa em texto quando não houver (ex.: condição psicológica, direito de recusa)
- Toda APR é nova e vale para uma única OS. Não se reaproveitam nem se pré-preenchem respostas de outra APR
- O modelo de APR é definido pelo tipo de atividade da OS, por uma tabela editável pelo admin. São 8 modelos, homologados pela Segurança do Trabalho, que define o critério de bloqueio mas não usa o sistema; o admin o cadastra no editor
- A OS com APR bloqueada guarda o histórico de todas as APRs. Qualquer pessoa da equipe pode fazer uma APR nova e retomar a OS, sem esperar reprogramação do supervisor; o supervisor é avisado e acompanha
- Quem executa a OS é quem a encerra, e só com APR aprovada. Nenhum usuário encerra a OS de outra pessoa, e a OS pendente não é duplicada

Execução da OS
- Iniciar, pausar, continuar e encerrar, com cronômetro e tempo de pausa
- O número de pessoas é informado ao iniciar; início e fim ficam registrados com data e hora
- A atividade pode durar vários dias e trocar de executor; cada retomada começa com uma APR nova
- Interromper por risco (com motivo e foto) é diferente de pausar (almoço, café)

Após a execução do processo, gerar um documento PDF de registro, em 2 páginas: a da APR e a da OS, no modelo do SAP
- Data e hora de início e fim, número de pessoas, duração e pausas, descrição da atividade
- Assinatura de cada executante ao fim da atividade
- Responsável pela manutenção (líder) e ciência do supervisor

---

# Telas
## Painel Pessoal (Do funcionário)
- Histórico de OS
- registro de assinaturas a partir do painel pessoal. A assinatura (rubrica ou por extenso) fica cadastrada no perfil e é confirmada a cada assinatura

## Painel de gestão (web)
- Quadro de OS, alertas, importação do SAP, indicadores e modelos de APR
- Indicadores de tempo de execução e de pausa, e de produtividade por equipe, técnico e OS
- Equipes e usuários: o administrador cria as contas e define as permissões. Não há autocadastro

Site (https://esgasplanomanutencao.lovable.app/controle)

---

## Outras funcionalidades 
- Ter um catálogo de serviço, com os materiais que cada serviço utiliza 
- Escaneamento das OS e APR antigas para o sistema
- Monitoramento de tempo de intervalo de OS preventivas (intervalo entre um ciclo e outro; não é o cronômetro de execução)
- Assinatura digital de documentos (rubrica ou por extenso, cadastrada no perfil)
- OS de apoio 
- Chatbot de consulta, por exemplo "o que eu executei em maio" (sugestão do mentor Iago; fora do MVP)

---

## Funcionalidades essenciais

- Validação de permissão de execução de OS após análise da APR
- Documentação comprobatória (imagem, pdf...) do obstáculo para execução da OS, por item reprovado
- Sincronização automática e manual dos dados offline
- Armazenamento local de um token temporário para login offline.
- Leitura da equipe definida na OS (atribuição automática: a OS já vem com a equipe do SAP)

--

## Correções
- As OS não serão escritas/definidas através do sistema e sim, através do SAP. Nosso sistema deve, ler as OS do SAP (Por importação manual ou por requisição HTTP de uma API) e renderizá-las na nossa plataforma para que o funcionário possa aplicar uma APR em cima dela. A única OS que nasce no sistema é a OS de apoio, aberta pelo supervisor da equipe ou pelo admin a partir de um impedimento e ligada à OS original.

- A API do SAP existe, mas o protótipo não usa dados reais. Criaremos uma API que simula a real, com dados fictícios e o mesmo contrato; trocar para a real deve mudar só o endereço e as credenciais. A importação por planilha continua como alternativa.

- A relação entre OS e APR é de 1:1; Ou seja. Não deve ser possível usar a mesma APR para mais de uma OS, como estávamos planejando. Toda aplicação para OS deve exigir o preenchimento de uma APR nova. Portanto, a seção OS Cobertas por Esta APR deve ser removida

- A equipe para qual a OS será designada vem definida no documento. Precisamos encontrar a equipe definida no documento dentro da base de dados no sistema e renderizar seus participantes na seção Participantes do detalhe da APR.

- Tecnologia: web em .NET 10, mobile em React Native, back-end em Node e banco no Supabase (Postgres), incluindo autenticação, armazenamento de fotos, geração de PDF e e-mail. Hospedagem no Coolify. Deve ser um mono repo separado em /backend, /frontend e /mobile. Deve sempre seguir esse padrão, usando Dockerfile para facilitar o deploy, sempre.