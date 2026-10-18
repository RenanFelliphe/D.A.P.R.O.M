# mobile

Aplicativo de campo do SYNQ OS (Android). Funciona online no dia a dia e tem um modo offline de contingência para aplicar a APR e executar a OS onde não há sinal.

> **Ainda não iniciado.** O foco atual é a interface do painel web em [`../web`](../web). Esta pasta reserva o lugar do app no monorepo (`api`, `web`, `mobile`). As telas do app existem hoje como referência visual no protótipo (`/app/*` em `web`).

Ver a [especificação](../base/.design/especificacao.md) para escopo, contratos e decisões técnicas.

**Gamificação (quando o app existir):** recebe só as páginas de consulta (Minha pontuação, Ranking e Conquistas), o aviso "Conquista desbloqueada" e "Nova patente", o "+N pontos" nas telas de APR e de execução (o `pontos_ganhos` de `POST /eventos`) e a opção de anonimato no perfil. Os cadastros de pontos, patentes e conquistas ficam só na web. A `api` já serve tudo (`/gamificacao/*`); ver [gameficacao.md](../gameficacao.md), seção 8.4. A conquista de sincronização offline precisa que o evento da fila diga que veio dela.

**O que o app herda das correções da Reunião 3 (18/10/2026):** a `api` e a `web` já aplicam estas regras ([correcoes-da-reuniao-3.md](../funcionalidades/correcoes-da-reuniao-3.md)); o app só as cumpre do lado dele.

- **Assinatura da APR por participante.** Online, cada participante assina a APR na própria conta (`apr_assinada`), vê o aviso "APR aguardando a sua assinatura" e o direito de recusa (`apr_recusada`, com motivo). No offline, que é contingência, o responsável registra a APR com `assinatura_presencial: true` no aparelho dele e as assinaturas dos perfis são copiadas na hora, marcadas como presenciais.
- **Localização nos cinco momentos.** O app envia `latitude` e `longitude` (as duas, ou nenhuma) no início da execução, na pausa, na suspensão, na interrupção e no encerramento. Sem GPS (permissão negada ou local coberto), o serviço não é bloqueado: fica "sem localização". A tela avisa o técnico que a localização é registrada nesses momentos.
- **Encerramento em dois passos.** O clique em "Encerrar OS", depois de uma confirmação, grava o fim (`execucao_encerrada`) e o tempo para; o preenchimento (descrição e fotos opcionais, checklist) e a assinatura do responsável vêm depois (`encerramento_assinado`) e não entram no tempo.
- **Motivo obrigatório na pausa e na suspensão**, escolhido numa lista (com o complemento em "aguardando" e "outro"). Lesão e enfermidade avisam o supervisor na hora.
- **Sincronização em segundo plano** (item 18 da Reunião 3). Com o app aberto, a fila é enviada assim que o sinal volta. Com o app fechado, é enviada no próximo intervalo que o Android libera para tarefas em segundo plano, por volta de 15 minutos. O `execucao_iniciada` que depende de uma assinatura dada em outro aparelho fica pendente na fila, em vez de ser recusado, até a assinatura chegar.
