# SYNQ OS

**APR e Ordens de Manutenção sem papel.**

## 1. O que é

O SYNQ OS digitaliza o caminho das Ordens de Manutenção (OM, aqui chamadas de OS) e das Análises Preliminares de Risco (APR), da chegada da ordem à baixa no SAP. É um monorepo com três aplicações:

- **`api`** (Node e TypeScript): regras, banco, PDF, tarefas, e-mail e IA;
- **`web`** (Next.js): a área de campo e o painel de gestão, responsivo, também no navegador do celular;
- **`mobile`** (Expo, Android): as telas de campo, com o modo offline de contingência.

O sistema é **online primeiro**: técnico, supervisor e admin usam a web e o app, e o modo offline existe só para o campo sem sinal. O SAP e o registro de funcionários (RH) são **simulados** dentro da própria `api`, com dados fictícios, e mostram o fluxo final funcionando. Nada aqui usa dados reais da empresa.

O que falta e o que está em aberto está em [pendencias.md](pendencias.md).

## 2. Contexto

O SYNQ OS nasceu do Desafio 4 da maratona ("tornar a APR e a OM 100% digitais, da criação à execução") para a operação de manutenção de uma distribuidora de gás natural. O que as reuniões com os mentores (Iago Raich e Mario Stevan) mostraram:

- **O processo é em papel.** A OS sai do SAP impressa, é separada por equipe, preenchida à mão em campo com a APR grampeada e depois escaneada e anexada no SAP. Isso ocupa de 4 a 5 pessoas e devolve folhas sujas, incompletas ou ilegíveis, que dificultam a auditoria.
- **Volume:** cerca de 390 OS encerradas por mês (de pouco mais de 200 a 409); o levantamento citou ~900 ordens por mês somando programadas e corretivas.
- **Tipos de ordem:** corretivas (YBA1), abertas sob demanda, e preventivas (YBA2), programadas em ciclos (mensal, trimestral, semestral).
- **Criticidade:** roçagem e lavagem de estação têm baixo impacto; já os pontos de recebimento, as estações de redução (ERP e ERS) e os grandes clientes industriais são críticos, porque deixar de calibrar uma válvula pode parar a operação do cliente e gerar multa.
- **Ninguém trabalha sozinho:** o serviço é feito no mínimo em dupla, com um líder definido.
- **Nada impede**, no papel, começar um serviço sem a APR ou com uma resposta negativa num item crítico.

O objetivo é que cada OS tenha a sua APR, que a execução só comece com os requisitos de segurança aprovados e que tudo o que acontece em campo fique registrado e consultável. O sistema complementa o SAP: a geração e a gestão oficial das ordens continuam lá. A ideia de ler as OS do SAP e filtrar por equipe e status veio do [site de controle já existente](https://esgasplanomanutencao.lovable.app/controle), que não é tocado.

## 3. Caminho da OS

1. **Entrada.** A OS vem do SAP simulado (leitura agendada ou "Sincronizar agora"), da planilha exportada, do PDF da OS conferido campo a campo ou da digitalização de OS antigas, que entram encerradas, como histórico. Nenhuma OS é criada à mão; a única que nasce no sistema é a OS de apoio, aberta a partir de um impedimento. A equipe sai do centro de trabalho da ordem.
2. **APR.** O técnico escolhe o modelo (o sistema só recomenda), marca os riscos e responde o checklist inteiro, sem saber o que é eliminatório. O servidor valida. Bloqueada, a OS fica pendente e qualquer pessoa da equipe a retoma com uma APR nova. Aprovada, cada participante (no mínimo 2) assina na própria conta ou recusa.
3. **Execução.** Iniciar, pausar e suspender com motivo, interromper por risco, com localização nos momentos-chave. Todos os participantes acompanham e agem.
4. **Encerramento.** Em dois passos: "Encerrar OS" para o tempo; depois vêm a descrição, as fotos, o checklist de inspeção (na preventiva) e a assinatura de quem encerrou.
5. **Assinatura final.** O supervisor da equipe lê o relatório da execução e assina por último. Só então a OS está encerrada e sai o PDF (a APR e a folha da OS do SAP, como o papel).
6. **Baixa.** A planilha de baixa no SAP sai com as abas Encerradas, Sem ordem SAP, Impedimentos e Devolvidas.

O caminho completo, com as regras, está em [docs/operacao-de-campo.md](docs/operacao-de-campo.md), seção 1.

## 4. Mapa de funcionalidades

Situação: **pronta** = feita no código; "falta ver" = ainda não conferida na tela, no aparelho ou contra o serviço real (ver [pendencias.md](pendencias.md), seção 2).

| Área | O que faz | Situação | Onde está |
|---|---|---|---|
| Perfis e papéis | Só `tecnico` e `admin`; supervisor e representante são papéis derivados da equipe | pronta | [pessoas-e-equipes.md, seção 1](docs/pessoas-e-equipes.md) |
| Conta e acesso | Login pelo e-mail institucional, senha provisória, cadastro pelo supervisor com liberação pelo admin, pedido de conta na tela de entrada (só na web) | pronta | [pessoas-e-equipes.md, seção 2](docs/pessoas-e-equipes.md) |
| Campo de treino | Tutorial com dados fictícios para quem aguarda liberação | pronta | [pessoas-e-equipes.md, seção 2.5](docs/pessoas-e-equipes.md) |
| Assinatura | Desenhada no perfil, obrigatória depois da liberação, valida as ações importantes | pronta; validade jurídica depende de terceiros | [pessoas-e-equipes.md, seção 3](docs/pessoas-e-equipes.md) |
| Equipes e supervisor | Supervisor é quem a equipe aponta; gestão das equipes que supervisiona | pronta | [pessoas-e-equipes.md, seção 4](docs/pessoas-e-equipes.md) |
| Validações do supervisor | Uma página com tudo o que espera a decisão ou a assinatura dele: OS, treinamentos, materiais, conferências e ausências | pronta na web e no app (o app abre no navegador o que só a web decide) | [pessoas-e-equipes.md, seção 5](docs/pessoas-e-equipes.md) |
| Representante e ausência | O representante assume quando o supervisor se ausenta ou fica parado; o ausente só consulta | pronta | [pessoas-e-equipes.md, seções 6 e 7](docs/pessoas-e-equipes.md) |
| Avisos e e-mails | Sino, e-mail por categoria e resumo diário | pronta; o e-mail depende do SMTP | [pessoas-e-equipes.md, seção 8](docs/pessoas-e-equipes.md) |
| Notificação push | O aviso que pede ação no campo também toca no celular, com o app fechado | pronta; depende do Firebase/FCM na conta da Expo e de um APK novo | [pessoas-e-equipes.md, seção 8.6](docs/pessoas-e-equipes.md#86-notificação-push) |
| Botão de emergência | Na execução, avisa na hora o supervisor e os administradores (sino, push e e-mail) com nome e posição, e mostra os contatos do PAE e o SAMU e os Bombeiros para ligar | pronta; os contatos do PAE esperam a Segurança do Trabalho (o admin cadastra em Configurações) | [operacao-de-campo.md, seção 5.9](docs/operacao-de-campo.md) |
| Convite de participação na APR | O responsável convida cada participante, que aceita ou recusa em 15 min; o checklist só começa quando todos os convidados aceitam | pronta (web e app); prazo e bloqueio a confirmar | [operacao-de-campo.md, seção 4.9](docs/operacao-de-campo.md) |
| SAP simulado e entrada de OS | Leitura agendada, planilha, PDF da OS e tela do simulador | pronta | [integracoes-simuladas.md, seções 2 e 3](docs/integracoes-simuladas.md) |
| Saída para o SAP | Planilha de baixa e devolução da OS com erro | pronta | [integracoes-simuladas.md, seção 4](docs/integracoes-simuladas.md) |
| Registro de funcionários simulado | Só vira usuário quem está no registro; desligamento em tempo real | pronta | [integracoes-simuladas.md, seção 5](docs/integracoes-simuladas.md) |
| Modelos de APR | 8 modelos, versões imutáveis, critério de bloqueio por item, orientação para o técnico | pronta; critério provisório | [operacao-de-campo.md, seção 2](docs/operacao-de-campo.md) |
| Escolha do modelo | O técnico escolhe; o sistema recomenda por palavras-chave e, se ligada, pela IA | pronta; IA real falta testar | [operacao-de-campo.md, seção 3](docs/operacao-de-campo.md) |
| APR | Checklist inteiro, validação no servidor, evidência dos reprovados, assinaturas e recusa, previsão do tempo na pergunta de clima | pronta | [operacao-de-campo.md, seção 4](docs/operacao-de-campo.md) |
| Execução | Pausa, suspensão, interrupção por risco, cancelar por engano, localização, impedimento e OS de apoio | pronta | [operacao-de-campo.md, seção 5](docs/operacao-de-campo.md) |
| Execução compartilhada | Participantes acompanham e agem; o que foi feito sem sinal em aparelhos diferentes vira conferência | pronta; prazos a confirmar | [operacao-de-campo.md, seção 6](docs/operacao-de-campo.md) |
| Encerramento e relatório | Dois passos, assinatura final do supervisor, relatório da execução e PDF da OS | pronta | [operacao-de-campo.md, seções 7 e 8](docs/operacao-de-campo.md) |
| Preventivas | Ciclo de cada plano, alertas e checklist de inspeção; a preventiva vale o dobro nos pontos | pronta | [operacao-de-campo.md, seção 9](docs/operacao-de-campo.md) |
| Materiais | Lista recomendada por serviço, só para consulta, com sugestão e contestação | pronta; lista real depende da ES Gás | [operacao-de-campo.md, seção 10](docs/operacao-de-campo.md) |
| Atribuição e devolução | O supervisor reserva a OS a uma pessoa ou a devolve ao SAP | pronta | [operacao-de-campo.md, seção 11](docs/operacao-de-campo.md) |
| Quadro e dashboards | Quadro por estado; dashboards Meus resultados, OS, APR e Equipes, com "Precisa de atenção" no topo do de OS | pronta | [operacao-de-campo.md, seção 12](docs/operacao-de-campo.md) |
| Mapa de calor | Onde as OS foram executadas, por área, no dashboard de OS | pronta; falta ver | [operacao-de-campo.md, seção 12.5](docs/operacao-de-campo.md) |
| Previsão do tempo | Open-Meteo no quadro, na APR e no relatório; aviso no risco, foto no extremo | pronta; falta ver | [operacao-de-campo.md, seção 4.7](docs/operacao-de-campo.md) |
| Configurações | `/app/configuracoes`: preferências pessoais e, para o admin, cidade padrão, horários e limites da IA | pronta; falta ver | [operacao-de-campo.md, seção 13](docs/operacao-de-campo.md) |
| Vitória | Assistente em toda tela, na web e no app, com "Me leve lá" | pronta; bateria contra a IA real pendente | [ia-e-vitoria.md, seção 4](docs/ia-e-vitoria.md) |
| Controle da IA | O admin liga e desliga cada função; leitura de dados só com a assinatura dele | pronta | [ia-e-vitoria.md, seção 3](docs/ia-e-vitoria.md) |
| Digitalização de OS antigas | PDF em lote ou fotos; OCR no impresso, IA no manuscrito, conferência antes de registrar | pronta; IA real e câmera falta ver | [ia-e-vitoria.md, seção 6](docs/ia-e-vitoria.md) |
| Gamificação | Pontos, temporadas, ranking, patentes e conquistas; a segurança nunca custa pontos | pronta | [gamificacao-e-treinamentos.md, seções 1 a 7](docs/gamificacao-e-treinamentos.md) |
| Treinamentos de serviço | Minijogos narrados pela Vitória, rascunho pela IA, validação pelos supervisores | pronta (só na web) | [gamificacao-e-treinamentos.md, seções 8 e 9](docs/gamificacao-e-treinamentos.md) |
| App e modo offline | Cópia da equipe e fila em SQLite, entrada sem sinal por 7 dias, envio com o app fechado, APK pelo Dockerfile | pronta no código; falta ver num aparelho | [especificacao.md, seção 6](docs/especificacao.md) e [mobile/README.md](mobile/README.md) |

**De onde vieram:** as essenciais saíram do desafio e das reuniões; as prioridades do time foram o catálogo de serviço com os materiais, a digitalização de OS e APRs antigas, o ciclo das preventivas, a assinatura e a OS de apoio; as extras, o registro de funcionários, a gamificação e o chatbot (que virou a Vitória e os treinamentos). Surgiram no caminho a atribuição e a devolução, a ausência e o representante, os avisos por e-mail, a sugestão de materiais, a execução compartilhada, o pedido de conta, o controle da IA, a validação dos treinamentos, as validações do supervisor, o mapa de calor, a previsão do tempo e as configurações.

## 5. Arquitetura

| Componente | Tecnologia | Responsabilidade |
|---|---|---|
| `mobile` | React Native com Expo, SQLite, armazenamento seguro, câmera e localização | Telas de campo e modo offline de contingência |
| `web` | Next.js (React e TypeScript), React Hook Form e Zod | Campo no navegador, gestão, modelos, dashboards e simuladores |
| `api` | Node.js e TypeScript (Hono e Drizzle) | Regras, autorização, entrada e saída de OS, eventos e sincronização, PDF, e-mail, tarefas e IA |
| `shared` | TypeScript | Contratos da `api` usados pela `web` e pelo `mobile`, avisos, Vitória e funções de IA |
| Persistência | Supabase (Postgres, Auth e Storage) | Só a `api` fala com ele; nenhum cliente tem a chave |
| IA | Claude, ou o Gemini gratuito só na demonstração (`IA_PROVEDOR`) | Vitória, rascunho de treinamento, recomendação do modelo e digitalização |
| Implantação | Docker | `api` e `web` com Dockerfile e `docker-compose.yml`; o Dockerfile do `mobile` gera o APK assinado |

Todo registro de campo chega à `api` como um evento idempotente (`POST /eventos`), online ou pela fila do app. O detalhe (decisões-chave, modelo de dados, estados, eventos, contratos, tarefas e segurança) está em [docs/especificacao.md](docs/especificacao.md).

## 6. Como executar

Os detalhes de cada pacote estão em [api/README.md](api/README.md), [web/README.md](web/README.md) e [mobile/README.md](mobile/README.md).

### 6.1 Local, sem Supabase

A `api` tem um modo local: banco (PGlite), autenticação e arquivos em memória, SAP e registro de funcionários simulados. Recomeça igual a cada subida.

```bash
cd api && pnpm install && pnpm dev:local    # http://localhost:3333
                                            # pnpm dev:local:demo sobe com a demonstração inteira
cd web && pnpm install && pnpm dev          # http://localhost:3000, abre na tela de entrada
```

### 6.2 Contas de exemplo

No modo local, todas as contas usam a senha `synqos123`:

| E-mail | Papel |
|---|---|
| `admin@empresa.com.br` | admin |
| `sandra.supervisora@empresa.com.br` | técnica que supervisiona a equipe Serviços Especiais |
| `saulo.supervisor@empresa.com.br` | técnico que supervisiona a equipe Instrumentação |
| `tiago.tecnico@empresa.com.br`, `tais.tecnica@empresa.com.br` | técnicos de Serviços Especiais |
| `tomas.tecnico@empresa.com.br` | técnico de Instrumentação |

Com `pnpm dev:local:demo`, o terminal lista também as contas da demonstração.

### 6.3 Com o Supabase de desenvolvimento

Copie `.env.example` para `.env` (ou `.env.local`), preencha as variáveis obrigatórias da `api` e rode `pnpm dev` na `api` e na `web`.

> **Atenção:** o banco de desenvolvimento é um projeto Supabase **real e compartilhado**. O `pnpm dev` da `api` roda em watch e **aplica as migrações nele na hora**. Nunca edite uma migração já gerada: gere sempre uma nova.

### 6.4 Com Docker (`api` e `web`)

```bash
cp .env.example .env
docker compose up --build   # api em http://localhost:3333 (GET /saude), web em http://localhost:3000
```

A `api` aplica as migrações e carrega os modelos de APR antes de abrir a porta. Os simuladores do SAP e do registro de funcionários já vêm ligados; as telas deles ficam em `/simulador`, só para o admin.

### 6.5 App e APK

O app aponta para a `api` por `EXPO_PUBLIC_API_URL` e roda pelo *development build* (`pnpm android`, não no Expo Go). O APK assinado sai do `mobile/Dockerfile` (`pnpm apk`). Ver [mobile/README.md](mobile/README.md).

## 7. Hospedagem

| Ambiente | Situação |
|---|---|
| Coolify, hospedado pelo mentor da maratona | **oficial** até o fim da maratona; `api` e `web` sobem pelos Dockerfiles |
| Render (https://d-a-p-r-o-m.onrender.com) | hospedagem anterior; continua de pé e pode voltar a ser usada |

O app não é publicado: o APK é gerado e instalado nos aparelhos.

## 8. Documentação

| Documento | O que tem |
|---|---|
| [docs/especificacao.md](docs/especificacao.md) | Como o sistema é construído: arquitetura, decisões-chave, modelo de dados, estados, eventos e sincronização, contratos, tarefas, segurança e rotas |
| [docs/operacao-de-campo.md](docs/operacao-de-campo.md) | Modelos e escolha do modelo, APR, execução (inclusive a compartilhada), encerramento, relatório e PDF, preventivas, materiais, atribuição e devolução, painel, dashboards e configurações |
| [docs/pessoas-e-equipes.md](docs/pessoas-e-equipes.md) | Perfis e papéis, contas, Campo de treino, assinatura, equipes, validações do supervisor, representante, ausência, avisos e e-mails |
| [docs/integracoes-simuladas.md](docs/integracoes-simuladas.md) | SAP simulado, entrada e saída de OS, registro de funcionários simulado |
| [docs/ia-e-vitoria.md](docs/ia-e-vitoria.md) | Funções de IA, provedores, controle por função, Vitória, recomendação do modelo e digitalização |
| [docs/gamificacao-e-treinamentos.md](docs/gamificacao-e-treinamentos.md) | Pontos, patentes, temporadas, ranking, conquistas, treinamentos de serviço e rascunho pela IA |
| [pendencias.md](pendencias.md) | O que falta antes da apresentação, funcionalidades novas, terceiros, decisões a confirmar, perguntas em aberto e o que está fora do MVP |
| [api/README.md](api/README.md), [web/README.md](web/README.md), [mobile/README.md](mobile/README.md) | Como rodar e testar cada pacote |
| [vitoria/README.md](vitoria/README.md) | As imagens da Vitória e como são geradas |
| [docs/reunioes/](docs/reunioes/) | Transcrições das reuniões [1](docs/reunioes/Transcricao_Reuniao1.md), [2](docs/reunioes/Transcricao_Reuniao2.md) e [3](docs/reunioes/Transcricao_Reuniao3.md) com os mentores |
| [docs/demonstracao/treinamentos-ficticios.md](docs/demonstracao/treinamentos-ficticios.md) | Os treinamentos de serviço fictícios da demonstração |

Referências de processo e formato: as planilhas dos modelos de APR em [base/apr-examples/](base/apr-examples/) e os exemplos de OS em [base/os-examples/](base/os-examples/). Os modelos oficiais são definidos pela Segurança do Trabalho e cadastrados pelo admin.
