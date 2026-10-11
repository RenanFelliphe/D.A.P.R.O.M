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
| `/web/quadro` · `/web/os/[id]` · `/doc/os/[id]` | Quadro por status, detalhe com histórico de APRs, PDF da OS | supervisor, analista, segurança, admin |
| `/web/alertas` | Alertas, reprogramação e OS de apoio | supervisor, analista (os seus), admin e segurança (leitura) |
| `/web/importacao` | Leitura do SAP, planilha, OS manual | analista, admin |
| `/web/indicadores` | Indicadores e exportação para o SAP | supervisor, analista, segurança, admin |
| `/web/modelos` | Modelos de APR (editor) e tabela de atividades | segurança edita; os demais leem |
| `/web/usuarios` | Equipes e usuários | admin |

`/` leva ao início do perfil. Os endereços ficam em [`src/lib/rotas.ts`](src/lib/rotas.ts).

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
| `management.css` | painel de gestão: alertas, importação SAP, indicadores e modelos de APR |

As páginas são componentes de servidor que leem a `api` e compõem os componentes de cada tela.

## Referência

O protótipo HTML original (`index.html`, `styles.css` e `app.js`, com a casca de apresentação em celular/navegador) foi removido depois da migração e continua no histórico do git. Especificação e regras de negócio: [`../base/.design/especificacao.md`](../base/.design/especificacao.md).
