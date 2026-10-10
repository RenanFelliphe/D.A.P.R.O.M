## Definições
Informações de cada processo
- Título
- Descrição
- Tipo de atividade
- Material
- Local
- Responsável
- Criticidade
- Prioridade

Análise preliminar de risco
- Notificação para um supervisor avisando que a atividade não pode ser executada
- As OS cuja APR foi bloqueada continuam como pendentes

Após a execução do processo, gerar um documento PDF de registro
- Data e hora de execução
- Assinaturas

---

# Telas
## Painel Pessoal (Do funcionário)
- Histórico de OS
- registro de assinaturas a partir do painel pessoal.

Site (https://esgasplanomanutencao.lovable.app/controle)

---

## Outras funcionalidades 
- Ter um catálogo de serviço, com os materiais que cada serviço utiliza 
- Atribuição automática de OS para as equipes
- Escaneamento das OS e APR antigas para o sistema
- Monitoramento de tempo de intervalo de OS preventivas
- Assinatura digital de documentos
- OS de apoio 

---

## Funcionalidades essenciais

- Validação de permissão de execução de OS após análise da APR
- Documentação comprobatória (imagem, pdf...) do obstáculo para execução da OS
- Sincronização automática e manual dos dados offline
- Armazenamento local de um token temporário para login offline.

--

## Correções
- As OS não serão escritas/definidas através do sistema e sim, através do SAP. Nosso sistema deve, ler as OS do SAP (Por importação manual ou por requisição HTTP de uma API) e renderizá-las na nossa plataforma para que o funcionário possa aplicar uma APR em cima dela.

- A relação entre OS e APR é de 1.1; Ou seja. Não deve ser possível usar a mesma APR para mais de uma OS, como estávamos planejando. Toda aplicação para OS deve exigir o preenchimento de uma APR nova. Portanto, a seção OS Cobertas por Esta APR deve ser removida

- A equipe para qual a OS será designada vem definida no documento. Precisamos encontrar a equipe definida no documento dentro da base de dados no sistema e renderizar seus participantes na seção Participantes do detalhe da APR.

- A aplicação deve ser em .NET 10 e será hospedada no coolify. Deve ser um mono repo separado em /backend, /frontend e /mobile. Deve sempre seguir esse padrão, usando Dockerfile para facilitar o deploy, sempre.