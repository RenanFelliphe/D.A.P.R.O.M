# web

Versão web do D.A.P.R.O.M, em **Next.js 16 (App Router) + React 19 + TypeScript**, só para desktop.

O sistema tem duas áreas, cada uma com barra superior e menu lateral próprios, mais o PDF gerado. Os dados ainda são fictícios; o estado (checklist, sincronização, alertas, exportação) é simulado no navegador.

## Executar

```bash
npm install
npm run dev      # http://localhost:3000 (abre em /app/entrar)
npm run build    # build de produção
npm run lint
```

## Fases da migração

| Fase | Escopo | Situação |
|---|---|---|
| 1 · Interface | HTML → TSX, componentização, uma rota por tela. Sem lógica e sem mexer no CSS. | ✅ concluída |
| 2 · Funcionalidades | `app.js` → TypeScript dentro dos componentes (estado, checklist, assinaturas, sincronização simulada, alertas, exportação). | ✅ concluída |
| 3 · Estilização | Correção de bugs de estilo, remoção da interface mobile e adaptação ao desktop das telas que só existiam como celular. | ✅ concluída |

### O que a Fase 3 mudou

- **Interface mobile removida:** saíram a moldura de celular, a moldura de navegador, a escala por `ResizeObserver` (`Device`) e a casca do apresentador (barra, roteiro lateral, atalhos ← → M F). A página agora rola normalmente.
- **Telas do app adaptadas ao desktop:** as 10 telas do técnico ganharam topbar + menu lateral e páginas em duas colunas. O cabeçalho escuro, o rodapé fixo com a ação principal e a barra de abas inferior viraram trilha de navegação, título da página e um painel de ações na lateral. A entrada (login) virou tela dividida.
- **Painel de gestão e PDF** passaram a usar a mesma casca, sem a moldura de navegador. O PDF continua em folha A4, agora dentro do painel.
- **Atalho entre áreas:** cada menu lateral tem um link para a outra área ("Painel de gestão" / "Área do técnico"), no lugar do roteiro do apresentador.
- **Bugs de estilo corrigidos:**
  - botão desabilitado com `.is-off` bloqueava o clique e o aviso "Confirme as assinaturas…" nunca aparecia;
  - cabeçalho de linha das tabelas (`.tb tbody th`) herdava fonte e cor de cabeçalho de coluna;
  - medidas de execução no detalhe da OS (Início, Fim, Tempo…) quebravam em duas linhas e desalinhavam;
  - código do modelo ("APR 03") quebrava em duas linhas em "Tipo de atividade → modelo".
- **CSS reorganizado** em seções (tokens, base, casca, utilitários, componentes, técnico, gestão, PDF) e sem as regras que só existiam para o celular e o apresentador.

## Rotas

| Rota | Tela |
|---|---|
| `/app/entrar` | Entrada (login), sem menu lateral |
| `/app/lista` · `detalhe` · `nova-apr` · `checklist` · `bloqueio` · `aprovada` · `execucao` · `sync` · `perfil` | Área do técnico |
| `/web/quadro` · `detalhe` · `alertas` · `importacao` · `indicadores` · `modelos` · `usuarios` | Painel de gestão |
| `/doc/pdf` | PDF de duas páginas (APR + OS), dentro do painel de gestão |

`/` redireciona para `/app/entrar`. O registro de telas, o item de menu ativo em cada uma e o usuário exibido na barra superior ficam em [`src/lib/telas.ts`](src/lib/telas.ts).

## Estrutura

```text
src/
├── app/
│   ├── layout.tsx            # fontes, sprite de ícones e providers de estado
│   ├── globals.css           # tokens e estilos, organizados por seção
│   ├── app/
│   │   ├── entrar/           # login (fora da casca)
│   │   └── (portal)/         # layout com a casca do técnico + uma pasta por tela
│   ├── web/                  # layout com a casca de gestão + uma pasta por tela
│   └── doc/                  # layout com a casca de gestão + pdf/
├── components/
│   ├── shell/                # Shell, MenuLateral, Barras (topbar), TecnicoShell, GestaoShell
│   ├── ui/                   # peças compartilhadas: Icon, Badge, Button, Notice, Field, Assinatura, Screen
│   ├── app/                  # AppChrome (trilha, cabeçalho de página, colunas, painel de ações) + componentes por tela
│   ├── web/                  # Panel/Kpi + componentes por tela
│   └── pdf/                  # páginas e blocos do PDF
├── data/                     # dados fictícios tipados usados pelas telas
├── lib/                      # registro de telas e utilitários
└── state/                    # estado compartilhado (checklist, sincronização, alertas, exportação, aviso)
```

Cada `page.tsx` é fina: define o título e compõe componentes. Dados repetitivos (linhas de tabela, cartões, perguntas) ficam em `src/data` e são renderizados com `.map`.

## Referência

O protótipo HTML original (`index.html`, `styles.css` e `app.js`, com a casca de apresentação em celular/navegador) foi removido depois da migração e continua no histórico do git. Especificação e regras de negócio: [`../base/.design/especificacao.md`](../base/.design/especificacao.md).
