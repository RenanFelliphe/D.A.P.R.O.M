# Validações — a página de decisões e assinaturas do supervisor (21/10/2026)

> A antiga página "Para validar" (só treinamentos de serviço) virou **Validações**: a fila de tudo o que espera a decisão ou a assinatura do supervisor. A página não decide nada por conta própria: reúne o que já existia e leva a cada item para a tela onde a decisão sempre foi tomada, com a janela de assinatura de sempre.
>
> **Situação:** feita em 21/10/2026 na `api` e na `web`. **O app `mobile` ainda não tem a página** (a `api` e o contrato em `shared` já estão prontos para ele). Nada foi visto num navegador.
>
> Fontes: a conversa de 21/10/2026; o código em [`validacoes.ts`](../../api/src/dominio/validacoes.ts), [`validacoes.ts`](../../shared/api/validacoes.ts) e [`page.tsx`](../../web/src/app/app/(portal)/validacoes/page.tsx); o resumo diário por e-mail ([`email-resumo.ts`](../../api/src/servicos/email-resumo.ts)), que já listava as mesmas pendências do supervisor.

## Resumo

- **Quem vê:** quem supervisiona uma equipe (titular ou representante no comando). O admin e o técnico sem equipe recebem `403`: eles têm as telas próprias de cada fila.
- **O que entra:** o que está nas mãos do supervisor e fica parado até ele agir. O que ele mesmo inicia (reprogramar, devolver ao SAP, reservar a OS) e o que é só informativo (alertas) ficam de fora.
- **Ordem:** os urgentes primeiro; dentro de cada grupo, os mais antigos. Filtro por tipo no topo (`?tipo=`).
- **Selo do menu:** passou a contar a fila inteira, não só os treinamentos.

## 1. O que vai para a fila

| Tipo | Quando entra | Ação | Urgente quando | Abre em |
|---|---|---|---|---|
| **OS para assinar** | OS da equipe em `aguardando_supervisor` | `assinar`; `aguardar_conferencia` se a conferência da execução ainda compara os aparelhos (a ciência espera, e a OS não sobe para o topo) | falta menos de 24 h para o fim das 72 h do encerramento (a ciência no prazo pontua), ou já passou | detalhe da OS |
| **Treinamentos** | treinamento de serviço em validação em que a equipe dele é validadora e ele ainda não decidiu | `decidir` | nunca | tela de validar do treinamento |
| **Materiais** | sugestão ou contestação de lista que ele pode avaliar (a equipe dele é a que mais faz o serviço) | `decidir` | nunca | a sugestão |
| **Conferências** | só o que **falta dele**: escolher o resultado que divergiu, fechar com o que existe (após 72 h), dar ciência ou assinar. A que só espera os outros não entra | `decidir`, `fechar`, `ciencia`, `assinar` | já pode fechar (passaram 72 h) | a conferência |
| **Ausências** | pedido de ausência da equipe, pedido de fim antecipado, ausência vencida sem retorno confirmado (o pedido do próprio supervisor não entra) | `pedida`, `fim_pedido`, `vencida` | pedida que já começou; fim pedido para hoje ou antes; vencida sempre | a equipe, âncora das ausências |

- **Conferência:** na maioria das conferências o supervisor não tem nada a fazer. Só entram as que dependem dele (resultado divergente, 72 h) e as em que ele é participante e falta a ciência ou a assinatura.
- **Ausência:** o supervisor ausente não age pela equipe, então a fila de ausências dele vem vazia.
- **Representante:** as equipes que ele representa já estão em `equipesSupervisionadas`, então os itens delas entram.

## 2. O que ficou de fora, e por quê

- **Reprogramar, devolver ao SAP e reservar a OS:** o supervisor inicia essas ações na própria OS; não há fila de espera.
- **Alertas informativos** (preventiva atrasada, execução esquecida): continuam no sino e em "Precisa de atenção". Não pedem decisão nem assinatura.
- **Ressalva de um participante numa conferência:** é aviso, não decisão; fica no sino.
- **Liberar cadastro, publicar treinamento direto, tratar perguntas da Vitória:** são do admin.
- **Assinar em lote:** a ciência e a conferência pedem leitura (o relatório da execução e as versões comparadas), então cada item abre na sua tela. A assinatura continua na janela de cada ação ([assinaturas.md](assinaturas.md)).
- **Aceitar ou recusar sugestão de material continua sem assinatura.** A página só reúne as filas; não muda quem assina o quê.

## 3. Mudanças no código

- **`shared/api/validacoes.ts`:** o contrato (`Validacoes`, `ItemDeValidacao`), os cinco tipos, os rótulos e a ordenação. A `web` e o app usam o mesmo.
- **`api`:** `GET /me/validacoes` ([`rotas/validacoes.ts`](../../api/src/rotas/validacoes.ts)), só `supervisor`. A função [`minhasValidacoes`](../../api/src/dominio/validacoes.ts) chama as fontes que já existiam (`treinamentosParaValidar`, `listarSugestoes`, `minhasConferencias`) e consulta a OS e a ausência com o mesmo recorte do resumo por e-mail. **Nenhuma migração.**
- **`web`:** a página `/app/validacoes` (filtro por tipo, cartões, a Vitória quando não há nada, atualização a cada 30 s); o item "Validações" do menu (no lugar de "Para validar") com o selo da fila inteira; `/app/treinamentos/validar` só redireciona para `/app/validacoes?tipo=treinamento` (os avisos e e-mails já enviados ainda trazem o endereço antigo); a linha "OS aguardando a assinatura do supervisor" de "Precisa de atenção" leva o supervisor a `/app/validacoes?tipo=os_ciencia`; o aviso `treinamento_para_validar` sem código aponta para a nova página.
- **Testes:** [`validacoes.test.ts`](../../api/test/validacoes.test.ts) (7 casos: o `403`, a fila vazia, a OS só da equipe dela, a sugestão, o pedido de ausência, a ausência vencida urgente e o total).

## 4. O que falta

- **O app `mobile`:** a mesma fila, ligada ao `GET /me/validacoes` (o perfil do app já mostra o selo "para avaliar" das sugestões).
- **A conferência visual** da página, que não foi aberta no navegador.
- **A conferência dentro da fila** ainda não tem teste automático: o caso exige montar execuções em dois aparelhos (o cenário está em [`conferencia-execucao.test.ts`](../../api/test/conferencia-execucao.test.ts)).
- **O admin** tem pendências parecidas (liberações, sugestões, treinamentos); a decisão foi fazer primeiro só a do supervisor.
