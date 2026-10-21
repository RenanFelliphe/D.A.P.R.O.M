# Controle da IA — implementação de 20/10/2026

> O administrador liga e desliga cada função de IA da Vitória na página dela e, quando uma função precisa ler dado real da operação, autoriza essa leitura **assinando**. São quatro funções, em dois grupos: **Sem dados** (Chatbot e Criação de jogos) e **Com dados** (Recomendação de modelo de APR e Digitalização de documentos).
>
> **Situação:** implementado na `api`, na `web` e no app em 20/10/2026 (migração `0043_controle_da_ia`). A conferência visual da tela ainda não foi feita; a recomendação por IA e as duas leituras de dados não foram testadas contra a IA de verdade.

## 1. Decisões

| # | Pergunta | Decisão |
|---|---|---|
| 1 | Nomes lógicos das funções | `chatbot` (era `vitoria`), `minigames` (era `rascunho`), `recomendacao` (nova) e `digitalizacao`. São o mesmo nome do uso no módulo de IA e da função que o admin liga. Os modelos têm `*_MODELO_CHATBOT`, `*_MODELO_MINIGAMES`, `*_MODELO_RECOMENDACAO` e `*_MODELO_DIGITALIZACAO`; os nomes antigos (`*_MODELO_VITORIA`, `*_MODELO_RASCUNHO`) ainda valem. |
| 2 | O que é "sem dados" | Sem dado **importante** da operação (OS, APR, pessoas). Saber como se executa um procedimento técnico não é sigiloso: o texto do procedimento e o manual não contam como dado. |
| 3 | Quem vê e quem muda | Só o admin. Para os outros perfis a seção nem é consultada. O perfil da Vitória continua contando a todos se o chatbot lê dados (`lendo_dados` em `GET /vitoria/sobre`). |
| 4 | Padrão ao instalar | Chatbot e Criação de jogos **ligados, sem ler dados**; Recomendação e Digitalização **desligadas** até o admin assinar. Sem linha no banco vale esse padrão. |
| 5 | Ligar uma função "Com dados" | É autorizar a leitura: abre a janela de assinatura e só liga com ela. Desligar não pede nada e revoga a autorização; ligar de novo pede nova assinatura. |
| 6 | Ligar a leitura de dados nas funções "Sem dados" | Uma segunda chave, só com a função ligada, também com assinatura. Desligar a função desliga a leitura junto; "Desligar a leitura de dados" volta ao "sem dados" sem desligar a função. |
| 7 | Texto assinado | O que cada função lê está em `shared/ia/funcoes.ts` (campo `le`) e tem `versaoDoTexto`. A `api` grava a versão assinada; se o texto mudar (a versão subir), a função com dados **para** até assinar de novo, e a tela avisa. |
| 8 | Quem decide | O módulo de IA (`ProvedorIAControlado`): antes de cada chamada confere a função no banco e, desligada, recusa com o motivo `desligada`, sem falar com o fornecedor. Nenhuma tela, tarefa ou script contorna o interruptor. |
| 9 | Sem chave do fornecedor | Nada chama a IA, mesmo ligado. O admin ainda escolhe o que fica ligado; a tela avisa que falta a chave. |
| 10 | Auditoria | Cada mudança vai à trilha (`ia_funcao.ligar`, `desligar`, `autorizar_dados`, `revogar_dados`), com quem fez e o estado antes e depois. |

## 2. A tela

Na página da Vitória (`/app/perfil/vitoria`), antes do "Sobre", só para o admin: **Controle da IA**.

- Um seletor com as quatro funções em dois grupos, cada função com uma bolinha (cinza = desligada, verde = ligada, âmbar = lendo dados).
- Ao escolher uma função: o que ela é, um interruptor de ligar e desligar, o que a IA recebe e o que acontece com a função desligada.
- **Sem dados:** o bloco "Leitura de dados reais" explica o que melhora e liga ou desliga a leitura. Ligada, mostra quem autorizou e quando.
- **Com dados:** o bloco "O que ela lê" lista os dados; ligar abre a janela de assinatura com essa lista, o fornecedor para onde os dados vão e a confirmação com a assinatura do perfil (`JanelaDeAssinatura`).
- Se o texto mudou depois da assinatura, um aviso pede para ligar de novo.

## 3. O que cada função recebe e lê

| Função | Sem dados reais, recebe | Com dados, lê também |
|---|---|---|
| **Chatbot** | a pergunta, as últimas mensagens, a tela e o manual do perfil | as até 10 OS em aberto do escopo de quem pergunta (número, título, serviço, local, situação, data prevista, "atrasada"), quantas APRs esperam assinatura e quantas esperam a de quem pergunta, e os pontos da temporada e a patente (só do técnico). Nunca nome de colega, dado de outra equipe, texto livre ou id. |
| **Criação de jogos** | o texto do procedimento e os materiais do serviço no catálogo | um resumo agregado das OS do serviço (no máximo 8 linhas por lista): motivos de pausa e de suspensão das execuções, itens de APR marcados com problema (o texto do item do modelo, nunca a observação de alguém) e materiais que as pessoas pediram para acrescentar e o supervisor aceitou. Serve para escolher onde insistir; o conteúdo continua saindo só do procedimento. |
| **Recomendação de modelo de APR** | (nada: só funciona com dados) | o título, a descrição e o serviço do catálogo de cada OS, e a descrição e os exemplos de cada modelo |
| **Digitalização de documentos** | (nada: só funciona com dados) | as imagens das folhas (nomes, matrículas, assinaturas, escrito à mão) e os modelos de APR |

Desligada, cada função tem o seu caminho sem IA: o chatbot responde pelas sugestões fixas e pela busca no manual; o botão de gerar rascunho some e o treinamento é montado à mão; a recomendação sai das palavras-chave; a digitalização lê só pelo OCR local, e o manuscrito é digitado na conferência.

## 4. Recomendação de modelo de APR guardada

- Cada OS aberta (`liberada`, `pendente`, `em_execucao`) tem uma linha em `os_recomendacao_apr`, calculada **quando a OS passa a existir**, seja qual for a entrada (SAP, planilha, PDF, apoio, digitalização). Uma varredura a cada minuto (`analisarRecomendacoesDeApr`) cobre todas as entradas, em vez de ligar a análise em cada ponto de inserção.
- **Primeiro as palavras-chave**, na hora e sem custo. **Depois a IA**, se a função estiver ligada: ela responde `{codigo, motivo}`, o código é conferido contra a lista de modelos e pode ser `null` ("nenhum combina"). Se a IA estiver fora, a OS fica com as palavras-chave.
- **Quando a análise vale:** a chave é um hash do texto da OS e da versão, descrição, exemplos e palavras-chave dos modelos. Se qualquer um mudar, a análise é refeita.
- **O técnico nunca espera a IA:** a tela e o snapshot do app leem a linha guardada; sem linha ou com chave velha, calculam na hora por palavras-chave. O app recebe a recomendação da IA sem sinal, porque ela já vem pronta na cópia da equipe.
- **Falha da IA:** recuo de 1, 5, 15, 60 e 240 minutos e, na sexta falha, desiste até o texto da OS ou os modelos mudarem. Cota esgotada e chave recusada pausam por 60 minutos sem gastar tentativa; limite por minuto espera o que o fornecedor pedir; função desligada só interrompe o lote.
- Lote de 20 OS por varredura, 3 chamadas ao mesmo tempo.
- **Contrato:** `GET /os/{id}/modelos-apr` e `escolha_do_modelo` do snapshot ganham `fonte` (`ia` ou `palavras`) e `motivo` (só com `ia`). A janela de escolha do modelo, na web e no app, mostra o motivo da Vitória no modelo recomendado. A recomendação continua só orientando: o técnico escolhe.
- **Custo (estimativa):** cerca de R$ 0,001 por OS no Haiku 5.5, de R$ 0,40 a R$ 0,90 por mês no volume de 390 a 900 OS.

## 5. Rotas

| Rota | Quem | O que faz |
|---|---|---|
| `GET /vitoria/ia` | admin | `{chave_configurada, provedor, funcoes: [{funcao, ligada, com_dados, texto_desatualizado, autorizado_por, autorizado_em, modelo}]}` |
| `PUT /vitoria/ia/{funcao}` `{ligada, com_dados?, versao_do_texto?}` | admin | o estado desejado. Passar a ler dados exige `versao_do_texto` igual à vigente (`409 texto_mudou` se mudou) e usa a assinatura do perfil. Devolve o painel. |
| `GET /vitoria/sobre` | todos | ganha `modelos` por função e `lendo_dados` por função |
| `GET /vitoria/diagnostico` | admin | ganha o estado `desligada` |

## 6. Banco e código

- **Migração `0043_controle_da_ia`:** `ia_funcao` (uma linha por função mexida: `ligada`, `com_dados`, versão do texto, quem autorizou, quando e a cópia da assinatura) e `os_recomendacao_apr` (código, fonte, motivo, o que cada modelo achou, chave, tentativas e próxima tentativa da IA); a entidade `ia_funcao` entra na auditoria.
- `shared/ia/funcoes.ts`: as quatro funções, os grupos, os textos e as versões; `api/src/dominio/ia-funcoes.ts`: estado, regras e alteração; `api/src/servicos/ia/provedor-controlado.ts`; `api/src/dominio/recomendacao-apr-guardada.ts`; `vitoria-dados.ts` e `treinamento-servico-dados.ts`.
- `web`: `components/vitoria/ControleDaIa.tsx`, `components/ui/Interruptor.tsx`, `lib/vitoria-ia.ts`, a janela de modelos (web e app) e o `PerfilDaVitoria.tsx`.
- **Testes:** `api/test/ia-funcoes.test.ts` (8), `recomendacao-apr-guardada.test.ts` (10), `vitoria-dados.test.ts` (11) e `treinamento-servico-dados.test.ts` (8). Os testes que usam a digitalização ligam a função com `amb.ligarIa`.

## 7. Pontos para discutir

- **A digitalização e a demonstração:** a Digitalização e a Recomendação vêm desligadas. Antes da apresentação alguém precisa assinar (ou ligar pelo `ligarIa` em um script de demonstração, mas aí a assinatura não seria de uma pessoa real).
- **Dados de material:** o sistema não registra consumo de material por OS; por isso "Criação de jogos" lê os materiais que foram sugeridos e aceitos, não os usados.
- **Aprovação do envio de dados no piloto:** a autorização assinada pelo admin é o registro de que a empresa aceitou enviar esses dados ao fornecedor. Falta combinar com a empresa se uma assinatura do admin basta ou se ela quer aprovar fora do sistema.
- **O que a Vitória ainda não lê:** nada além das listas da seção 3.
