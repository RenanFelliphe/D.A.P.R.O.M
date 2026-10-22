# web

Versão web do SYNQ OS, em **Next.js 16 (App Router) + React 19 + TypeScript**, com os formulários em React Hook Form e Zod e o mapa de calor em Leaflet sobre o OpenStreetMap. É responsiva, do desktop ao navegador do celular (pontos de quebra em 1279, 1023, 767 e 479 px, em [`responsivo.css`](src/styles/responsivo.css)). Serve todos os perfis: o técnico usa a área de campo; o supervisor (o técnico que a equipe aponta) tem também a gestão das suas equipes; o admin só gerencia. Os dados vêm da [`api`](../api/README.md); a `web` nunca fala com o Supabase. O app Android é o [`mobile`](../mobile/README.md).

Regras de negócio: os documentos de [`docs/`](../docs); como o sistema é construído: [docs/especificacao.md](../docs/especificacao.md).

## Executar

A `api` precisa estar no ar. Sem Supabase, use o modo local dela:

```bash
cd api && pnpm install && pnpm dev:local     # http://localhost:3333
cd web && pnpm install && pnpm dev           # http://localhost:3000, abre na tela de entrada
pnpm build                                   # build de produção
pnpm lint
```

O login é pelo e-mail institucional; as contas de exemplo do modo local estão no [README da raiz](../README.md). Os dados do modo local somem quando a `api` reinicia.

| Variável | O que faz |
|---|---|
| `API_URL` | endereço da `api`, só no servidor da `web` (padrão `http://localhost:3333`) |
| `COOKIE_SEGURO` | `true`/`false` força o cookie `Secure`; sem ela, acompanha o protocolo da requisição (HTTPS direto ou `x-forwarded-proto` do proxy). Aberta pelo IP da rede em HTTP (um celular na demonstração), a `web` funciona, mas câmera ao vivo e GPS o navegador só libera em HTTPS |
| `NEXT_DIST_DIR` | pasta do build (padrão `.next`, em [`next.config.ts`](next.config.ts)); permite rodar várias instâncias do `next dev` ao mesmo tempo, cada uma com a sua pasta |

O `next.config.ts` aponta a raiz do Turbopack para a raiz do repositório, porque a `web` importa o `shared/`. Com Docker, ver o [`docker-compose.yml`](../docker-compose.yml) da raiz.

## Scripts de conferência

Rodam sem navegador, a partir da pasta `api` (que tem o `tsx`):

| Script | O que confere | Como rodar |
|---|---|---|
| [`testar-troca-de-modelo.mts`](scripts/testar-troca-de-modelo.mts) | a troca do modelo no meio da APR com os 8 modelos reais da carga: respostas iguais continuam, as outras ficam em branco, o "NA" só passa para onde é aceito, os riscos de mesmo nome continuam marcados | `cd api && node --import tsx ../web/scripts/testar-troca-de-modelo.mts` |
| [`testar-conferencia.mts`](scripts/testar-conferencia.mts) | as regras puras da tela da conferência da execução (`web/src/lib/conferencia.ts`): o que mostrar e habilitar por estado e por pessoa | `cd api && node --import tsx --test ../web/scripts/testar-conferencia.mts` |
| [`verificar-treino.mts`](scripts/verificar-treino.mts) | o Campo de treino pela API fictícia: APR aprovada, execução e encerramento com foto e PDF, a OS do bloqueio e o catálogo | `cd api && node --import tsx ../web/scripts/verificar-treino.mts` |
| [`testar-fluxo-apr.mts`](scripts/testar-fluxo-apr.mts) | o fluxo do técnico até a APR contra a `api` local: injeta OS no SAP simulado, valida (`POST /aprs/avaliar`), envia `apr_concluida` e confere resultado, status e alerta. Deixa OS "[teste apr web]" na `api`: só no modo local | `cd api && node --import tsx ../web/scripts/testar-fluxo-apr.mts` |
| [`sessao.mjs`](scripts/sessao.mjs) | não confere: faz login na `api` local e imprime os cookies da sessão (ou o token, com `--token`), para chamar com `curl` | `node scripts/sessao.mjs <e-mail> [--token]` |
| [`gerar-vitoria.mjs`](scripts/gerar-vitoria.mjs) | não confere: gera as imagens da Vitória em `public/vitoria/` a partir dos originais (fora do git); ver [vitoria/README.md](../vitoria/README.md) | `node scripts/gerar-vitoria.mjs` |

## Como a `web` fala com a `api`

- **Sessão:** o login (`/app/entrar`) chama `POST /auth/login` por uma ação do servidor e guarda os tokens em cookies `httpOnly` (`synqos_at`, `synqos_rt`): o JavaScript do navegador nunca vê o token. O [`proxy.ts`](src/proxy.ts) manda quem não tem sessão para a entrada e renova o token perto de vencer. Senha provisória leva a "Defina sua senha"; liberado sem assinatura, a `/app/assinatura`, antes de qualquer outra tela.
- **Componentes de servidor** leem com `api()` de [`src/lib/api.ts`](src/lib/api.ts). **Componentes de cliente** usam [`src/lib/cliente-api.ts`](src/lib/cliente-api.ts) (`chamar`, `enviarArquivo` com fotos comprimidas a ~1600 px, `enviarEvento` para APR e execução), que passa pela ponte [`src/app/api/[...caminho]`](src/app/api/%5B...caminho%5D/route.ts): ela junta o token do cookie e repassa à `api`, que autoriza.
- **Rascunho da APR:** no `localStorage` do navegador, por OS, até a APR ser concluída.
- **Sem modo offline:** a fila local e o selo de conexão são do app; a `web` só se usa com internet.
- **Conta pendente:** a casca (`Casca`, servidor) leva todo `/app/*` à tela de espera, menos a própria espera, o Campo de treino, a troca de senha, a entrada e o perfil da Vitória; `403 aguardando_liberacao` de qualquer chamada faz o mesmo, e `403 acesso_recusado` volta à entrada com o motivo.
- **Campo de treino:** com o cookie `treino=1` e um técnico, a ponte `/api/*` responde pela API fictícia ([`src/treino/api-ficticia.ts`](src/treino/api-ficticia.ts)), com as mesmas formas das respostas reais, sobre um estado em memória por pessoa ([`armazem.ts`](src/treino/armazem.ts)); o que o treino não usa responde `404 indisponivel_no_treino`. Só o estado do treinamento vai à `api` real (`PUT /me/treinamento`). Regras do treino: [docs/pessoas-e-equipes.md](../docs/pessoas-e-equipes.md), seção 2.5.

## Rotas

"Supervisor" é o papel derivado (titular ou representante no comando). Os endereços ficam em [`src/lib/rotas.ts`](src/lib/rotas.ts).

| Rota | Tela | Quem |
|---|---|---|
| `/app/entrar` · `/app/entrar/solicitar` | entrada; pedido de conta | todos; quem não tem conta |
| `/app/trocar-senha` · `/app/assinatura` | "Defina sua senha"; "Cadastre sua assinatura" | a própria conta |
| `/app/aguardando` | espera da liberação | técnico pendente |
| `/app/lista` · `/app/os/[id]` | quadro de OS e detalhe da OS (a mesma tela para todos; a `api` entrega o escopo de cada um) | todos |
| `/app/os/[id]/apr` · `…/checklist` · `…/aprovada` · `…/bloqueio` | Nova APR (escolha do modelo, participantes, riscos), checklist, assinaturas e resultado | técnico |
| `/app/os/[id]/execucao` | execução e encerramento em dois passos | participantes da APR |
| `/app/os/[id]/conferencia` | conferência da execução | participantes e supervisor |
| `/app/validacoes` | Validações: OS para assinar, treinamentos, sugestões, conferências e ausências (`?tipo=`) | supervisor |
| `/app/dashboard/meus` · `/os` · `/equipes` · `/apr` | Meus resultados; OS ("Precisa de atenção" e mapa de calor); equipes; APR. `/app/dashboard` abre Meus resultados (o admin, OS) | Meus resultados: técnico; os demais: cada um no seu escopo |
| `/app/usuarios` | Equipes e usuários (admin) ou Minha equipe (supervisor cadastra; técnico consulta) | todos |
| `/app/perfil` · `/app/perfil/[id]` · `/app/equipes/[id]` · `/app/busca` | perfil, perfil de outra pessoa, equipe (com o representante) e busca global | todos |
| `/app/configuracoes/conta` · `/app/configuracoes/sistema` | Minha conta (assinatura, e-mails, senha, anonimato); Sistema (cidade padrão, rotinas, IA). `/app/configuracoes` abre Minha conta | todos; Sistema: admin |
| `/app/catalogo/servicos` · `/materiais` · `/sugestoes` | catálogo de serviço, materiais e sugestões | todos; edição: admin |
| `/app/catalogo/servicos/[codigo]/materiais/sugerir` · `…/sugestoes/[id]` | sugerir ou contestar a lista; avaliar | enviar: técnico; avaliar: supervisor da equipe responsável e admin |
| `/app/catalogo/servicos/[codigo]/treinar` | capa e jogo do treinamento do serviço | técnico (inclusive pendente) |
| `/app/catalogo/servicos/[codigo]/treinamento/…` | criar e manter o treinamento (criar, gerar, explicacao, fases, revisao, publicar, validar, versoes, problemas) | admin; supervisor de equipe que faz o serviço |
| `/app/treinamentos/validar` | redireciona para `/app/validacoes?tipo=treinamento` | supervisor |
| `/app/treino` | Campo de treino | técnico (inclusive pendente) |
| `/app/gamificacao/minha` · `/ranking` · `/conquistas` · `/patentes` · `/pontos` | gamificação | todos; Minha pontuação: técnico; cadastros: admin |
| `/app/perfil/vitoria` | perfil da Vitória e diagnóstico da IA | todos; diagnóstico: admin |
| `/app/vitoria/sem-resposta` | perguntas que a Vitória não soube responder | admin |
| `/web/os/importacao` | importação de OS (SAP, planilha, PDF, digitalização de OS antigas) | admin |
| `/web/alertas` | alertas, reprogramação e OS de apoio | supervisor, admin |
| `/web/apr/modelos` · `/web/apr/modelos/novo` · `/web/apr/modelos/[codigo]` · `/web/apr/atividades` | modelos de APR, orientação e atividades | admin edita; supervisor lê |
| `/web/auditoria` | auditoria | admin |
| `/doc/os/[id]` | PDF da OS dentro do painel | supervisor, admin |
| `/simulador/ordens` · `/simulador/funcionarios` | SAP e registro de funcionários simulados, fora da casca; só com `SAP_SIMULADO` e `RH_SIMULADO` na `api` | admin |

Os dashboards têm o mesmo filtro na URL (`?periodo=7d|30d|90d|12m|AAAA-MM`, 30 dias se ausente, e `?equipe_id=`). Os endereços antigos (`/web/quadro`, `/web/indicadores…`, `/app/dashboard/geral`, `/app/mapa-calor` e outros) redirecionam, em [`next.config.ts`](next.config.ts).

## Estrutura

```text
src/
├── proxy.ts                  # porteiro: sessão e renovação do token
├── app/
│   ├── layout.tsx            # fontes, sprite de ícones e avisos (toast)
│   ├── api/[...caminho]/     # ponte do navegador para a api (no Campo de treino, responde pela API fictícia)
│   ├── app/                  # entrada, pedido de conta, senha, assinatura, treino e (portal): as telas de todos os perfis
│   ├── web/                  # telas só de gestão (APR, auditoria, alertas, importação)
│   ├── doc/                  # PDF da OS dentro do painel
│   └── simulador/            # telas dos sistemas simulados, fora da casca
├── components/               # por assunto: shell (casca e menu por papel), ui (peças comuns), app e web (por tela), aguardando,
│                             # ausencia, busca, clima, configuracoes, erro, perfil, representacao, simulador, treino, vitoria
├── lib/                      # api, cliente-api, rotas, tipos, sessão e as regras de cada assunto (muitas reexportam shared/api)
├── treino/                   # API fictícia do Campo de treino e o estado em memória
├── hooks/ · state/ · data/   # ganchos, estado de tela (toast, assinatura, rascunho da APR) e rótulos do painel
└── styles/                   # CSS por função, importado por globals.css na ordem da cascata
```

`src/styles` tem um arquivo por função (`variables.css` primeiro, `responsivo.css` por último para valer sobre os demais): `base`, `components`, `auth`, `os`, `apr`, `management`, `busca`, `clima`, `gamificacao`, `ausencia`, `conferencia`, `validacoes`, `sugestao-materiais`, `treino`, `treinamento-servico`, `treinamento-jogo`, `treinamento-minijogos`, `vitoria` e `simulador`.

## Sistema visual

"Prancheta técnica": fundo claro, cabeçalho escuro, uma cor de ação e cores de status sempre acompanhadas de texto. As cores estão em [`src/styles/variables.css`](src/styles/variables.css); o app repete as mesmas em [`mobile/src/tema/tema.ts`](../mobile/src/tema/tema.ts).

**Tipografia:** IBM Plex Sans (400, 500, 600, 700) no texto e IBM Plex Mono (400, 500, 600) nos códigos (nº da OS, nota, matrícula, centro de trabalho), servidas de `src/app/fontes/` (`--sans`, `--mono`). O app usa a fonte do sistema.

**Cores base:**

| Papel | Variável | Cor |
|---|---|---|
| Fundo da página | `--bg` | `#F2F2EE` |
| Superfície / secundária | `--surface` / `--surface2` | `#FFFFFF` / `#F7F7F4` |
| Coluna do quadro / chip neutro | `--col` / `--chip` | `#E8E9E3` / `#EDEEE9` |
| Linhas (padrão / interna / forte / tracejado) | `--line` / `--line2` / `--line3` / `--dash` | `#DCDDD6` / `#ECEDE8` / `#C5C7BE` / `#9AA29A` |
| Texto (principal → apagado) | `--ink` … `--ink4` | `#17212B` / `#2C3742` / `#4A5561` / `#66707A` |
| Ação principal / hover | `--brand` / `--brand-d` | `#0F5C78` / `#0B4A61` |
| Fundo, borda e texto sobre a ação | `--brand-bg` / `--brand-bd` / `--brand-ink` | `#E2EEF3` / `#B8D3DE` / `#0D3F52` |
| Cabeçalho escuro | `--dark` / `--dark2` / `--dark-txt` | `#17212B` / `#22303C` / `#C4CDD5` |
| Campo de treino (violeta) | `--tr` / `--tr-d` / `--tr-bg` (em `treino.css`) | `#5B34A6` / `#482788` / `#F0E9FC` |

**Status (fundo / texto):**

| Status | Variáveis | Fundo | Texto |
|---|---|---|---|
| Liberada | `--lib-bg` / `--lib` | `#E3EDF9` | `#1C5CAB` |
| Em execução | `--exe-bg` / `--exe` | `#FFF0D4` | `#8A4B00` |
| Bloqueada / pendente | `--blq-bg` / `--blq` (borda `--blq-bd` `#EDB3AC`) | `#FBE4E1` | `#A3241B` |
| Encerrada | `--enc-bg` / `--enc` | `#E1F2E6` | `#1E6236` |
| Alerta | `--al-bg` / `--al` (borda `--al-bd` `#E9CF6B`) | `#FFF4C7` | `#6E4C00` |
| Sem sinal | `--off-bg` / `--off` (borda `--off-bd` `#E8C873`) | `#FFF6DC` | `#4D3800` |
| Local crítico | `--crit-bg` / `--crit` (borda `--crit-bd` `#E7B394`) | `#FFF3EC` | `#A3420D` |

**Gráficos dos dashboards** ([`src/components/web/indicadores/cores.ts`](src/components/web/indicadores/cores.ts)), paleta conferida para daltonismo, sempre com legenda ou tabela:

| Uso | Cor |
|---|---|
| Estado bom (em dia, encerrada; nunca ao lado do vermelho) | `#0CA30C` |
| Aviso (atrasada com justificativa, em execução) | `#C98500` |
| Crítico (bloqueada, atrasada sem justificativa, pendente) | `#D03B3B` |
| Contexto ao lado do vermelho | `#8A949F` |
| Série única | `#0F5C78` |
| Corretiva / preventiva | `#6250D6` / `#E87BA4` |
| Tempo líquido / pausa | `#2A78D6` / `#EB6834` |
| Entrada de OS: API / arquivo / digitalização (`--o-api`, `--o-arq`, `--o-cam`) | `#2A78D6` / `#EB6834` / `#1BAF7A` |

O mapa de calor usa a escala clássica de cinco níveis, do azul ao vermelho (`#2F6FE0`, `#34B54A`, `#F7D117`, `#F68A1E`, `#D8261D`, em [`MapaDeCalor.tsx`](src/components/web/os/MapaDeCalor.tsx)).

**Formas:** raio de 8 px em botões e campos; pílula em selos; botão de 48 px (`.btn`) e 42 px no menor (`.btn-sm`). Ícones em SVG de traço, sem emoji. Status sempre com texto (e ícone quando possível) e contraste de texto de pelo menos 4,5:1.
