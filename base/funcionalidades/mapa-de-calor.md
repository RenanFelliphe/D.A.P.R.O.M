# Mapa de calor das OS — implementação de 21/10/2026

> Uma aba "Mapa de Calor" na seção Ordem de Serviço mostra, sobre as ruas do OpenStreetMap, onde as OS foram executadas no período, pelo GPS da execução. O admin vê todas as equipes; o supervisor, as dele.
>
> **Situação:** implementado na `api` e na `web` em 21/10/2026, sem migração (usa o GPS que a execução já guarda). O app não tem a aba.

## 1. Decisões

| # | Pergunta | Decisão |
|---|---|---|
| 1 | De onde vem a posição | Do GPS do início da execução (`execucao.inicio_latitude`/`longitude`); sem ele, do fim. Uma OS entra uma vez, pela execução mais recente no período. |
| 2 | Privacidade | A `api` nunca devolve a posição exata: agrupa em células de 0,01° (cerca de 1 km) e devolve o centro da célula e a contagem por situação. |
| 3 | Quem vê | `exigirPerfil("supervisor", "admin")`. O supervisor fica no escopo de sempre (`equipesDoEscopo`: as equipes que supervisiona e a própria); pedir outra equipe dá `403`. |
| 4 | Filtros | Período (o mesmo dos dashboards: 7, 30 ou 90 dias, 12 meses ou um mês fechado, pelo início da execução), equipe e a situação atual da OS. |
| 5 | Fundo do mapa | As ruas do OpenStreetMap, com o Leaflet. O navegador baixa as imagens das ruas da região vista; nenhum dado da OS vai junto. A atribuição "© OpenStreetMap" fica no canto, como a licença pede. |
| 6 | Intensidade | Pelo volume da área mais movimentada: até 1/3 é baixa (amarelo), até 2/3 é média (laranja), acima é alta (vermelho). A mancha, o marcador com o número de OS e a legenda usam as mesmas cores. |
| 7 | OS sem GPS | Entram na contagem "Sem localização" e na cobertura do mapa, mas não aparecem nele. |

## 2. A `api`

- `GET /os/mapa-calor?periodo=&equipe_id=&status=` (`api/src/dominio/mapa-calor.ts`): `os_no_periodo`, `com_localizacao`, `sem_localizacao`, o intervalo `de`/`ate` e as `celulas` (`latitude`, `longitude`, `total`, `por_status`), da mais movimentada para a menos.
- O índice da célula é calculado no banco, com `floor` sobre o `numeric(9,6)`: em ponto flutuante, `-40.95 * 100` dá `-4095.0000000000005` e a OS cairia na célula vizinha (teste em `api/test/mapa-calor.test.ts`).

## 3. A tela

- `/web/os/mapa-calor` (`web/src/app/web/os/(secao)/mapa-calor/page.tsx`): o intervalo resolvido, os filtros (GET na URL), três indicadores e o mapa.
- `web/src/components/web/os/MapaDeCalor.tsx` carrega o Leaflet só no navegador. Cada área tem três anéis em metros, com um mínimo em pixels para não sumirem quando o mapa enquadra várias cidades, e um marcador com o número de OS e o resumo das situações. A roda do mouse só dá zoom depois de um clique no mapa, para não prender a rolagem da página.
- Ao lado, "Áreas com mais OS" lista as cinco maiores; tocar numa leva o mapa até ela (sem animação com "reduzir movimento").
- A Vitória conhece a tela pela chave `mapa_calor` (aba `menu-mapa-calor`), nos dois manuais.

## 4. Dados da demonstração

- O seed antigo punha toda execução no mesmo ponto, e o mapa mostrava uma mancha só. Agora cada execução fica perto do local de instalação da OS, com um desvio de até 1,2 km que depende só do número da OS (`api/src/db/seed/posicoes-demo.ts`).
- O modo local (`pnpm dev:local`) não tem nenhuma execução, então o mapa fica vazio até alguém executar uma OS. Para ver o mapa com dados sem Supabase: `pnpm dev:local:demo`, que sobe com a demonstração inteira (17 OS em 14 áreas no período de 30 dias, conferido em 21/10/2026).
- Para o banco que já tem a demonstração: `pnpm demo:espalhar-gps` (na `api`) reposiciona o GPS das execuções, pausas e fotos das OS 5100xxx no mesmo ponto que o seed escolhe. Só mexe em posições que já existem e pode rodar de novo sem mudar nada.
