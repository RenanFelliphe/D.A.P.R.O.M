# SYNQ OS

**APR e Ordens de Manutenção sem papel.**

SYNQ OS é uma proposta de digitalização do fluxo de Ordens de Manutenção (OM/OS) e Análises Preliminares de Risco (APR), do planejamento à execução em campo. A solução foi concebida para combinar uma experiência móvel para equipes operacionais com um painel web para gestão, mantendo o histórico, as evidências e as assinaturas associados a cada atividade.

> **Estado atual:** o repositório tem a `api` (rotas, regras, banco, PDF e tarefas, testada) e o `web` (área do técnico e painel de gestão, ligados à `api`), além das especificações e dos materiais de referência. O aplicativo `mobile` (React Native, com o modo offline) ainda não foi iniciado. Nada aqui roda com dados reais da empresa: o SAP é simulado e o desenvolvimento usa só dados fictícios.

## Contexto e objetivo

O processo que motivou o projeto depende de ordens impressas, formulários APR preenchidos em papel e posterior digitalização. Isso aumenta o retrabalho, dificulta auditorias e o acompanhamento das atividades e não oferece uma barreira digital confiável contra o início de um serviço sem análise de risco aprovada.

O objetivo é apoiar a operação para que cada OS tenha sua própria APR, a execução só comece após a aprovação dos requisitos de segurança, e os dados produzidos em campo possam ser rastreados, consultados e apresentados em um registro digital. O sistema complementa o SAP: a geração e a gestão oficial das ordens permanecem nele.

## Fluxo operacional especificado

1. **Receber a OS:** as ordens são originadas no SAP e chegam à plataforma por uma API de leitura ou, como alternativa, por arquivo: a planilha exportada ou o PDF da OS impresso pelo SAP, conferido campo a campo antes de registrar. A plataforma não cria OS por iniciativa do usuário: a única que nasce nela é a OS de apoio, aberta pelo supervisor da equipe ou pelo admin a partir de um impedimento e ligada à OS original. A equipe indicada na ordem é usada para apresentar os participantes; os dados de atribuição não são recriados manualmente.
2. **Analisar os riscos:** antes de executar, a equipe realiza uma APR nova, exclusiva para aquela OS e para aquela tentativa. As respostas não são copiadas nem pré-preenchidas a partir de outra APR. O técnico escolhe o modelo a cada APR, entre os modelos publicados: o sistema lê a OS e recomenda o que mais combina, mas não escolhe por ele, porque o mesmo serviço pode pedir APRs diferentes conforme a situação no local. Os modelos e a orientação de cada um são cadastrados pelo admin com o que a Segurança do Trabalho define. A equipe marca os riscos que existem na atividade, e só as medidas desses riscos são respondidas.
3. **Validar a APR:** o checklist é respondido por inteiro antes da validação. Respostas reprovadas em itens eliminatórios impedem a execução, mas o técnico não sabe quais itens são eliminatórios (só o admin, que edita o modelo, vê isso): o sistema valida as respostas depois que tudo foi respondido e só então mostra o que reprovou. Todos os itens reprovados devem ser documentados, com foto quando se tratar de um obstáculo físico ou justificativa em texto quando a evidência visual não for adequada, como no direito de recusa.
4. **Manter a OS pendente quando houver impedimento:** a APR bloqueada é preservada no histórico, a OS continua pendente e o supervisor é avisado. A equipe pode retomar a OS com uma APR totalmente nova, sem duplicar a ordem nem depender de reprogramação prévia.
5. **Registrar a execução:** uma APR aprovada libera o início. A execução registra horários, quantidade de pessoas, descrição do serviço, pausas e evidências. Pausar uma atividade por intervalo é diferente de interrompê-la por risco; cada nova retomada da OS exige uma nova APR.
6. **Encerrar e documentar:** quem executa encerra a atividade após as confirmações e assinaturas dos participantes. O registro previsto é um PDF de duas páginas: APR e OS no formato de referência do SAP. O supervisor da equipe dá ciência pelo painel.

## O que a demonstração apresenta

A aplicação `web` reúne as telas de campo, de gestão e do documento:

### Experiência de campo (referência Android)

- Entrada ilustrativa e informação de que o acesso offline temporário é uma contingência, não o modo normal.
- Lista de OS da equipe com filtros por status e detalhes de atividade, local, criticidade, prioridade, equipamento e materiais.
- Abertura de APR vinculada a uma OS, escolha do modelo pelo técnico (com a recomendação do sistema), seleção dos participantes e indicação do responsável.
- Checklist de 18 itens demonstrativos, respondido por completo e validado somente ao final; todas as perguntas têm a mesma aparência, sem marcar o que é eliminatório ou alerta.
- Justificativa e evidência fotográfica dos itens reprovados, pedidas só depois da validação, tela de APR bloqueada e tela de APR aprovada.
- Confirmação das assinaturas dos participantes antes de iniciar a execução.
- Tela de execução com pausa/continuação, descrição e exemplos de evidências.
- Perfil com histórico de OS e assinatura cadastrada de exemplo.
- Fila de sincronização ilustrativa.

### Painel de gestão (referência web)

- Quadro de OS por estado, com indicadores, filtros e criticidade.
- Detalhe e histórico da ordem, alertas de impedimento e acompanhamento de OS de apoio.
- Telas ilustrativas para importação do SAP, indicadores/exportação, modelos de APR e administração de equipes e usuários.

### Documento

- Visualização de referência do PDF de duas páginas, com uma página para a APR e outra para a OS.

**As telas são uma demonstração de fluxo e interface, não módulos funcionais conectados.** A importação, sincronização, notificações, login, armazenamento de fotos, edição de modelos, geração/baixa de documentos e indicadores reais não são executados por serviços de backend neste repositório. Interações como câmera e algumas exportações são representadas visualmente ou por mensagens de demonstração.

## Regras de negócio centrais

- A relação é **uma OS para uma APR por tentativa de execução**; não se reutiliza uma APR entre ordens.
- O técnico escolhe o modelo de cada APR; o sistema só recomenda um, pela leitura da OS, e nunca o aplica sozinho.
- Só as medidas dos riscos que a equipe marca na APR são respondidas.
- O checklist completo é analisado antes de se decidir se a atividade pode prosseguir.
- Alertas não eliminatórios são registrados, mas não bloqueiam automaticamente a OS. O técnico não é avisado de qual resposta é alerta nem de qual é eliminatória.
- APRs bloqueadas e tentativas anteriores permanecem no histórico da OS.
- A OS pendente pode ser retomada por alguém da equipe mediante uma APR nova.
- A execução só é liberada após uma APR aprovada; quem executa é responsável pelo encerramento.
- Pausa, suspensão por fim de expediente e interrupção por risco são situações diferentes.
- O sistema é online e atende todos os perfis, no app e na web. O modo offline é um recurso adicional para o campo sem sinal: os dados produzidos offline devem ser sincronizados sem descartar registros, e conflitos de planejamento devem gerar alertas.
- O protótipo e os testes de demonstração devem usar somente dados fictícios.

## Arquitetura prevista

A arquitetura abaixo é a direção registrada na especificação; **não está implementada neste repositório**:

| Componente planejado | Tecnologia | Responsabilidade |
|---|---|---|
| Aplicativo de campo para Android (`mobile`) | React Native, com armazenamento local SQLite | APR e execução em campo, com modo offline de contingência |
| Painel web (`web`) | Next.js (React + TypeScript) | Planejamento, gestão, modelos, indicadores e exportações |
| API (`api`) | Node.js com TypeScript | Regras de negócio, autorização, integrações, sincronização, PDF e e-mail |
| Persistência e serviços gerenciados | Supabase: PostgreSQL, Auth e Storage | Banco, autenticação e arquivos; acesso mediado pela API |
| Implantação | Coolify e Docker | Deploy das aplicações do monorepo |

O monorepo tem as pastas `api`, `web` e `mobile`; `api` e `web` já têm Dockerfile e sobem juntos pelo `docker-compose.yml`, e o do `mobile` (que gera o APK) virá com o app. A leitura do SAP e o registro de funcionários são simulados na própria `api`, com dados fictícios, para mostrar o fluxo final funcionando dentro da empresa. A planilha e o PDF da OS continuam sendo alternativas de leitura.

A escrita/baixa da OS no SAP por API está fora do escopo definido: o encerramento deve poder ser exportado para baixa manual. MFA/SSO corporativo e associação de dispositivos também permanecem como decisões a validar antes de uma implantação real.

## Executar

Sem Supabase nem Docker, a `api` tem um modo local (banco, autenticação e arquivos em memória, SAP simulado, usuários de exemplo com a senha `synqos123`):

```bash
cd api && pnpm install && pnpm dev:local    # http://localhost:3333
cd web && pnpm install && pnpm dev          # http://localhost:3000, abre na tela de entrada (e-mail institucional: `tiago.tecnico@empresa.com.br` para um técnico, `sandra.supervisora@empresa.com.br` para um técnico que supervisiona uma equipe ou `ana.administradora@empresa.com.br` para o admin)
```

A área do técnico fica em `/app/*` e o painel de gestão em `/web/*`; o perfil define o que cada pessoa vê. Só há dois perfis, `tecnico` e `admin`: o supervisor não é perfil, é o técnico que a equipe aponta, e faz tudo o que o técnico faz mais a gestão da(s) equipe(s) que supervisiona; o admin cuida só da plataforma (importação de OS, modelos de APR, usuários e equipes) e não executa OS. A Segurança do Trabalho não usa o sistema: define o critério de bloqueio da APR, e o admin o cadastra no editor. Detalhes em [web/README.md](./web/README.md) e [api/README.md](./api/README.md).

### Com Docker (`api` + `web`)

A `api` precisa de um Supabase (Postgres, Auth e Storage), na nuvem ou local. Copie `.env.example` para `.env`, preencha as quatro variáveis obrigatórias e suba:

```bash
cp .env.example .env
docker compose up --build   # api em http://localhost:3333 (GET /saude), web em http://localhost:3000
```

A `api` aplica as migrações e carrega os modelos de APR antes de abrir a porta, e os simuladores do SAP e do registro de funcionários já vêm ligados (as telas deles ficam em `/simulador`, só para o admin). Detalhes e a lista de rotas em [api/README.md](./api/README.md). O `mobile` não entra no compose: é gerado como APK.

## Estrutura do repositório

```text
.
├── README.md
├── DesignDoc.md
├── api/                        # Backend (rotas, regras, banco, PDF e tarefas), com Dockerfile
├── docker-compose.yml          # Sobe api e web no desenvolvimento
├── .env.example                # Variáveis da api para o compose
├── web/                        # Telas do painel e do técnico em Next.js + React + TypeScript, com Dockerfile
├── mobile/                     # Aplicativo de campo (ainda não iniciado)
└── base/
    ├── .design/
    │   ├── especificacao.md    # Escopo, regras, contratos e decisões técnicas
    │   └── pontos-a-validar.md # Questões e decisões pendentes
    ├── apr-examples/           # Planilhas-modelo de APR usadas como referência
    ├── os-examples/            # Exemplos de documentos de OS
    ├── contexto/               # Contexto da sessão de especificação
    └── reunioes/               # Transcrições e resumo das correções
```

As oito planilhas de referência de APR correspondem aos modelos de operação, instrumentação, operação/manutenção, construção de rede de distribuição de gás natural, conversão de clientes, trabalho em altura e espaço confinado, inspeção de rede e movimentação de almoxarifado. Os modelos oficiais e seu conteúdo devem ser definidos e homologados pela área de Segurança do Trabalho e cadastrados no sistema pelo admin.

## Documentação de referência

- [DesignDoc.md](./DesignDoc.md) — definições e visão do produto.
- [funcionalidades.md](./funcionalidades.md) — o que está pronto das funcionalidades essenciais e das extras, e o que fazer a seguir.
- [vitoria.md](./vitoria.md) — a Vitória (assistente do sistema), os treinamentos de serviço e a digitalização de OS antigas, todos com apoio da IA: decisões, custos e plano de implementação.
- [Especificação funcional e técnica](./base/.design/especificacao.md) — escopo, regras de negócio, arquitetura proposta, contratos e decisões.
- [Pontos a validar](./base/.design/pontos-a-validar.md) — questões que ainda dependem de confirmação.
- [Resumo das correções da reunião 2](./base/reunioes/correcoes-reuniao-2-resumo.md) — decisões recentes sobre APR, execução, integração e stack.
- [Materiais de APR](./base/apr-examples/) e [exemplos de OS](./base/os-examples/) — referências de processo e formato.

## Limites e próximos passos

Para avançar do protótipo para um piloto, ainda será necessário implementar e validar as três aplicações, contratos e API simulada do SAP, autenticação e permissões, envio idempotente dos eventos de campo (base do modo offline e da fila local), persistência de evidências, geração real do PDF, notificações, exportação de encerramentos e testes do fluxo de ponta a ponta. A integração real e as decisões de segurança corporativa devem ser confirmadas com as áreas responsáveis; dados reais não devem ser conectados ao protótipo atual. Planejado para a próxima entrega, ainda não pronto: cadastro de técnicos pelo supervisor na própria equipe, com liberação pelo admin, e tela de treinamento com dados fictícios no primeiro login dos técnicos (a importação de OS pelo supervisor foi adiada).

Funcionalidades sugeridas para depois do MVP — como digitalização de documentos antigos, acompanhamento do intervalo entre ciclos preventivos, chatbot e gamificação — não fazem parte da demonstração nem do escopo prioritário atual. Quatro ideias dessa lista foram feitas em 13/10/2026: o catálogo de serviço (os materiais de cada serviço, no detalhe da OS), a evidência em PDF, o intervalo entre ciclos das preventivas (a contagem até o próximo ciclo de cada plano, com alertas, sem criar OS) e a gamificação (pontos por tarefa, patentes e ranking por temporada, conquistas e anonimato, calculados no servidor; a segurança nunca custa pontos); ver [funcionalidades.md](./funcionalidades.md) e [gameficacao.md](./gameficacao.md). O chatbot (a Vitória), os treinamentos de serviço e a digitalização de OS antigas, com apoio da IA, foram desenhados em 14/10/2026, ainda sem implementação; ver [vitoria.md](./vitoria.md).
