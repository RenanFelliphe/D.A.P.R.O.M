# SYNQ OS

**APR e Ordens de Manutenção sem papel.**

SYNQ OS digitaliza o fluxo de Ordens de Manutenção (OM/OS) e Análises Preliminares de Risco (APR), do planejamento à execução em campo. Junta um aplicativo Android para as equipes de campo e um painel web para a gestão, com o histórico, as evidências e as assinaturas guardados em cada atividade.

> **Estado atual (20/10/2026):** as três aplicações existem e conversam entre si. A `api` tem as rotas, as regras, o banco, o PDF e as tarefas, com testes. O `web` tem a área do técnico e o painel de gestão. O `mobile` (Expo, Android) faz o caminho inteiro online e guarda o trabalho sem sinal numa fila local. **O app ainda não foi visto rodando num aparelho:** até aqui foi validado só pelo código. O andamento do MVP está em [pendencias.md](./pendencias.md). Nada aqui usa dados reais da empresa: o SAP e o registro de funcionários são simulados, e o desenvolvimento usa só dados fictícios.

## Contexto e objetivo

Hoje o processo depende de ordens impressas e de APRs preenchidas em papel e digitalizadas depois. Isso gera retrabalho e dificulta as auditorias e o acompanhamento das atividades. Também não há uma barreira digital confiável que impeça começar um serviço sem a análise de risco aprovada.

O objetivo é que cada OS tenha sua própria APR e que a execução só comece depois de aprovados os requisitos de segurança. Os dados produzidos em campo devem poder ser rastreados, consultados e apresentados num registro digital. O sistema complementa o SAP: a geração e a gestão oficial das ordens continuam nele.

## Fluxo operacional

1. **Receber a OS:** as ordens nascem no SAP e chegam à plataforma pela leitura da API (a cada 15 minutos, ou no "Ler agora") ou por arquivo:
   - a planilha exportada;
   - o PDF da OS impresso pelo SAP, conferido campo a campo antes de registrar.

   A plataforma não cria OS por iniciativa do usuário. A única que nasce nela é a OS de apoio, aberta pelo supervisor da equipe ou pelo admin a partir de um impedimento e ligada à OS original. A equipe vem do centro de trabalho da ordem. O supervisor pode reservar a OS a uma pessoa da equipe ou devolvê-la ao SAP com uma justificativa, se a ordem tiver erro.
2. **Analisar os riscos:** antes de executar, a equipe faz uma APR nova, só daquela OS e daquela tentativa, sem respostas copiadas de outra APR. O técnico escolhe o modelo a cada APR, entre os publicados. O sistema lê a OS e recomenda um, mas não escolhe por ele: o mesmo serviço pode pedir APRs diferentes conforme a situação no local. A equipe marca os riscos que existem na atividade, e só as medidas desses riscos são respondidas.
3. **Validar a APR:** o checklist é respondido por inteiro antes da validação, e a APR exige ao menos 2 participantes. O técnico não sabe quais itens são eliminatórios; só o admin, que edita o modelo, vê isso. O servidor valida as respostas depois que tudo foi respondido e só então mostra o que reprovou. Cada item reprovado é documentado com foto, texto ou PDF, conforme o modelo pede.
4. **Manter a OS pendente quando houver impedimento:** a APR bloqueada fica no histórico, a OS continua pendente e o supervisor é avisado. Qualquer pessoa da equipe pode retomar a OS com uma APR totalmente nova, sem duplicar a ordem nem esperar reprogramação.
5. **Assinar a APR e executar:** aprovada, a APR é assinada por todos os participantes, cada um na própria conta; quem não concorda exerce o direito de recusa e sai da APR. Com todas as assinaturas, a execução começa e registra:
   - horários e quantidade de pessoas;
   - pausas e suspensões, com motivo obrigatório;
   - interrupção por risco, com motivo, foto e assinatura;
   - localização e evidências.

   Todos os participantes acompanham a execução e podem agir sobre ela. Encerrar e suspender por outro motivo viram um pedido de 2 minutos ao responsável. Cada nova retomada da OS exige uma APR nova.
6. **Encerrar e documentar:** o encerramento tem dois passos.
   1. Quem executa clica em "Encerrar OS" e confirma, e o tempo para.
   2. Depois preenche a descrição, as fotos (opcionais) e o checklist de inspeção, quando for preventiva, e assina.

   O supervisor da equipe lê o relatório da execução e assina por último; só então a OS está concluída e sai o PDF da OS. O PDF reproduz a APR e a folha da OS do SAP como são. Tempos, pausas, localização e fotos ficam no relatório da execução, à parte. A baixa no SAP é por planilha.

## O que o sistema faz hoje

### No campo (app Android e área do técnico na web)

- Entrada pelo e-mail institucional, troca da senha provisória e assinatura cadastrada no perfil antes de qualquer outra coisa. Quem ainda não tem conta pode pedir uma na tela de entrada.
- Lista das OS da equipe, com a reserva ("Reservada para você"), e detalhe com:
  - local e mapa;
  - materiais recomendados do serviço;
  - ciclo da preventiva;
  - histórico do local e do equipamento.
- APR em etapas, com a recomendação do modelo, o checklist sem marcar o que é eliminatório, a validação no servidor, a evidência dos itens reprovados e a assinatura de cada participante (ou a recusa).
- Execução com cronômetro, pausa, suspensão, interrupção por risco, cancelamento por engano (até 10 minutos), localização e encerramento em dois passos.
- Execução compartilhada: os participantes acompanham e agem; o que foi feito sem sinal em aparelhos diferentes é conferido depois.
- **Modo offline no app:**
  - cópia da equipe e fila em SQLite;
  - entrada sem sinal por até 7 dias desde a última confirmação do servidor;
  - aviso "Sem conexão — N registros pendentes";
  - envio com o app fechado.
- Perfil com histórico, ausências, preferências de e-mail, avisos, pontos da gamificação e a Vitória, a assistente do sistema.

### Na gestão (web)

- Quadro de OS por estado, com indicadores, filtros, busca, alertas de impedimento e acompanhamento das OS de apoio.
- Assinatura final do supervisor, depois de ler o relatório da execução, e planilha de baixa no SAP (Encerradas, Sem ordem SAP, Impedimentos e Devolvidas).
- Importação de OS pelo SAP simulado, pela planilha, pelo PDF da OS e pela digitalização de OS e APRs antigas em papel (leitura por IA, conferida antes de registrar).
- Modelos de APR com versões e orientação de cada modelo, catálogo de serviço com os materiais recomendados, ciclo das preventivas e o checklist de inspeção de cada plano.
- Equipes e usuários:
  - o supervisor cadastra e o admin libera;
  - o cadastro passa pelo registro de funcionários simulado;
  - ausências, com o representante da equipe que assume quando o supervisor se ausenta;
  - pedidos de conta.
- Cinco dashboards, trilha de auditoria e avisos no sino e por e-mail (o e-mail depende do servidor SMTP).
- Gamificação: pontos por tarefa, temporadas, ranking, patentes e conquistas. A segurança nunca custa pontos.
- Treinamentos de serviço (minijogos com a narração da Vitória), criados pelo admin ou por supervisores, com rascunho pela IA. Antes de publicar, o treinamento é validado pelos supervisores das equipes que mais fazem o serviço.
- Sugestão e contestação da lista de materiais de um serviço, avaliada pelo supervisor da equipe que mais o faz.
- Controle da IA: o admin liga e desliga cada função de IA (chatbot, criação de jogos, recomendação de modelo de APR e digitalização) e autoriza, assinando, a leitura de dados reais.

### Documento

- O PDF da OS, com a APR e a folha da OS do SAP como o papel, gerado depois da assinatura do supervisor. O relatório da execução sai em documento à parte.

## Regras de negócio centrais

- A relação é **uma OS para uma APR por tentativa de execução**; não se reutiliza uma APR entre ordens.
- O técnico escolhe o modelo de cada APR; o sistema só recomenda um e nunca o aplica sozinho.
- Só as medidas dos riscos que a equipe marca na APR são respondidas.
- O checklist completo é analisado antes de se decidir se a atividade pode prosseguir. Alertas não eliminatórios são registrados, mas não bloqueiam a OS, e o técnico não é avisado de qual resposta é alerta nem de qual é eliminatória.
- APRs bloqueadas e tentativas anteriores permanecem no histórico da OS, e a OS pendente pode ser retomada por alguém da equipe com uma APR nova.
- A execução só é liberada depois de uma APR aprovada e assinada por todos os participantes.
- A APR exige ao menos 2 participantes. Cada um assina na própria conta, só no começo, e quem não concorda recusa e sai da APR (com motivo obrigatório). Se restarem menos de 2, ou se quem recusou foi o responsável, é preciso uma APR nova.
- Pausa, suspensão e interrupção por risco são situações diferentes. A pausa e a suspensão exigem um motivo; lesão e enfermidade avisam o supervisor na hora.
- A localização é gravada no início, na pausa, na suspensão, na interrupção e no encerramento. Sem GPS, o serviço não é bloqueado e fica "sem localização".
- O supervisor assina por último (mesmo que tenha participado do serviço), depois de ler o relatório da execução. A OS passa por `encerrando` e `aguardando_supervisor` e só fica `encerrada` com essa assinatura; o PDF só sai depois dela.
- O sistema é online e atende todos os perfis, no app e na web. O modo offline é uma contingência para o campo sem sinal: os dados produzidos sem sinal sobem sem descartar registros (`POST /eventos` é idempotente), e conflitos geram alertas.
- O protótipo e os testes de demonstração usam somente dados fictícios.

## Arquitetura

| Componente | Tecnologia | Responsabilidade |
|---|---|---|
| Aplicativo de campo (`mobile`) | React Native com Expo (SDK 58), SQLite, armazenamento seguro, câmera e localização | APR e execução em campo, com o modo offline de contingência |
| Painel web (`web`) | Next.js (React + TypeScript), React Hook Form e Zod | Campo no navegador, planejamento, gestão, modelos, indicadores e exportações |
| API (`api`) | Node.js com TypeScript (Hono e Drizzle) | Regras de negócio, autorização, integrações, sincronização, PDF, e-mail, tarefas e IA |
| Código comum (`shared`) | TypeScript | Contratos da `api` usados pela `web` e pelo `mobile`, Vitória, avisos, treinamentos e funções de IA |
| Persistência | Supabase: PostgreSQL, Auth e Storage | Banco, autenticação e arquivos; acesso sempre pela `api` |
| IA | Claude (padrão) ou Gemini gratuito, só na demonstração (`IA_PROVEDOR`) | Vitória, rascunho dos treinamentos, recomendação de modelo de APR e digitalização |
| Implantação | Docker (Coolify) | `api` e `web` têm Dockerfile e sobem juntas pelo `docker-compose.yml`; o Dockerfile do `mobile` gera o APK assinado |

A leitura do SAP e o registro de funcionários são simulados na própria `api`, com dados fictícios, para mostrar o fluxo final funcionando dentro da empresa. A planilha e o PDF da OS continuam sendo outras formas de entrada. O banco tem 45 migrações (`0000` a `0044`).

A escrita ou baixa da OS no SAP por API está fora do escopo: o encerramento é exportado por planilha para a baixa manual. O login corporativo (conta Microsoft com segundo fator), a assinatura com validade jurídica e o vínculo do aparelho com o usuário são decisões a validar antes de uma implantação real.

## Executar

Sem Supabase nem Docker, a `api` tem um modo local: banco, autenticação e arquivos em memória, SAP e registro de funcionários simulados, e contas de exemplo com a senha `synqos123`.

```bash
cd api && pnpm install && pnpm dev:local    # http://localhost:3333
cd web && pnpm install && pnpm dev          # http://localhost:3000, abre na tela de entrada
```

Contas de exemplo (e-mail institucional):

- `tiago.tecnico@empresa.com.br`: técnico;
- `sandra.supervisora@empresa.com.br`: técnica que supervisiona uma equipe;
- `admin@empresa.com.br`: admin.

O app aponta para a `api` por `EXPO_PUBLIC_API_URL` e roda pelo *development build* (`pnpm android` na pasta `mobile`; não roda no Expo Go). Detalhes em [mobile/README.md](./mobile/README.md).

Campo e gestão ficam em `/app/*`; as telas só de gestão ficam em `/web/*`. O perfil define o que cada pessoa vê. Só há dois perfis, `tecnico` e `admin`:

- o supervisor não é perfil: é a pessoa que a equipe aponta, e faz tudo o que o técnico faz mais a gestão da(s) equipe(s) que supervisiona;
- o admin cuida da plataforma (importação de OS, modelos de APR, usuários, equipes e IA) e não executa OS;
- a Segurança do Trabalho não usa o sistema: define o critério de bloqueio da APR, e o admin o cadastra no editor.

Detalhes em [web/README.md](./web/README.md) e [api/README.md](./api/README.md).

### Com Docker (`api` + `web`)

A `api` precisa de um Supabase (Postgres, Auth e Storage), na nuvem ou local. Copie `.env.example` para `.env`, preencha as variáveis obrigatórias e suba:

```bash
cp .env.example .env
docker compose up --build   # api em http://localhost:3333 (GET /saude), web em http://localhost:3000
```

A `api` aplica as migrações e carrega os modelos de APR antes de abrir a porta. Os simuladores do SAP e do registro de funcionários já vêm ligados; as telas deles ficam em `/simulador`, só para o admin. O `mobile` não entra no compose: o APK sai do `mobile/Dockerfile` (`pnpm apk` na pasta `mobile`), ver [mobile/README.md](./mobile/README.md#gerar-o-apk).

## Estrutura do repositório

```text
.
├── README.md
├── DesignDoc.md                # Definições e visão do produto
├── pendencias.md               # Guia do MVP: o que falta e o que já foi feito
├── funcionalidades.md          # Mapa das funcionalidades essenciais e extras
├── docker-compose.yml          # Sobe api e web no desenvolvimento
├── .env.example                # Variáveis da api para o compose
├── api/                        # Backend (rotas, regras, banco, PDF, tarefas e IA), com Dockerfile
├── web/                        # Painel e área do técnico em Next.js, com Dockerfile
├── mobile/                     # App de campo (Expo, Android), com o Dockerfile que gera o APK
├── shared/                     # Código comum à api, à web e ao mobile
├── funcionalidades/            # Plano do app mobile (mobile.md)
├── vitoria/                    # Imagens e briefing de design da Vitória
└── base/
    ├── .design/
    │   ├── especificacao.md    # Escopo, regras, contratos e decisões técnicas
    │   └── pontos-a-validar.md # Questões e decisões pendentes
    ├── funcionalidades/        # Um arquivo por demanda (decisões e implementação)
    ├── apr-examples/           # Planilhas-modelo de APR usadas como referência
    ├── os-examples/            # Exemplos de documentos de OS
    ├── contexto/               # Contexto da sessão de especificação
    └── reunioes/               # Transcrições e resumo das correções
```

As oito planilhas de referência de APR correspondem aos modelos de:

- operação;
- instrumentação;
- operação/manutenção;
- construção de rede de distribuição de gás natural;
- conversão de clientes;
- trabalho em altura e espaço confinado;
- inspeção de rede;
- movimentação de almoxarifado.

Os modelos oficiais e o conteúdo deles são definidos e homologados pela Segurança do Trabalho e cadastrados no sistema pelo admin.

## Documentação de referência

- [DesignDoc.md](./DesignDoc.md): definições e visão do produto.
- [pendencias.md](./pendencias.md): o que falta para concluir o MVP, item a item.
- [funcionalidades.md](./funcionalidades.md): mapa do que está pronto, com um arquivo por demanda em [base/funcionalidades/](./base/funcionalidades/).
- [Plano do app mobile](./funcionalidades/mobile.md): as 20 etapas do app e do modo offline.
- [Vitória](./base/funcionalidades/vitoria.md): a assistente, os treinamentos de serviço e a digitalização de OS antigas, com apoio da IA. O [controle da IA](./base/funcionalidades/controle-da-ia.md) e a [validação dos treinamentos](./base/funcionalidades/validacao-de-treinamento.md) estão em arquivos próprios.
- [Gamificação](./base/funcionalidades/gameficacao.md): pontos, patentes, temporadas e conquistas.
- [Previsão do tempo](./base/funcionalidades/previsao-do-tempo.md): a previsão no quadro, na APR e no relatório, com o aviso de risco. As [configurações](./base/funcionalidades/configuracoes.md) reúnem as preferências pessoais e, para o admin, a cidade padrão, os horários e os limites da IA.
- [Execução compartilhada](./base/funcionalidades/execucao-compartilhada.md): acompanhar, agir e conferir o que foi feito sem sinal.
- [Especificação funcional e técnica](./base/.design/especificacao.md): escopo, regras de negócio, arquitetura, contratos e decisões.
- [Pontos a validar](./base/.design/pontos-a-validar.md) e [Questoes.md](./Questoes.md): questões que ainda dependem de confirmação.
- [Correções da Reunião 3](./base/funcionalidades/correcoes-da-reuniao-3.md): o que foi implementado em 18/10/2026. O que a reunião decidiu está no [resumo](./base/reunioes/correcoes-reuniao-3-resumo.md).
- [Resumo das correções da Reunião 2](./base/reunioes/correcoes-reuniao-2-resumo.md): decisões sobre APR, execução, integração e stack.
- [Materiais de APR](./base/apr-examples/) e [exemplos de OS](./base/os-examples/): referências de processo e formato.

## Limites e próximos passos

O que ainda falta para o MVP e a apresentação (a lista completa está em [pendencias.md](./pendencias.md)):

- **Ver o app num aparelho:** montar o APK pelo Dockerfile, instalar e testar o caminho ler OS → APR → executar → PDF, inclusive em modo avião. Até aqui o app foi validado pelo `tsc`, pelo ESLint, pelos testes e por scripts contra a `api` local.
- **Rodar a bateria de perguntas da Vitória na IA real** e testar com a IA de verdade a digitalização da APR em papel e a recomendação de modelo.
- **Configurar o servidor de e-mail (SMTP):** sem ele, os avisos ficam só no sino.
- **Decisões em aberto:**
  - o supervisor devolver a OS ao responsável em vez de assinar;
  - a equipe com só uma pessoa disponível (a APR pede 2);
  - os campos "Houve desvio?" e "Tempo parada" na folha do SAP;
  - mais de 3 executantes na folha do SAP.
- **Dependem de terceiros:**
  - a planilha de OS de 2025;
  - o critério de bloqueio dos modelos (a carga atual é provisória);
  - a lista real de materiais por serviço;
  - onde o SAP guarda o ciclo das preventivas;
  - a assinatura com validade jurídica;
  - o login corporativo;
  - a aprovação para enviar dados ao fornecedor de IA.

Dados reais não devem ser conectados ao protótipo atual.
