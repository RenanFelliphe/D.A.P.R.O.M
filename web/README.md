# web

Versão web do D.A.P.R.O.M, em **Next.js 16 (App Router) + React 19 + TypeScript**, só para desktop. Serve a todos os perfis: o técnico usa a área de campo (`/app`) e os demais perfis usam o painel de gestão (`/web`); o que cada pessoa vê depende do perfil. Os dados vêm da [`api`](../api/README.md); o `web` nunca fala com o Supabase.

## Executar

A `api` precisa estar no ar. Para desenvolver sem Supabase, use o modo local dela (banco, autenticação e arquivos em memória, SAP simulado e usuários de exemplo):

```bash
cd api && pnpm install && pnpm dev:local     # http://localhost:3333
cd web && pnpm install && pnpm dev           # http://localhost:3000, abre na tela de entrada
```

Usuários do modo local (senha `daprom123`): `tec1`, `tec2` (técnicos, Serviços Especiais), `tec3` (técnico, Instrumentação), `sup1`, `sup2` (supervisores), `ana` (analista), `seg` (Segurança do Trabalho), `adm` (admin). Os dados somem quando a `api` reinicia.

```bash
pnpm build       # build de produção
pnpm lint
```

Variáveis de ambiente (só do servidor do `web`): `API_URL` (padrão `http://localhost:3333`) e, opcionalmente, `COOKIE_SEGURO` (`true`/`false`; padrão: ligado em produção). Com Docker, ver o [`docker-compose.yml`](../docker-compose.yml) da raiz.

## Como o `web` fala com a `api`

- **Sessão:** o login (`/app/entrar`) chama `POST /auth/login` por uma ação do servidor e guarda os tokens em cookies `httpOnly` (`daprom_at`, `daprom_rt`): o JavaScript do navegador nunca vê o token. O [`proxy.ts`](src/proxy.ts) manda quem não tem sessão para a entrada e renova o token que está para vencer. Senha provisória leva a "Defina sua senha".
- **Componentes de servidor** leem dados com `api()` de [`src/lib/api.ts`](src/lib/api.ts) (junta o token do cookie). **Componentes de cliente** (formulários, cronômetro, fotos) usam [`src/lib/cliente-api.ts`](src/lib/cliente-api.ts): `chamar`, `enviarArquivo` (fotos comprimidas a ~1600 px, assinaturas) e `enviarEvento` (APR e execução, pelo único canal de escrita de campo, `POST /eventos`). Essas chamadas vão por `/api/*`, um handler ([`src/app/api/[...caminho]`](src/app/api/%5B...caminho%5D/route.ts)) que junta o token e repassa para a `api`, que autoriza.
- **Rascunho da APR:** fica no `localStorage` do navegador, por OS (com os ids das fotos já enviadas), até a APR ser concluída.
- O modo offline (fila local, sincronização) é do app `mobile`; no `web` o indicador do topo é sempre "Online".

## Rotas

| Rota | Tela | Perfis |
|---|---|---|
| `/app/entrar` · `/app/trocar-senha` | Entrada e "Defina sua senha" | todos |
| `/app/lista` · `/app/os/[id]` | OS da equipe e detalhe | técnico |
| `/app/os/[id]/apr` · `…/apr/checklist` · `…/apr/aprovada` · `…/apr/bloqueio` | Nova APR, checklist, assinaturas e resultado | técnico |
| `/app/os/[id]/execucao` · `/app/perfil` | Execução (iniciar, pausar, suspender, interromper, encerrar) e perfil com assinatura e histórico | técnico |
| `/web/os/quadro` · `/web/os/[id]` · `/doc/os/[id]` | Ordem de Serviço, aba Quadro: quadro por status; detalhe com histórico de APRs; PDF da OS | supervisor, analista, segurança, admin |
| `/web/os/importacao` | Ordem de Serviço, aba Importação: métodos de entrada (Sincronização pela API, Importação de planilha .xlsx ou PDF, Digitalização pela câmera — só admin; PDF e câmera em desenvolvimento), colunas lidas e histórico | analista, admin |
| `/web/alertas` | Alertas, reprogramação e OS de apoio | supervisor, analista (os seus), admin e segurança (leitura) |
| `/web/indicadores/geral` | Indicadores e exportação, dashboard Geral: a carteira de OS de agora, o resumo do período (OS encerradas, APRs e bloqueios, tempo, interrupções), o que precisa de atenção (com atalhos) e os resultados do período | supervisor (a própria equipe), analista, segurança, admin |
| `/web/indicadores/equipes` | Dashboard de equipes e usuários: situação das preventivas por equipe, uma linha por equipe e por técnico (execuções, tempo, APRs, bloqueios, interrupções) e, só para o admin, o estado do cadastro | supervisor (a própria equipe), analista, segurança, admin |
| `/web/indicadores/os` | Dashboard de OS: carteira de agora, programadas e encerradas no período (por tipo e por dia/semana/mês), preventivas, tempo, interrupções por risco e locais; para analista e admin, a entrada de OS (métodos, sincronização, linhas ignoradas) e a planilha de baixa no SAP | supervisor (a própria equipe), analista, segurança, admin |
| `/web/indicadores/apr` | Dashboard de APR: APRs respondidas e bloqueadas, alertas, APRs com modelo escolhido pelo técnico, APRs por dia/semana/mês, itens que mais bloqueiam, alertas mais registrados e APRs por modelo e por equipe | supervisor (a própria equipe), analista, segurança, admin |
| `/web/apr/modelos` | APR, aba Modelos: um cartão por modelo (versão em uso, rascunho, atividades e APRs), totais e modelos excluídos com "Restaurar" | segurança e admin editam; os demais leem |
| `/web/apr/modelos/novo` | Novo modelo: código, título, revisão e data do documento, em branco ou copiado de outro modelo; nasce rascunho | segurança, admin |
| `/web/apr/modelos/[codigo]` | Um modelo: versões, editor do rascunho ou versão em leitura, "Onde é usado" (atividades, OS abertas, APRs) e "Excluir modelo" | segurança e admin editam; os demais leem (o uso, só analista, segurança e admin) |
| `/web/apr/atividades` | APR, aba Atividades: a tabela atividade → modelo, que liga cada OS ao modelo, com filtro por modelo e "só sem modelo" | segurança e admin editam; os demais leem |
| `/web/usuarios` | Equipes e usuários | admin |

`/` leva ao início do perfil, `/web/os` ao quadro, `/web/apr` aos modelos e `/web/indicadores` ao dashboard geral. Os quatro dashboards têm o mesmo filtro na URL (`?periodo=7d|30d|90d|12m|AAAA-MM`, 30 dias se ausente, e `?equipe_id=`), que acompanha a troca de aba. Os endereços antigos `/web/quadro`, `/web/importacao`, `/web/modelos`, `/web/os/diagnostico`, `/web/apr/diagnostico`, `/web/indicadores/dashboard` e `/web/indicadores/diagnostico-*` redirecionam (em `next.config.ts`). Os endereços ficam em [`src/lib/rotas.ts`](src/lib/rotas.ts).

Excluir um modelo que já foi publicado o **arquiva**: ele some das listas, das APRs novas e da cópia offline, mas as versões ficam, porque APRs, PDFs e a APR offline que ainda vai chegar apontam para elas. As atividades dele passam para o modelo escolhido na exclusão ou ficam sem modelo (o técnico escolhe ao abrir a APR). Modelo que nunca foi publicado é apagado de vez.

## Estrutura

```text
src/
├── proxy.ts                  # porteiro: sessão, renovação do token
├── app/
│   ├── layout.tsx            # fontes, sprite de ícones e avisos (toast)
│   ├── api/[...caminho]/     # ponte do navegador para a api (junta o token)
│   ├── app/                  # entrada, troca de senha e área do técnico ((portal) + uma pasta por tela)
│   ├── web/                  # painel de gestão
│   └── doc/                  # PDF da OS dentro do painel
├── components/
│   ├── shell/                # Shell, MenuLateral, Barras, TecnicoShell, GestaoShell (leem o usuário e filtram o menu por perfil)
│   ├── ui/                   # peças compartilhadas: Icon, Badge, Button, Notice, Field, AssinaturaCanvas, AdicionarFoto, ImagemArquivo
│   ├── app/                  # componentes da área do técnico, por tela
│   └── web/                  # componentes do painel, por tela
├── lib/                      # api, cliente-api, rotas, tipos, formatar, sessão, regras da APR
├── state/                    # avisos (toast) e rascunho da APR
├── data/                     # tipos e rótulos usados pelas telas do painel
└── styles/                   # CSS agrupado por função (não por página), importado por globals.css
```

### Estilos

`src/styles` agrupa o CSS por função, e `globals.css` apenas importa os arquivos. A ordem dos imports é a ordem da cascata:

| Arquivo | Conteúdo |
|---|---|
| `variables.css` | variáveis de design: cores, fontes e medidas |
| `base.css` | reset, tipografia, ícones, casca (barra superior e menu lateral) e utilitários de layout |
| `components.css` | componentes reutilizáveis: botões, formulários, avisos/selos/toast, cartões e painéis, fotos e assinaturas, tabelas e PDF |
| `auth.css` | tela de entrada |
| `os.css` | lista de OS, quadro de gestão, detalhe da OS e execução |
| `apr.css` | etapas, checklist e resultado da APR |
| `management.css` | painel de gestão: alertas, importação de OS, indicadores e modelos de APR |

As páginas são componentes de servidor que leem a `api` e compõem os componentes de cada tela.

## Referência

O protótipo HTML original (`index.html`, `styles.css` e `app.js`, com a casca de apresentação em celular/navegador) foi removido depois da migração e continua no histórico do git. Especificação e regras de negócio: [`../base/.design/especificacao.md`](../base/.design/especificacao.md).
