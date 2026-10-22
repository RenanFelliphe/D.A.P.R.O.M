# Configurações — implementação de 21/10/2026

> Uma página `/app/configuracoes` reúne o que a pessoa ajusta em si (assinatura, e-mails, senha, anonimato no ranking) e, só para o admin, o que ajusta no sistema: a cidade padrão da previsão do tempo, os horários das rotinas, o controle da IA e os limites de uso da IA. O que antes ficava espalhado pelo Perfil, pela página da Vitória e em variáveis de ambiente passou para cá.
>
> **Situação:** implementado na `api`, na `web` e no app em 21/10/2026 (migração `0045_previsao_do_tempo_e_configuracoes`, tabela `configuracao`). Falta a conferência visual.

## 1. Decisões

| # | Pergunta | Decisão |
|---|---|---|
| 1 | O que muda de lugar | Do Perfil para as Configurações: a assinatura, as preferências de e-mail, a troca de senha e o anonimato no ranking (todos os perfis). Da página da Vitória: o Controle da IA (admin). O Perfil fica com os dados, as ausências, as conferências e o histórico. |
| 2 | Abas | **Minha conta** (todos) e **Sistema** (só admin). O técnico e o supervisor nem veem a aba Sistema, e a `api` recusa (`403`). |
| 3 | O que o admin edita | A cidade padrão da previsão do tempo; os horários da leitura do SAP (intervalo), da leitura do registro de funcionários e do resumo diário por e-mail; os limites de uso da Vitória e do rascunho de treinamento por IA. |
| 4 | O que não entra | Endereços, chaves e tokens (SAP, RH, SMTP, IA, provedor do tempo): são segredos e ligações com outros sistemas e ficam no ambiente, fora do alcance de uma tela. |
| 5 | O ambiente passa a ser o valor inicial | Cada valor tem um **padrão** (o que o ambiente diz, ou o valor de fábrica) e, quando o admin muda, uma linha em `configuracao` por cima. "Voltar ao padrão" apaga a linha. |
| 6 | Vale na hora | A `api` escreve o valor no próprio `config` (`aplicarConfiguracoes`); o agendador e as rotas o leem a cada uso, sem reiniciar. Na subida ela aplica o que está no banco antes de criar o módulo de IA. Exceção: o tamanho máximo da resposta da Vitória só vale na próxima subida (é lido ao criar o provedor). |
| 7 | Limites | Cada valor tem faixa permitida (por exemplo, o intervalo do SAP vai de 5 a 1440 minutos, as horas de 0 a 23); fora dela, `422` com a faixa na mensagem. Um valor guardado que ficou fora da faixa é ignorado. |
| 8 | Auditoria | Cada mudança e cada "voltar ao padrão" vão à trilha (`configuracao.alterar` e `configuracao.restaurar`), com o valor antes e depois. |
| 9 | Cidade padrão | Escolhida numa busca (`GET /clima/cidades`), não digitando coordenadas. Padrão inicial: Vitória, ES. Só vale para quem está sem GPS (ver [previsao-do-tempo.md](previsao-do-tempo.md)). |
| 10 | App | O app ganha uma tela Configurações aberta pelo Perfil, com as preferências pessoais. A cidade padrão e o controle da IA ficam só na web, porque o admin não usa o app. |

## 2. A `api`

- `GET /configuracoes/sistema` (admin): `cidade_padrao` (valor, padrão, se foi alterada) e `itens` (cada valor com rótulo, descrição, unidade, faixa, valor, padrão e `personalizado`).
- `PUT /configuracoes/sistema/{chave}` com `{ valor }` e `DELETE /configuracoes/sistema/{chave}` (admin): devolvem o painel atualizado.
- As chaves estão em `CONFIGURACOES_CHAVES` (`api/src/db/schema/clima.ts`) e as definições em `api/src/dominio/configuracoes.ts`.

## 3. Conferência pendente

- Ver as telas na web e no app.
- Decidir se outros limites (como os pontos da gamificação, hoje já editáveis em outra tela) devem ter um atalho aqui.
