# Fluxo da solução — APR e OS digitais

> Diagramas de [apr-om-digital.md](apr-om-digital.md). Representam a especificação completa, inclusive itens que podem ficar fora do MVP (editor de modelos, OS de apoio, e-mail, alertas de conflito). Questões ainda não decididas estão em [pontos-a-validar.md](pontos-a-validar.md).

O fluxo está dividido em cinco diagramas para não cruzar setas pelo desenho inteiro:

1. [Visão geral](#1-visão-geral) — o caminho de uma OS do SAP até a baixa.
2. [Campo](#2-campo-app-android-offline) — o que o técnico faz no app, sem sinal.
3. [Sincronização e servidor](#3-sincronização-e-servidor) — como a fila chega ao banco e o que o servidor dispara.
4. [Gestão web](#4-gestão-web) — cadastros, importação, impedimentos e exportação.
5. [Ciclo de status da OS](#5-ciclo-de-status-da-os).

## 1. Visão geral

```mermaid
flowchart LR
  SAP1[SAP<br/>gera e libera OS] -->|planilha xlsx| WEB1[Web<br/>importa OS]
  WEB1 --> DB[(Supabase<br/>Postgres + Storage)]
  DB -->|sincronizar: pull| APP[App Android<br/>APR e execução offline]
  APP -->|sincronizar: push| DB
  DB --> WEB2[Web<br/>painel, alertas, reprogramação]
  WEB2 --> DB
  DB --> WEB3[Web<br/>exporta OS encerradas + PDF]
  WEB3 -->|planilha xlsx| SAP2[SAP<br/>baixa manual pelo Iago]
```

## 2. Campo (app Android, offline)

Toda ação de campo vira um evento na fila local. Nada depende de sinal até o próximo "Sincronizar".

```mermaid
flowchart TD
  L[Login<br/>1º acesso online, depois até 7 dias offline] --> SY[[Sincronizar<br/>ver diagrama 3]]
  SY --> LST[Lista de OS da equipe]
  LST --> SEL[Escolher OS do mesmo local,<br/>mesmo modelo e mesmo dia]
  SEL --> PAR[Definir encarregado<br/>e ao menos um executor]
  PAR --> ITEM[Responder o próximo item<br/>do checklist]
  ITEM --> D{Resposta bloqueante?}
  D -->|sim, item eliminatório| BLQ[APR bloqueada<br/>observação + foto obrigatórias]
  D -->|sim, item alerta| AV[Marca aviso amarelo<br/>e segue]
  D -->|não| MAIS{Restam itens?}
  AV --> MAIS
  MAIS -->|sim| ITEM
  MAIS -->|não| APV[APR aprovada<br/>assinatura dos participantes]

  APV --> ESC[Escolher uma OS<br/>coberta pela APR]
  ESC --> INI[Iniciar execução]
  INI --> R{Risco durante<br/>a execução?}
  R -->|sim| INT[Interromper<br/>motivo + foto]
  R -->|não| ENC[Encerrar<br/>descrição, fotos e assinatura]
  ENC --> PROX{Outra OS coberta<br/>ainda pendente?}
  PROX -->|sim| ESC
  PROX -->|não| FIM([Fim do dia:<br/>sincronizar quando houver sinal])

  BLQ -.->|apr_concluida bloqueada<br/>todas as OS cobertas| FILA[(Fila de eventos<br/>SQLite)]
  APV -.->|apr_concluida aprovada| FILA
  INI -.->|execucao_iniciada| FILA
  INT -.->|execucao_interrompida| FILA
  ENC -.->|execucao_encerrada| FILA
```

Setas tracejadas: evento gravado na fila local. Fotos e assinaturas ficam salvas no aparelho até subirem ao Storage.

## 3. Sincronização e servidor

Uma única ação: primeiro sobem os arquivos, depois os eventos, e por último o app baixa as mudanças.

```mermaid
sequenceDiagram
  participant A as App (fila SQLite)
  participant ST as Storage
  participant S as Sync (Edge Function)
  participant DB as Postgres
  participant W as Painel web / e-mail

  alt sem sinal
    A-->>A: nada sai; fila intacta — "N registros pendentes"
  end
  A->>ST: envia fotos e assinaturas pendentes
  A->>S: push {eventos} em ordem de ocorrido_em
  loop cada evento
    alt id já recebido
      S-->>A: confirmado (sem efeito)
    else evento novo
      S->>DB: grava APR, apr_os, execução, evidências
      S->>DB: recalcula os.status
      opt APR bloqueada ou execução interrompida
        S->>DB: alerta "bloqueio"
        S->>W: alerta no painel + e-mail ao supervisor
      end
      opt execução encerrada
        S->>ST: gera o PDF da OS
      end
      opt OS de apoio encerrada
        S->>W: alerta "apoio_encerrado" ao supervisor da OS original
      end
      opt OS mudou na web enquanto estava offline / outra execução já existe
        S->>W: alerta "conflito_planejamento" ou "execucao_duplicada"
      end
      S-->>A: confirmado
    end
  end
  A->>S: pull {cursor}
  S-->>A: OS, locais, modelos e usuários da equipe alterados desde o cursor
```

Um evento cujo arquivo ainda não subiu fica pendente na fila. Reenviar um evento já confirmado não tem efeito.

## 4. Gestão web

```mermaid
flowchart TD
  subgraph CAD["Cadastros (admin)"]
    C1[Equipes, com centro de trabalho<br/>e supervisor] --> C2[Usuários e perfis]
  end

  subgraph MOD["Modelos de APR (segurança)"]
    M0[(Carga inicial no backend:<br/>8 modelos como versão 1)]
    M1[Editar modelo publicado] --> M2[Rascunho da versão seguinte]
    M2 --> M3[Publicar<br/>exige 1 item eliminatório]
  end

  subgraph IMP["Entrada de OS (analista / supervisor)"]
    I1[Importar planilha do SAP<br/>equipe resolvida pelo centro de trabalho]
    I2[Cadastrar local fora do SAP] --> I3[Criar OS manual]
  end

  subgraph IMPED["Impedimento (supervisor; analistas se a equipe não tiver supervisor)"]
    P1[Alerta de bloqueio<br/>painel + e-mail] --> P2{Precisa de outra<br/>equipe antes?}
    P2 -->|sim| P3[Criar OS de apoio<br/>ligada à original]
    P3 --> P4[OS de apoio executada<br/>em campo]
    P4 --> P5[Alerta apoio_encerrado]
    P5 --> P6
    P2 -->|não| P6[Reprogramar<br/>nova data/equipe + justificativa]
    P6 --> P7[OS volta a liberada<br/>exige APR nova]
  end

  subgraph PAINEL["Painel (supervisor vê a equipe; analista vê tudo)"]
    D1[Quadro por status e filtros]
    D2[Detalhe da OS: APR, execuções,<br/>fotos, PDF, alertas]
    D3[Exportar OS encerradas<br/>ainda não exportadas]
  end

  C1 -->|equipes precisam existir antes| I1
  I1 --> D1
  I3 --> D1
  D1 --> D2
  D1 --> D3
  D3 -->|planilha xlsx| SAPB[Iago dá baixa no SAP]
```

## 5. Ciclo de status da OS

O `status` é derivado no servidor; nenhum cliente o grava diretamente.

```mermaid
stateDiagram-v2
  [*] --> liberada: importação ou OS manual
  liberada --> em_execucao: execução iniciada
  liberada --> bloqueada: APR bloqueada (todas as OS cobertas)
  em_execucao --> encerrada: execução encerrada
  em_execucao --> bloqueada: execução interrompida
  bloqueada --> liberada: reprogramada (exige APR nova)
  encerrada --> [*]
```
