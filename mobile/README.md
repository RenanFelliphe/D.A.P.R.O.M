# mobile

Aplicativo de campo do SYNC OS (Android). Funciona online no dia a dia e tem um modo offline de contingência para aplicar a APR e executar a OS onde não há sinal.

> **Ainda não iniciado.** O foco atual é a interface do painel web em [`../web`](../web). Esta pasta reserva o lugar do app no monorepo (`api`, `web`, `mobile`). As telas do app existem hoje como referência visual no protótipo (`/app/*` em `web`).

Ver a [especificação](../base/.design/especificacao.md) para escopo, contratos e decisões técnicas.

**Gamificação (quando o app existir):** recebe só as páginas de consulta (Minha pontuação, Ranking e Conquistas), o aviso "Conquista desbloqueada" e "Nova patente", o "+N pontos" nas telas de APR e de execução (o `pontos_ganhos` de `POST /eventos`) e a opção de anonimato no perfil. Os cadastros de pontos, patentes e conquistas ficam só na web. A `api` já serve tudo (`/gamificacao/*`); ver [gameficacao.md](../gameficacao.md), seção 8.4. A conquista de sincronização offline precisa que o evento da fila diga que veio dela.
