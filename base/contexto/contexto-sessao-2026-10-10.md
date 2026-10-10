# Contexto da sessão — 10/10/2026

> Registro do que foi decidido e produzido nesta sessão: estado do projeto, plano do MVP, correções na especificação, questões em aberto, validação do fluxograma, o protótipo visual, o relatório das telas e o protótipo navegável. Os documentos de origem continuam sendo a referência; este arquivo junta tudo para quem retomar o trabalho, inclusive em outra conta ou sessão de IA.
>
> Atualizado no fim da sessão, depois de o time reorganizar o repositório (seção 2). Os caminhos deste arquivo valem para a organização atual.

## 1. Onde paramos

- **Fase:** design concluído. **Nenhuma linha de código escrita.**
- **Especificação** ([apr-om-digital.md](../.design/apr-om-digital.md)): corrigida nesta sessão (seção 5).
- **Fluxograma** ([fluxo-solucao.md](../.design/fluxo-solucao.md)): reescrito em 5 diagramas e validado contra a especificação (seção 6).
- **Questões em aberto:** 46 no total. As 1–21 estão em [pontos-a-validar.md](../.design/pontos-a-validar.md); as 22–46 estão só neste arquivo (seção 7).
- **Protótipo visual (canvas):** 16 telas estáticas publicadas num canvas privado (seção 8).
- **Relatório das telas:** documento com título, descrição e funcionalidades de cada uma das 16 telas (seção 9).
- **Protótipo navegável:** versão HTML/CSS/JS em [src/](../../src/), que abre direto no navegador e é pensada para apresentar em tela (seção 10).
- **Novas ideias do time:** `DesignDoc.md` traz funcionalidades que a especificação ainda não cobre (seção 11).
- **Ainda não atualizado:** [apr-om-digital-resumo.md](../.design/apr-om-digital-resumo.md) não reflete as correções desta sessão (`apr_os`, `encarregado`, `POST /locais`, alerta `apoio_encerrado`).

## 2. Organização do repositório

### Reorganização feita pelo time no fim da sessão

Estas mudanças aparecem no `git status` como alterações **ainda não commitadas**.

| Antes | Agora |
|---|---|
| `.design/*.md` (raiz) | `base/.design/` |
| `.design/contexto-sessao-2026-10-10.md` | `base/contexto/contexto-sessao-2026-10-10.md` (este arquivo) |
| `Transcricao_Reuniao1.md` (raiz) | `base/reunioes/Transcricao_Reuniao1.md` |
| `Desafio.md` | continua na raiz |
| — | `DesignDoc.md` novo na raiz |
| `Anotacoes_Reuniao1.md`, `anotacoes.md`, `novaIdeias.md`, `liveshare.md` (raiz) | **não existem mais na pasta**; seguem no histórico do git (último commit) e parte do conteúdo reaparece em `DesignDoc.md` |
| — | `src/` novo, com o protótipo navegável (seção 10) |

Em `base/.design/` também há dois arquivos novos que não vieram desta sessão de IA: `fluxograma1.svg` e `fluxogramaV2.svg`, os SVGs exportados pelo time (o V2 é o validado na seção 6).

### Documentos em `base/.design`

| Arquivo | Conteúdo |
|---|---|
| [apr-om-digital.md](../.design/apr-om-digital.md) | Especificação completa: decisões-chave, 8 fatias, tabelas, endpoints, diagramas |
| [apr-om-digital-resumo.md](../.design/apr-om-digital-resumo.md) | Versão curta da especificação (desatualizada em relação às correções desta sessão) |
| [fluxo-solucao.md](../.design/fluxo-solucao.md) | 5 diagramas Mermaid: visão geral, campo, sincronização, gestão web, ciclo de status |
| [pontos-a-validar.md](../.design/pontos-a-validar.md) | Questões 1–21 com contexto, opções, recomendação, impacto e quem decide |
| `fluxograma1.svg`, `fluxogramaV2.svg` | Fluxogramas exportados pelo time |

### Outros arquivos do projeto

| Onde | Conteúdo |
|---|---|
| este arquivo | Contexto consolidado da sessão |
| [DesignDoc.md](../../DesignDoc.md) | Definições, telas, funcionalidades e correções do time (seção 11) |
| [src/index.html](../../src/index.html) | Protótipo navegável: casca de apresentação, 16 telas e molduras de celular, navegador e folha A4 |
| [src/styles.css](../../src/styles.css) | Estilos do protótipo (tokens "Prancheta técnica") |
| [src/app.js](../../src/app.js) | Navegação, escala, checklist, sincronização, alertas e exportação simulados |
| Canvas de design | https://claude.ai/artifact/D5sSptiQuFiNTVpuUaB1jK (16 telas estáticas, privado) |
| Relatório das telas | https://claude.ai/code/artifact/3fbdec31-97fb-4c43-847a-c2dc6e14772f (documento, privado) |

> A especificação e os outros documentos de `base/.design/` ainda citam, em alguns trechos, caminhos antigos como `base/` para os xlsx das APRs e a pasta `.design`. Os xlsx e os PDFs de exemplo das OS seguem em `base/`.

## 3. Fluxos do sistema

| # | Fluxo | Quem | Onde |
|---|---|---|---|
| 1 | Login (1º acesso online, depois offline por até 7 dias) | Técnico | App |
| 2 | Sincronização (envia arquivos → envia eventos → baixa novidades) | Técnico | App + servidor |
| 3 | APR sequencial com bloqueio por item | Técnico | App |
| 4 | Execução (iniciar, interromper, encerrar com foto e assinatura) | Técnico | App |
| 5 | Processamento dos eventos e cálculo do status | Servidor | Backend |
| 6 | Geração do PDF da OS executada | Servidor | Backend |
| 7 | Importação SAP e OS manual | Analista / supervisor | Web |
| 8 | Impedimento: alerta, reprogramação, OS de apoio | Supervisor | Web |
| 9 | Painel: quadro, detalhe, indicadores, exportação SAP | Supervisor / analista | Web |
| 10 | Modelos de APR versionados | Segurança do Trabalho | Web |

Ciclo de status da OS: `liberada` → `em_execucao` → `encerrada`; `liberada` ou `em_execucao` → `bloqueada`; `bloqueada` → `liberada` só por reprogramação na web, exigindo APR nova.

## 4. Plano do MVP

### Condições

- Prazo: ~2 semanas até o próximo encontro presencial da maratona.
- Equipe de desenvolvimento: 3 contas Claude Pro. O sistema é desenvolvido pela IA.
- Demo: o caminho importar → sincronizar → APR → executar → PDF roda num Android em modo avião.

### Stack

| Camada | Escolha |
|---|---|
| App | React Native + Expo + TypeScript |
| Banco local (offline) | `expo-sqlite` |
| Câmera e assinatura | `expo-camera` e `react-native-signature-canvas` |
| Web | React + Vite + TypeScript, publicado na Vercel |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| PDF | `pdf-lib` numa Edge Function |
| Planilhas | SheetJS (`xlsx`) |
| E-mail | Resend, chamado pela Edge Function |

### Distribuição para a apresentação

- APK gerado pelo **EAS Build** (plano gratuito), instalado direto no Android sem Google Play.
- Expo Go só durante o desenvolvimento. Na demo, sempre o APK instalado.
- Gerar um APK por semana (o plano gratuito tem fila e limite mensal). Plano B: compilar localmente com Android Studio.

### Cronograma

| Período | Entrega |
|---|---|
| Dias 1–2 | Schema SQL único, contrato de sincronização e seed dos modelos, travados pelos 3 antes de qualquer feature |
| Dias 3–7 | Cada conta faz uma fatia. No fim da semana, APK com sincronização funcionando |
| Dias 8–11 | Execução, PDF e painel. Teste ponta a ponta em modo avião |
| Dias 12–14 | Correção de bugs, dados de demonstração e ensaio. Nada de feature nova |

### Divisão entre as 3 contas

| Conta | Fatia |
|---|---|
| A | Backend: schema, Auth, Edge Functions de sync, PDF e e-mail |
| B | App: login offline, SQLite, fila de eventos, APR e execução |
| C | Web: importação, quadro, exportação e seed dos modelos |

Cada conta trabalha numa branch ou git worktree própria. Para economizar limite: sessões curtas e focadas, especificação de `base/.design/` como contexto, `/compact` com frequência, modelo mais forte só na sincronização.

### Riscos

1. **Contrato de sincronização:** mudar depois de app e backend prontos quebra as duas pontas. Por isso trava nos dias 1–2.
2. **Limite do Pro:** se uma conta estourar, a fatia dela atrasa. Folga nos dias 12–14.
3. **Teste em aparelho real:** a IA não roda o app. Alguém precisa testar o APK num Android toda semana.
4. **Colunas do SAP:** usar o PDF da OS de exemplo como base até o Iago enviar o export real.

### Funcionalidades e sugestão de corte

Implementar tudo em 2 semanas foi considerado **não realista**. A sugestão abaixo ainda **não foi decidida** pelo time.

| Fatia | IDs e funcionalidades |
|---|---|
| Usuário e Equipe | U1 cadastro de usuários e equipes com 5 perfis · U2 login online no 1º acesso · U3 login offline por 7 dias · U4 logout bloqueado com fila pendente · U5 revogação após envio da fila · U6 dupla em campo assina no aparelho de quem está logado |
| Importação SAP | I1 importar xlsx (cria/atualiza por nº da ordem) · I2 relatório de linhas ignoradas · I3 reimportação sem reabrir encerradas · I4 OS manual · I5 cadastro de locais |
| Modelo de APR | M1 carga inicial dos 8 modelos · M2 editor versionado · M3 publicação exige 1 item eliminatório · M4 aceitar APR offline feita em versão anterior |
| Sincronização | S1 sync automático e botão manual · S2 envio idempotente da fila · S3 pull por cursor · S4 alerta de conflito · S5 alerta de execução duplicada · S6 remover do celular OS fora do escopo · S7 arquivos sobem antes do evento |
| APR | A1 checklist sequencial · A2 uma APR para várias OS · A3 encarregado + ao menos um executor · A4 bloqueio imediato com observação e foto · A5 itens de alerta · A6 assinatura dos participantes · A7 rascunho retomável · A8 APR bloqueada imutável · A9 APR válida só no dia |
| Execução | E1 início bloqueado sem APR aprovada · E2 registro de início, descrição, fim, fotos e assinatura · E3 interrupção com motivo e foto · E4 foto e assinatura obrigatórias · E5 PDF no servidor · E6 nova tentativa automática do PDF · E7 GPS nas fotos |
| Impedimento | P1 OS bloqueada + alerta no painel · P2 e-mail ao supervisor · P3 reprogramação com justificativa · P4 OS de apoio · P5 marcar alerta como lido · P6 atraso justificado |
| Painel | D1 quadro com filtros · D2 supervisor vê só a própria equipe · D3 busca e detalhe da OS · D4 histórico por local e equipamento · D5 marcar local crítico · D6 indicador mensal · D7 exportação para o SAP |

- **Levar:** U1–U3, I1, I2, I4, I5, M1, S1, S2, S3, S7, A1–A8, E1–E5, P1, P3, D1–D3, D7.
- **Deixar de fora:** M2–M4, U4–U6, S4–S6, E6, E7, P2, P4–P6, D4–D6.
- **Em aberto:** S3 pode virar snapshot completo no MVP (questão 4). A2 deve ser mantido: é uma dor do desafio.

## 5. Correções aplicadas na especificação

### Lacunas da especificação (resolvidas como suposição adotada)

| # | Lacuna | O que foi registrado |
|---|---|---|
| B1 | Nenhuma tabela dizia quais OS uma APR cobre | Tabela `apr_os (apr_id, os_id)`. O evento `apr_concluida` leva a lista `os_ids`. Bloqueio de APR leva **todas** as OS cobertas a `bloqueada` |
| B2 | `equipe.supervisor_id` aceita nulo e `alerta.destinatario_id` não | Equipe sem supervisor: um alerta para cada analista ativo |
| B3 | Não havia como cadastrar local fora do SAP | `POST /locais {codigo, endereco?, plus_code?, cliente?}`, usado na OS manual. Código repetido → `409` |
| B4 | "Supervisor" tinha dois sentidos | `apr_participante.funcao` passou a `encarregado` \| `executor`. "Supervisor" ficou só como perfil de gestão na web |
| B5 | A OS de apoio não tinha fim definido | Novo tipo de alerta `apoio_encerrado`. A OS original continua `bloqueada` até ser reprogramada manualmente |

### Erros do primeiro diagrama (corrigidos no fluxo-solucao.md)

1. Sincronização é uma ação só: primeiro envia, depois baixa.
2. Fotos e assinaturas sobem ao Storage **antes** do evento que as referencia.
3. Os 5 eventos vão para a fila: `apr_concluida` (aprovada ou bloqueada), `execucao_iniciada`, `execucao_encerrada`, `execucao_interrompida`.
4. Depois de encerrar, o técnico volta para a próxima OS coberta pela APR.
5. O pull é por cursor na especificação. Snapshot é proposta de MVP (questão 4).
6. Alertas de conflito e execução duplicada entraram no diagrama de sincronização.
7. O seed dos modelos é carga no backend. O editor de modelos é ação da Segurança do Trabalho na web.

## 6. Fluxograma

### Estrutura atual do fluxo-solucao.md

1. Visão geral (SAP → web → banco → app → banco → web → SAP).
2. Campo: app Android offline.
3. Sincronização e servidor (diagrama de sequência).
4. Gestão web.
5. Ciclo de status da OS.

### Validação do SVG exportado pelo time (fluxogramaV2, diagrama de campo)

**Correto em relação à especificação:** passos, decisões, os 5 eventos da fila e o retorno para a próxima OS coberta.

**Cores a corrigir** (foram aplicadas fora do repositório; o `fluxo-solucao.md` ainda não tem `classDef`):

| Nó | Está | Deve ficar |
|---|---|---|
| Interromper | sem cor | `blockingNode` |
| Marca aviso amarelo | `processNode` | `warningNode` |
| APR aprovada | `processNode` | `approvedNode` |
| Fim do dia | `approvedNode` | `processNode` |
| `eventNode` | definida e sem uso | aplicar ou remover |

Paleta usada pelo time, para manter igual no repositório:

```text
classDef processNode  fill:#EEF2FF,stroke:#818CF8
classDef decisionNode fill:#FFF7ED,stroke:#FB923C
classDef eventNode    fill:#F0FDFA,stroke:#2DD4BF
classDef blockingNode fill:#FEF2F2,stroke:#F87171
classDef warningNode  fill:#FEFCE8,stroke:#FACC15
classDef approvedNode fill:#F0FDF4,stroke:#4ADE80
classDef queueNode    fill:#F5F3FF,stroke:#A78BFA
```

**Ajustes de conteúdo:**
- **Interromper não tem continuação.** Depende da questão 2: se só a OS interrompida para, falta a seta para "Outra OS coberta ainda pendente?".
- **APR bloqueada não tem fim.** Acrescentar o nó "Aguardar reprogramação pelo supervisor".
- **Entrada única para "Iniciar execução".** O técnico também pode voltar mais tarde no mesmo dia (regra A9). Anotar no diagrama.

**Dependem da equipe:** questões 2, 6, 8 e 9.

## 7. Questões em aberto

Legenda de impacto: 🔴 muda tabela ou contrato de sync · 🟡 muda tela ou regra da demo · 🟢 não afeta a demo.

### 1–21 (detalhadas em pontos-a-validar.md)

| # | Questão | Impacto |
|---|---|---|
| 1 | APR bloqueada bloqueia todas as OS cobertas? | 🔴 |
| 2 | Interrupção numa OS para as demais OS da mesma APR? | 🔴 |
| 3 | Uma OS pode exigir mais de um modelo de APR? | 🔴 |
| 4 | Pull por cursor ou snapshot completo no MVP? | 🔴 |
| 5 | Como uma OS cancelada no SAP sai do sistema? | 🔴 |
| 6 | Como desfazer uma execução iniciada por engano? | 🔴 |
| 7 | Execução iniciada e nunca encerrada | 🟡 |
| 8 | Validade da APR: dia do calendário ou janela de horas? | 🟡 |
| 9 | Resposta "NA" em item eliminatório | 🟡 |
| 10 | Quem pode ser encarregado e executor? | 🟡 |
| 11 | Quem assina o encerramento numa dupla? | 🟡 |
| 12 | OS manual e OS de apoio: como entram no SAP? | 🟡 |
| 13 | Exportar também OS bloqueadas para o SAP? | 🟡 |
| 14 | Reimportação muda a data de uma OS já reprogramada | 🟡 |
| 15 | PDF por OS ou por APR? | 🟡 |
| 16 | Limite e compressão de fotos | 🟡 |
| 17 | Relógio do aparelho errado | 🟢 |
| 18 | Esqueci a senha / troca de senha com login offline | 🟢 |
| 19 | Local manual que depois chega do SAP com outro código | 🟢 |
| 20 | Quais alertas também vão por e-mail? | 🟢 |
| 21 | Analista pode reprogramar? | 🟢 |

### 22–26: contradições dentro da especificação (ainda não corrigidas no documento)

| # | Ponto | Impacto | Recomendação |
|---|---|---|---|
| 22 | Supervisor cria OS de apoio "para outra equipe", mas o perfil dele só age na própria equipe | 🟡 | Permitir OS de apoio para qualquer equipe |
| 23 | `os.modelo_apr_codigo` é obrigatório e `equipe.modelo_apr_codigo` é opcional: importar OS de equipe sem modelo falha | 🔴 | Exigir modelo padrão na equipe, ou a importação ignora a linha e informa o motivo |
| 24 | Técnico sem e-mail não consegue entrar (o Supabase Auth exige e-mail) e `POST /usuarios` não tem senha | 🔴 | Login por matrícula com e-mail interno gerado e senha inicial definida pelo admin, trocada no 1º acesso |
| 25 | O diagrama de sincronização gera o PDF dentro do envio da fila, mas a especificação prevê nova tentativa automática | 🟡 | Gerar o PDF de forma assíncrona (gatilho ou fila), fora da sincronização |
| 26 | Volume de ~390 OS/mês na especificação e ~900 na transcrição (L50) | 🟢 | Confirmar com o Iago |

### 27–36: requisitos da Reunião 1 que a especificação não cobre

| # | Ponto | Fonte | Impacto | Quem decide |
|---|---|---|---|---|
| 27 | Interrupção também precisa ser justificada à **pessoa solicitante**; ninguém sabe quem é nem onde fica registrado | Transcrição L115 | 🔴 | Iago |
| 28 | APR tem **contatos de emergência** e campo de observações gerais; nada disso está no modelo nem no PDF | L82 | 🟡 | Mario |
| 29 | A OS só pode ser executada depois de **liberada pelo analista no SAP**; a importação marca tudo como `liberada` | L132–133 | 🔴 | Iago |
| 30 | A operação usa os status "Pendente" e "Imprimida"; a especificação usa "bloqueada" | Anotações | 🟡 | Iago |
| 31 | As anotações falam em **designar a OS a um usuário e ele aceitar**; a especificação atribui só à equipe | novaIdeias.md | 🔴 | Time + Iago |
| 32 | Não existe **APR 08** em `base/` (há 01–07 e 09) | base/ | 🟡 | Mario |
| 33 | APR 09 (almoxarifado) é do módulo MM; essas OS vêm no export de manutenção (PM)? | L47 | 🟡 | Iago |
| 34 | "Parâmetros exóticos" (umidade, condição psicológica) podem exigir respostas que não são Sim/Não | Anotações | 🔴 | Mario |
| 35 | **Celular em área classificada:** pode causar fagulha. Onde a APR é preenchida? Precisa de aparelho intrinsecamente seguro? | L104 | 🟡 | Mario |
| 36 | "Tem OS que vai para o exterior": pode ser OS de empresa terceira. Terceiros usam o app? | Anotações | 🟡 | Iago |

### 37–41: operação e implantação

| # | Ponto | Impacto | Recomendação |
|---|---|---|---|
| 37 | Dados reais (clientes, fotos, assinaturas) num Supabase fora do ambiente corporativo: LGPD e segurança | 🟡 | Dados fictícios na demo; aval da empresa antes do piloto |
| 38 | Assinatura desenhada no celular vale para auditoria? | 🟢 | Confirmar com o Iago e, se ele indicar, com compliance |
| 39 | Atraso conta a partir da data de início ou de fim programada? | 🟡 | Data de fim quando existir; senão, a de início. Confirmar |
| 40 | Colunas da planilha de saída para baixa no SAP | 🟡 | Pedir ao Iago um exemplo junto com o export de entrada |
| 41 | Aparelhos do piloto: quem fornece, versão mínima do Android, compartilhados ou não | 🟢 | Definir antes do piloto |

### 42–46: vindas do DesignDoc.md (seção 11)

| # | Ponto | Impacto | Recomendação |
|---|---|---|---|
| 42 | O DesignDoc diz "APR 1 - 1 OS", mas a especificação e a Reunião 1 dizem que uma APR cobre várias OS do mesmo local, modelo e dia | 🔴 | Confirmar com o time se é anotação antiga. Se mudou, a tabela `apr_os` e o fluxo de seleção de OS mudam |
| 43 | O DesignDoc admite ler as OS "por requisição HTTP de uma API", mas o SAP não tem API e a especificação a deixa de fora | 🔴 | Perguntar ao Iago se há previsão de API. Se houver, definir qual lado chama qual e manter a importação por planilha como alternativa |
| 44 | Painel pessoal do funcionário (histórico de OS e registro de assinaturas): onde fica, no app ou na web, e quais OS aparecem (o app só baixa as ativas) | 🟡 | No app, aba "Histórico" com as OS encerradas do próprio técnico. Exige baixar também as encerradas no pull |
| 45 | Catálogo de serviço, atribuição automática, escaneamento de papéis antigos e monitoramento do intervalo das preventivas: entram no MVP? | 🟢 | Deixar para depois da demo, anotando como evolução |
| 46 | Documentação comprobatória em PDF além da foto: quem anexa e como no celular | 🟡 | MVP só com foto; anexar PDF fica para depois |

### Prioridade

- **O time decide já:** 4, 6, 22, 23, 24, 25, 42, 45.
- **Levar ao Iago e ao Mario:**
  - mudam o banco: 1, 2, 3, 5, 27, 29, 31, 34, 43;
  - segurança do trabalho: 28, 32, 35;
  - escopo do painel pessoal e do anexo em PDF: 44, 46.

## 8. Protótipo visual

- **Link:** https://claude.ai/artifact/D5sSptiQuFiNTVpuUaB1jK
- **Formato:** canvas de design "Protótipo D.A.P.R.O.M", privado. Para outras pessoas abrirem, compartilhar pelo menu Share.
- **Fonte das telas:** os arquivos `.dc.html` ficam no próprio canvas e podem ser recuperados pelo link.
- **Escopo:** mostra a visão completa da especificação, não só o MVP (inclui editor de modelos, OS de apoio, e-mail e indicadores).
- **Estado:** telas estáticas, sem navegação. A renderização não foi conferida depois de publicada.

### Telas e posição no canvas

Posições conforme publicado; podem ter sido movidas no editor depois.

| Arquivo | Tela | Tamanho | Posição (x, y) |
|---|---|---|---|
| `Main.dc.html` | App · Entrar | 390×844 | 0, 0 |
| `App-Lista.dc.html` | App · OS da equipe | 390×844 | 470, 0 |
| `App-Detalhe.dc.html` | App · Detalhe da OS | 390×844 | 940, 0 |
| `App-NovaAPR.dc.html` | App · Nova APR (escopo e participantes) | 390×844 | 1410, 0 |
| `App-Checklist.dc.html` | App · Checklist da APR | 390×844 | 1880, 0 |
| `App-Bloqueio.dc.html` | App · APR bloqueada | 390×844 | 2350, 0 |
| `App-Aprovada.dc.html` | App · APR aprovada e assinaturas | 390×844 | 2820, 0 |
| `App-Execucao.dc.html` | App · Execução | 390×844 | 3290, 0 |
| `App-Sincronizacao.dc.html` | App · Fila e sincronização | 390×844 | 3760, 0 |
| `Web-Quadro.dc.html` | Web · Quadro de OS | 1280×1240 | 0, 1264 |
| `Web-DetalheOS.dc.html` | Web · Detalhe da OS | 1280×1560 | 1360, 1264 |
| `Doc-PDF-OS.dc.html` | PDF da OS executada (A4) | 794×1123 | 2720, 1264 |
| `Web-Impedimento.dc.html` | Web · Alertas e impedimento | 1280×1200 | 3594, 1264 |
| `Web-Importacao.dc.html` | Web · Importação SAP | 1280×1300 | 0, 3244 |
| `Web-Indicadores.dc.html` | Web · Indicadores e exportação | 1280×1340 | 1360, 3244 |
| `Web-ModelosAPR.dc.html` | Web · Modelos de APR | 1280×1240 | 2720, 3244 |

Notas no canvas: três títulos de linha (app, painel web, entrada/indicadores/modelos) e um aviso de "dados fictícios" à esquerda da primeira linha.

### O que cada tela mostra

**App (técnico, sem sinal):**
- **Entrar:** matrícula e senha; aviso de que o acesso offline está liberado (último login online há 2 dias, vale até 7).
- **OS da equipe:** filtros por status, faixa "sem sinal desde 08:12", OS agrupadas por local com tag de crítico, atalho "uma APR cobre as 3 OS deste local".
- **Detalhe da OS:** dados do SAP, local com plus code, instruções e materiais, APR exigida; ação "Iniciar APR" com aviso de que a execução só libera após a APR.
- **Nova APR:** modelo e versão, OS cobertas (mesmo local, modelo e dia), participantes com encarregado e executor.
- **Checklist:** pergunta atual em destaque com tag "Eliminatório · bloqueia no Não", respostas anteriores (uma com alerta amarelo), próximas perguntas travadas, rascunho salvo no aparelho.
- **APR bloqueada:** item que bloqueou, observação e foto obrigatórias, aviso ao supervisor, APR imutável.
- **APR aprovada:** alerta registrado, assinaturas dos participantes, OS liberadas para execução.
- **Execução:** início e duração, descrição, fotos com hora e GPS, assinatura do executor, ações "Interromper" e "Encerrar OS".
- **Fila e sincronização:** arquivos enviados, registros confirmados um a um, próxima etapa (baixar novidades), garantia de que reenviar não duplica.

**Web (gestão):**
- **Quadro de OS:** indicadores do mês, faixa de alertas, filtros, 4 colunas por status com cartões.
- **Detalhe da OS:** dados do SAP, APR com participantes e respostas, execução com fotos e assinatura, documento PDF, situação da baixa no SAP, linha do tempo de auditoria.
- **PDF da OS:** cabeçalho da OS, APR com respostas, participantes com assinatura, execução, evidências fotográficas.
- **Alertas e impedimento:** lista de alertas (bloqueio, interrupção, apoio encerrado, conflito, execução duplicada), detalhe do bloqueio com motivo e foto, duas decisões lado a lado: "Abrir OS de apoio" e "Reprogramar" (justificativa obrigatória).
- **Importação SAP:** área de envio, resultado (criadas, atualizadas, ignoradas), linhas ignoradas com motivo, colunas lidas, histórico, atalho para OS manual.
- **Indicadores e exportação:** preventivas do mês, gráfico de barras empilhadas por equipe com tabela, lista de OS encerradas a exportar e botão de gerar planilha.
- **Modelos de APR:** lista dos 8 modelos, versões, rascunho v5 em edição com tipo (eliminatório/alerta) e resposta crítica por pergunta, validações e publicação.

### Sistema visual: "Prancheta técnica"

**Tipografia:** IBM Plex Sans (400, 500, 600, 700) para texto; IBM Plex Mono (400, 500, 600) para códigos (nº da OS, nota, matrícula, centro de trabalho).

**Cores base:**

| Papel | Cor |
|---|---|
| Fundo da página | `#F2F2EE` |
| Superfície / superfície secundária | `#FFFFFF` / `#F7F7F4` |
| Fundo de coluna do quadro / chip neutro | `#E8E9E3` / `#EDEEE9` |
| Linhas (padrão / interna / forte e inputs / tracejado) | `#DCDDD6` / `#ECEDE8` / `#C5C7BE` / `#9AA29A` |
| Texto (principal / forte secundário / secundário / apagado) | `#17212B` / `#2C3742` / `#4A5561` / `#66707A` |
| Ação principal / hover | `#0F5C78` / `#0B4A61` |
| Fundo claro da ação / borda / texto sobre ele | `#E2EEF3` / `#B8D3DE` / `#0D3F52` |
| Cabeçalho escuro (app e web) | `#17212B`, com detalhes em `#22303C`, `#26323E`, `#2B3846`, borda `#3A4754`, texto secundário `#C4CDD5` |

**Status (fundo / texto):**

| Status | Fundo | Texto |
|---|---|---|
| Liberada | `#E3EDF9` | `#1C5CAB` |
| Em execução | `#FFF0D4` | `#8A4B00` |
| Bloqueada | `#FBE4E1` | `#A3241B` (botão de perigo `#A3241B`, borda `#EDB3AC`) |
| Encerrada | `#E1F2E6` | `#1E6236` |
| Item de alerta | `#FFF4C7` (faixa `#FFF8E0`, borda `#E9CF6B`) | `#6E4C00` |
| Aviso de sem sinal | `#FFF6DC` (borda `#E8C873`) | `#4D3800` |
| Tag "crítico" | `#FFF3EC` (borda `#E7B394`) | `#A3420D` |
| Chip "Offline" no cabeçalho escuro | `#2B3846` | `#F6C453` |
| Chip "Sincronizando" no cabeçalho escuro | `#1F3A2B` | `#8FE0AE` |

**Gráfico de indicadores:** paleta validada com o verificador de daltonismo sobre fundo branco (todas as checagens aprovadas). As cores ficam sempre com legenda e tabela.

| Série | Cor |
|---|---|
| Encerradas | `#0CA30C` |
| Abertas no prazo | `#2A78D6` |
| Atrasadas com justificativa | `#C98500` |
| Atrasadas sem justificativa | `#D03B3B` |

Barras de 20px, 2px de vão entre segmentos, ponta de 4px arredondada, linhas de grade de 1px.

**Formas e medidas:**
- Raios: 8px em botões e campos, 10px em cartões, 12px em painéis, pílula (999px) em badges e chips.
- Alturas: botão principal do app 54px, toque mínimo 44px, campo do app 52px; campo da web 40px, botão da web 42px.
- Ícones: SVG inline de traço (estilo Feather), 2px; nenhum emoji.

**Estrutura:**
- **App:** cabeçalho escuro, conteúdo claro, rodapé fixo com a ação principal, barra inferior com OS, Fila e Perfil.
- **Web:** barra superior escura (marca, busca por nº da ordem, alertas, usuário) e menu lateral (Quadro de OS, Alertas, Importação SAP, Indicadores e exportação, Modelos de APR, Equipes e usuários).

**Acessibilidade:** botões e campos reais com rótulo; status sempre com texto (e ícone quando possível); contraste de texto de pelo menos 4,5:1.

### Dados fictícios: a história de um dia

Todas as telas contam a mesma terça-feira, **13/10/2026**, da equipe **Serviços Especiais**.

| Hora | Acontecimento |
|---|---|
| 07:58 | Última sincronização na base |
| 08:12 | O celular perde o sinal |
| 08:41 | Fernanda inicia a OS 4031012 na Mineração Atlântica |
| 09:12–09:24 | Carlos e Diego fazem a APR #A-2210 na ERP Serra, cobrindo 3 OS |
| 09:31 | Início da OS 4031187 |
| 09:52, 10:07, 10:41 | Fotos da execução |
| 10:52 | Execução da OS 4030990 interrompida (odor de gás) |
| 11:18 | OS 4031187 encerrada |
| 11:26 | Início da OS 4031190 |
| 12:38 | O sinal volta e a fila sincroniza |
| 12:40 / 12:41 | Servidor recebe a OS 4031187 e gera o PDF |

**Pessoas:**

| Nome | Papel |
|---|---|
| Carlos Menezes | Técnico, encarregado da APR, mat. 10482 |
| Diego Rocha | Técnico, executor, mat. 12077 |
| Fernanda Lopes | Técnica, mat. 11350 |
| Paulo Ribeiro | Técnico |
| Marcos Tavares | Supervisor da equipe Serviços Especiais |
| Ana Ribeiro | Analista (todas as equipes) |
| Luciana Prado | Segurança do Trabalho |

**Equipes:** Serviços Especiais (`SERV_ESP`, modelo padrão APR 03), Instrumentação (`INSTRUM`), Manutenção Civil, Inspeção de Rede, Atendimento Residencial. Centro de trabalho sem equipe usado nas linhas ignoradas: `LAB_QUI`.

**Locais:** ERP Serra (crítico; Rod. BR-101, km 262, Serra/ES; plus code M4R7+QG Serra), ERS Vila Velha 02 (crítico), PR Cariacica (crítico), Rede Vila Velha (Av. Champagnat, 1100), Rede Serra Norte, Rede Vitória Centro, Mineração Atlântica (cliente crítico), Celulose Capixaba (cliente crítico).

**OS principais:**

| OS | Tipo | Atividade | Local | Situação |
|---|---|---|---|---|
| 4031187 | Preventiva | Inspeção de corrosão em válvulas da ERP (nota 10018842, equip. VLV-ERP01-012) | ERP Serra | Encerrada 11:18, PDF 12:41 |
| 4031190 | Preventiva | Calibração da PSV da linha 2 | ERP Serra | Em execução desde 11:26 |
| 4031204 | Preventiva | Teste de estanqueidade do filtro F-201 | ERP Serra | Liberada, coberta pela APR |
| 4031012 | Corretiva | Vazamento em conexão do medidor industrial | Mineração Atlântica | Em execução desde 08:41 |
| 4030877 | Corretiva | DCV Desobstrução de caixa de válvula | Rede Vila Velha | Bloqueada em 12/10 09:14 (caixa alagada) |
| 4030990 | Corretiva | Reparo em válvula de bloqueio | Rede Serra Norte | Bloqueada (interrompida 10:52) |
| 4030655 | Preventiva | Inspeção de válvula na área industrial | Celulose Capixaba | Bloqueada; OS de apoio 4031301 (dedetização) encerrada |
| 4030951 | Preventiva | Pintura anticorrosiva de suportes | ERS Vila Velha 02 | Encerrada 12/10, exportada ao SAP |

**APR #A-2210:** APR 03 versão 4; aprovada às 09:24; 18 itens, 17 conformes, 1 alerta (iluminação auxiliar); cobre 4031187, 4031190 e 4031204.

**Números exibidos:**
- **Quadro (Serviços Especiais):** 18 liberadas (7 em locais críticos), 4 em execução, 3 bloqueadas, 41 encerradas no mês (+6 vs. setembro), 5 preventivas atrasadas (2 sem justificativa), 3 alertas não lidos.
- **Importação de 13/10:** `export_ordens_2026-10-13.xlsx`, 412 linhas; 37 criadas, 368 atualizadas, 7 ignoradas. Histórico: 06/10 (52/331/4) e 01/10 (389/0/11).
- **Indicadores de outubro (todas as equipes):** 212 preventivas; 164 encerradas (77%); 18 abertas no prazo; 21 atrasadas com justificativa; 9 sem justificativa (−4 vs. setembro).
- **Exportação:** 12 OS encerradas ainda não exportadas; última exportação em 12/10 às 17:05 (29 OS).

**Preventivas por equipe (encerradas / no prazo / atrasadas com just. / sem just. = total):**

| Equipe | Valores |
|---|---|
| Serviços Especiais | 38 / 3 / 3 / 2 = 46 |
| Instrumentação | 41 / 6 / 3 / 2 = 52 |
| Manutenção Civil | 42 / 4 / 9 / 3 = 58 |
| Inspeção de Rede | 30 / 3 / 4 / 1 = 38 |
| Atendimento Residencial | 13 / 2 / 2 / 1 = 18 |

**Modelos de APR:**

| Modelo | Versão | Perguntas |
|---|---|---|
| APR 01 · Operação | v3 | 16 |
| APR 02 · Instrumentação | v3 | 15 |
| APR 03 · Operação e manutenção | v4 em uso, v5 em rascunho | 18 (19 na v5) |
| APR 04 · Construção de rede de distribuição | v3 | 21 |
| APR 05 · Conversão de clientes | v3 | 14 |
| APR 06 · Altura e espaço confinado | v3 | 24 |
| APR 07 · Inspeção de rede | v3 | 12 |
| APR 09 · Movimentação de almoxarifado | v1 | 11 |

A v5 da APR 03 acrescenta "Os participantes conhecem o plano de emergência do cliente?" e tem 9 itens eliminatórios.

### Premissas e divergências do protótipo

- **Dados fictícios:** pessoas, clientes e números de OS são inventados; os clientes críticos reais citados na Reunião 1 foram trocados por nomes fictícios.
- **Sem marca da empresa:** o produto aparece só como D.A.P.R.O.M.
- **Versões dos modelos:** começam na revisão do papel (REV 03 → v3). **Diverge da especificação**, que manda a carga inicial entrar como versão 1.
- **Questões em aberto mostradas com a proposta atual:** APR bloqueada bloqueia todas as OS cobertas (questão 1); e-mail só para bloqueio (questão 20); função de campo chamada "encarregado".
- **"Resposta crítica":** nome usado no editor de modelos para o campo `resposta_bloqueante`.
- **Rótulos de alerta:** o tipo `bloqueio` aparece como "APR bloqueada" ou "Execução interrompida", conforme a origem.
- **Ideias do protótipo que não estão na especificação** (validar antes de implementar): código de verificação no rodapé do PDF, botão "Mapa" no detalhe da OS, "Comparar com a v4" no editor, contagem de APRs por versão.

## 9. Relatório das telas

- **Link:** https://claude.ai/code/artifact/3fbdec31-97fb-4c43-847a-c2dc6e14772f (documento "Telas do protótipo D.A.P.R.O.M", privado; compartilhar pelo menu Share).
- **Público:** banca e mentores da maratona, na apresentação das telas.
- **Formato:** para cada uma das 16 telas, título numerado, descrição de 2 a 5 linhas e lista de "Principais funcionalidades". Abre com uma visão geral (9 telas do app, 6 do painel web e o PDF, todas no mesmo dia de trabalho) e o link do canvas.
- **Agrupamento:**
  - App · acesso e OS do dia: 1 Entrar, 2 OS da equipe, 3 Detalhe da OS.
  - App · APR: 4 Nova APR, 5 Checklist da APR, 6 APR bloqueada, 7 APR aprovada.
  - App · execução e sincronização: 8 Execução, 9 Fila e sincronização.
  - Painel web · acompanhamento: 10 Quadro de OS, 11 Detalhe da OS, 12 Alertas e impedimento.
  - Painel web · dados e configuração: 13 Importação SAP, 14 Indicadores e exportação, 15 Modelos de APR.
  - Documento gerado: 16 PDF da OS executada.
- **Numeração:** a mesma do roteiro do protótipo navegável (seção 10) e da ordem do canvas.

## 10. Protótipo navegável (`src/`)

### Como usar

- Abrir [src/index.html](../../src/index.html) no navegador. Não há build, servidor nem dependência instalada.
- As fontes IBM Plex vêm do Google Fonts; sem internet, usa a fonte do sistema e continua funcionando.
- **Casca de apresentação:** barra superior com seletor de seção (App Android, Painel web, PDF), posição atual (`n/16`), botões anterior e próxima, e tela cheia. Menu lateral "roteiro" com as 16 telas.
- **Atalhos:** ← e → trocam de tela, **M** mostra ou oculta o roteiro, **F** liga a tela cheia.
- **Molduras:** celular (410×864) para o app, janela de navegador (1280×820, com URL fictícia por tela) para o painel web e folha A4 (794×1123) para o PDF. Cada moldura se ajusta ao tamanho da tela, com escala máxima de 1,35.
- **Links diretos por tela:** `index.html#app-entrar`, `#app-lista`, `#app-detalhe`, `#app-nova-apr`, `#app-checklist`, `#app-bloqueio`, `#app-aprovada`, `#app-execucao`, `#app-sync`, `#web-quadro`, `#web-detalhe`, `#web-alertas`, `#web-importacao`, `#web-indicadores`, `#web-modelos`, `#doc-pdf`.

### O que funciona de verdade

| Área | Comportamento |
|---|---|
| Navegação | Botões e links levam à tela seguinte (entrar, iniciar APR, encerrar OS, abrir OS pelo quadro, ver PDF, ir à exportação). O usuário do cabeçalho muda por tela: supervisor, analista ou Segurança do Trabalho |
| Lista de OS (app) | Filtro por status funcional (todas, liberadas, em execução, bloqueadas, encerradas) |
| Checklist | 18 perguntas sequenciais. Resposta crítica em item eliminatório leva à tela de bloqueio, com o item e a resposta que bloquearam. Item de alerta registra e segue. Concluir as 18 leva à APR aprovada, com o número de alertas calculado. Dois atalhos: "ir à pergunta 9" e "responder o resto" |
| Bloqueio | "Interromper" na execução abre a mesma tela com o motivo da interrupção |
| Sincronização | O botão simula o envio na ordem arquivos → registros → novidades, com contadores, barra e situação de cada registro; no fim, oferece "Ver a OS no painel web" |
| Alertas (web) | Cinco alertas selecionáveis, cada um com seu detalhe. Selecionar marca como lido e atualiza os contadores (sino, menu lateral e título). Em bloqueios: OS de apoio e reprogramação, que recusa justificativa vazia |
| Exportação SAP | Gera a planilha, marca as 12 OS como exportadas e zera a lista; repetir avisa que não há OS nova |
| Modelos de APR | Lista de modelos clicável; só a APR 03 tem detalhe, as demais avisam |
| Botões sem função real | Mostram um aviso do que fariam (câmera, mapa, formulário de OS manual, publicar v5 etc.) |

### O que não funciona (por desenho)

- Campos de login, busca e filtros do quadro e dos indicadores não têm efeito.
- OS manual, importação de arquivo e publicação de modelo não gravam nada.
- Poucas OS do quadro levam a outra tela: as bloqueadas levam aos alertas e a encerrada 4031187 leva ao detalhe; as demais mostram um aviso.
- Perfil, equipes e usuários ficam fora.
- **Painel pessoal do funcionário** (histórico de OS e assinaturas) não existe no protótipo, porque a especificação não o prevê (seção 11).

### Estrutura técnica

- **Arquivos:** `index.html` (telas, ícones em sprite SVG e molduras), `styles.css` (componentes por classe) e `app.js` (lógica). Sem framework.
- **Roteamento por hash.** Cada tela é uma `section` com id `s-<nome>` (por exemplo `s-app-lista`) e `data-kind`, `data-title`; o hash usa só `<nome>`. O prefixo `s-` existe de propósito: sem ele, o navegador rola o painel até o elemento de mesmo id e o topo das telas web aparece cortado.
- **Ordem do roteiro:** a ordem das `section` no HTML (9 de app, 6 de web, 1 de PDF).
- **Estado:** em memória, por variáveis do `app.js` (`ck` para o checklist, `sy` para a sincronização, `ALERTS`, `exported`). Recarregar a página volta tudo ao início.
- **Perguntas do checklist:** 18 itens em `Q`, com tipo (eliminatório ou alerta), resposta crítica e resposta conforme. Os itens 1 a 9 são de verificação (o 5 é alerta; os demais são eliminatórios) e os itens 10 a 18 são medidas preventivas. O texto das perguntas 12 a 18 é **fictício**, criado para o protótipo.
- **Dados:** os mesmos do canvas (seção 8): terça-feira 13/10/2026, equipe Serviços Especiais, mesmos nomes, OS e números.

### Verificação feita

- Sintaxe do JavaScript conferida.
- Ids usados pelo JS e links internos conferidos contra o HTML: 16 telas, tags balanceadas.
- **Renderização headless no Edge**, conferida a olho: quadro, alertas, indicadores, PDF, checklist e sincronização.
- **Renderizadas mas não abertas:** `app-lista`, `web-detalhe` e `web-modelos`.
- **Nunca renderizadas:** `app-entrar`, `app-detalhe`, `app-nova-apr`, `app-bloqueio`, `app-aprovada`, `app-execucao` e `web-importacao`.
- **Cliques não testados** em navegador: checklist, sincronização, alertas, exportação e filtros. A lógica foi escrita e revisada, mas nunca executada com cliques.

### Correções feitas durante a construção

1. Abrir uma tela web por link direto deixava o topo cortado (rolagem automática até o id) → ids prefixados com `s-`.
2. "Indicadores e exportação" quebrava em duas linhas no menu → menu lateral alargado para 256px.
3. Na sincronização, o selo mostrava "Pronto para enviar" com ícone de sem sinal e o título quebrava → selo com ícone de atualizar e texto "Com sinal", "Enviando" ou "Sincronizado 12:41"; título "Sincronização".

### Divergências em relação ao canvas

- A tela 9 se chama "Sincronização" no cabeçalho do app, mas "Fila e sincronização" no roteiro e no relatório.
- A tela de bloqueio ganhou conteúdo dinâmico: item, resposta e motivo variam conforme a origem.
- Ideias herdadas do canvas que **não estão na especificação** e precisam de validação antes de implementar: código de verificação no rodapé do PDF, botão "Mapa" no detalhe da OS, "Comparar com a v4" no editor de modelos, contagem de APRs por versão.

## 11. Novas definições do time (`DesignDoc.md`)

Arquivo novo na raiz, escrito pelo time. Resume definições, telas e funcionalidades. Abaixo, cada ponto comparado com a especificação atual. **Nada disto foi levado à especificação nem ao protótipo.**

### Já coberto pela especificação

| Ponto do DesignDoc | Onde está na especificação |
|---|---|
| Informações de cada OS (título, descrição, tipo de atividade, material, local, responsável, criticidade, prioridade) | Fatia Importação SAP (tabela `os`) e telas de detalhe |
| Aviso ao supervisor quando a APR bloqueia | Fatia Impedimento (alerta `bloqueio`, painel e e-mail) |
| OS com APR bloqueada continuam pendentes | Status `bloqueada`, que só volta a `liberada` por reprogramação |
| PDF após a execução, com data, hora e assinaturas | Fatia Execução |
| Validação de permissão de execução após a APR | Decisão-chave 4 |
| Sincronização automática e manual | Fatia Sincronização |
| Token temporário para login offline | Fatia Usuário e Equipe (7 dias) |

### Não coberto, ou em conflito

| # | Ponto do DesignDoc | Situação em relação à especificação |
|---|---|---|
| a | **"APR 1 - 1 OS"** | **Conflito.** A especificação (Decisão-chave 7) e as anotações da Reunião 1 dizem que uma APR cobre várias OS do mesmo local, modelo e dia. Pode ser anotação antiga ou mudança de decisão |
| b | **Correção: ler as OS do SAP por importação manual ou por requisição HTTP de uma API** | **Conflito parcial.** A especificação deixa a API do SAP fora do escopo, porque ela não existe (Reunião 1). A importação por planilha é a única entrada definida |
| c | **Painel pessoal do funcionário**: histórico de OS e registro de assinaturas a partir dele | Não previsto. O app mostra só as OS ativas da equipe e o painel web é para supervisor, analista e segurança |
| d | **Catálogo de serviço**, com os materiais que cada serviço usa | Não previsto. Hoje materiais e ferramentas vêm como texto da OS |
| e | **Atribuição automática de OS para as equipes** | Parcial. A importação já resolve a equipe pelo centro de trabalho; atribuição a uma pessoa e o "aceite" estão na questão 31 |
| f | **Escaneamento das OS e APR antigas** para o sistema | Não previsto. Não há migração de histórico em papel |
| g | **Monitoramento do tempo de intervalo das OS preventivas** | Não previsto. Hoje só há o indicador mensal de atraso. O SAP programa preventivas em frequências mensal, trimestral e semestral |
| h | **Assinatura digital de documentos** | Parcial. A especificação usa assinatura desenhada no celular; "digital" pode pedir mais (questão 38) |
| i | **Documentação comprobatória do obstáculo, em imagem ou PDF** | Parcial. A especificação exige foto; anexar PDF não está previsto |

## 12. Pendências

1. Levar as questões ao Iago e ao Mario (seção 7, prioridade).
2. Decisão do time sobre as questões 4, 6, 22–25 e 42–46.
3. Corrigir na especificação as contradições 22–25, depois da decisão.
4. Acrescentar as questões 22–46 ao [pontos-a-validar.md](../.design/pontos-a-validar.md).
5. Aplicar no [fluxo-solucao.md](../.design/fluxo-solucao.md) as cores e os ajustes da seção 6.
6. Atualizar o [apr-om-digital-resumo.md](../.design/apr-om-digital-resumo.md) com as correções da seção 5.
7. Decidir o corte do MVP (seção 4) e travar schema e contrato de sincronização nos dias 1–2.
8. **Testar o protótipo navegável com cliques** (checklist, sincronização, alertas e exportação) e abrir as telas ainda não conferidas, antes da apresentação.
9. Compartilhar o canvas e o relatório das telas antes da apresentação, ou usar só o protótipo navegável, que não precisa de compartilhamento.
10. Decidir se `src/` vira base do app e do painel reais ou fica só como material de apresentação. O stack planejado (seção 4) é React Native + Expo e React + Vite, então ele **não é reaproveitável como código**, só como referência de layout e fluxo.
11. **Commitar a reorganização do repositório** (seção 2): hoje as mudanças estão só na pasta de trabalho, e as notas removidas da raiz continuam apenas no histórico do git.
12. Corrigir nos documentos de `base/.design/` os caminhos antigos citados no texto (seção 2).
13. Decidir o que fazer com as ideias do `DesignDoc.md` (seção 11): entram no MVP, ficam para depois ou saem.
