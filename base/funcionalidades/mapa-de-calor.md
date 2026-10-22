# Mapa de calor das OS — implementação de 21/10/2026

> Uma aba "Mapa de Calor" na seção Ordem de Serviço mostra, sobre as ruas do OpenStreetMap, onde as OS foram executadas no período, pelo GPS da execução. Todo mundo vê, cada um no próprio escopo: o técnico, a própria equipe; o supervisor, as que supervisiona; o admin, todas.
>
> **Situação:** implementado na `api` e na `web` em 21/10/2026, sem migração (usa o GPS que a execução já guarda). Aberta a todos os perfis no mesmo dia (antes, só admin e supervisor). O app não tem a aba.

## 1. Decisões

| # | Pergunta | Decisão |
|---|---|---|
| 1 | De onde vem a posição | Do GPS do início da execução (`execucao.inicio_latitude`/`longitude`); sem ele, do fim. Uma OS entra uma vez, pela execução mais recente no período. |
| 2 | Privacidade | A `api` nunca devolve a posição exata: agrupa em células de 0,01° (cerca de 1 km) e devolve o centro da célula e a contagem por situação. |
| 3 | Quem vê | Todo perfil autenticado; o escopo de sempre (`equipesDoEscopo`/`condicaoEscopo`) decide o que aparece: técnico, a própria equipe; supervisor, as que supervisiona e a própria; admin, todas. Pedir uma equipe fora do escopo dá `403`; técnico sem equipe vê o mapa vazio. |
| 4 | Filtros | Período (o mesmo dos dashboards: 7, 30 ou 90 dias, 12 meses ou um mês fechado, pelo início da execução), equipe e a situação atual da OS. |
| 5 | Fundo do mapa | As ruas do OpenStreetMap, com o Leaflet. O navegador baixa as imagens das ruas da região vista; nenhum dado da OS vai junto. A atribuição "© OpenStreetMap" fica no canto, como a licença pede. |
| 6 | Intensidade | Pelo volume da área mais movimentada, em cinco níveis de um quinto cada: muito baixa, baixa, média, alta e muito alta. Cores clássicas de mapa de calor, pedidas em 21/10/2026 (antes, três níveis de dourado a terracota): azul `#2F6FE0`, verde `#34B54A`, amarelo `#F7D117`, laranja `#F68A1E` e vermelho `#D8261D`. A radiação mistura as cinco num gradiente; os pontos, a legenda e as barras da lista lateral usam uma por nível. |
| 7 | OS sem GPS | Entram na contagem "Sem localização" e na cobertura do mapa, mas não aparecem nele. |
| 8 | Camadas e aparência | Duas caixas no cabeçalho do mapa, **Radiação** e **Pontos**, independentes e ligadas por padrão (uma, as duas ou nenhuma; antes era um interruptor "radiação ou só pontos"). Radiação: cada área emite um brilho que se funde com o das vizinhas (o mapa de calor "de verdade"). Pontos: um ponto sólido colorido no centro de cada área. Um interruptor **Preto e branco / Colorido** (preto e branco por padrão) tira a cor só do mapa-base, para a radiação e os pontos se destacarem. Enquanto o mapa se move (zoom, arrastar ou movimento automático) a radiação e os pontos esmaecem em 0,3 s e voltam ao parar, para o borrão não parecer andar junto; o clique e a dica das áreas continuam funcionando. |
| 9 | Tamanho da mancha | Em pixels de tela (`RAIO_DA_RADIACAO`/`DESFOQUE_DA_RADIACAO` em `MapaDeCalor.tsx`), não em metros reais: cresce e encolhe junto com o zoom do mapa, como em qualquer mapa de calor. Aumentado em 21/10/2026, a pedido do usuário, para as áreas próximas se misturarem mais. Depois disso o usuário achou o resultado parecido com um "borrão", não uma radiação: o núcleo sólido (`RAIO_DA_RADIACAO`) era grande demais perto do desfoque, o que cria um disco de bordas suaves em vez de um brilho que se dissipa, e o gradiente de cor (`PONTOS_DO_GRADIENTE`) saturava cedo demais. Corrigido no mesmo dia: núcleo bem menor que o desfoque, gradiente com mais degraus (halo quase invisível até o núcleo), e o tamanho do brilho (`ESCALA_MINIMA_DA_RADIACAO`) também cresce com o volume da área, não só a opacidade — uma OS isolada fica com um brilho pequeno e fraco, uma área cheia com um brilho grande e forte. Depois o usuário achou o brilho de áreas isoladas fraco demais: o pico do carimbo era de ~15% (núcleo 14, desfoque 50); agora o núcleo é 30 e o desfoque 40 (pico ~65%), e a camada mede o pico e desenha o carimbo em quantas camadas forem precisas para o centro da área chegar à intensidade do nível dela (de `OPACIDADE_MINIMA_DA_RADIACAO`, uma OS isolada, a 0,95), com um realce (`REALCE_DA_OPACIDADE`) na hora de pintar. |

## 2. A `api`

- `GET /os/mapa-calor?periodo=&equipe_id=&status=` (`api/src/dominio/mapa-calor.ts`): `os_no_periodo`, `com_localizacao`, `sem_localizacao`, o intervalo `de`/`ate` e as `celulas` (`latitude`, `longitude`, `total`, `por_status`), da mais movimentada para a menos.
- O índice da célula é calculado no banco, com `floor` sobre o `numeric(9,6)`: em ponto flutuante, `-40.95 * 100` dá `-4095.0000000000005` e a OS cairia na célula vizinha (teste em `api/test/mapa-calor.test.ts`).

## 3. A tela

- `/app/mapa-calor` (`web/src/app/app/(portal)/mapa-calor/page.tsx`), aberta a todos os perfis: o intervalo resolvido, os filtros (GET na URL), três indicadores e o mapa. Não fica em `/web` (a área de gestão, fechada para o técnico comum) porque todo mundo entra nela.
- `web/src/components/web/os/MapaDeCalor.tsx` carrega o Leaflet só no navegador. A radiação é uma camada própria (`criarCamadaDeRadiacao`, via `L.Layer.extend`, a mesma API que plugins como o `leaflet.heat` usam por baixo): cada ponto desenha um carimbo borrado (a sombra de um círculo invisível) com a opacidade do seu peso; onde as manchas se sobrepõem, a opacidade se acumula, e uma segunda passada troca a opacidade acumulada de cada pixel pela cor equivalente do gradiente. A primeira versão usava a biblioteca `leaflet.heat`, que conta com um `L` global (não importa o Leaflet): funcionava só depois do `next build`, nunca no ambiente de teste do usuário — por isso foi trocada por código nosso, sem essa dependência. Cada área também tem um marcador invisível (`calor-os-alvo`), por cima da radiação ou do ponto sólido, só para o clique, o toque e o teclado — com o resumo das situações na dica. A roda do mouse só dá zoom depois de um clique no mapa, para não prender a rolagem da página.
- Ao lado, "Áreas com mais OS" lista as cinco maiores; tocar numa leva o mapa até ela (sem animação com "reduzir movimento").
- A Vitória conhece a tela pela chave `mapa_calor` (aba `menu-mapa-calor`), nos dois manuais.

## 4. Dados da demonstração

- O seed antigo punha toda execução no mesmo ponto, e o mapa mostrava uma mancha só. Agora cada execução fica perto do local de instalação da OS, com um desvio de até 1,2 km que depende só do número da OS (`api/src/db/seed/posicoes-demo.ts`).
- O modo local (`pnpm dev:local`) não tem nenhuma execução, então o mapa fica vazio até alguém executar uma OS. Para ver o mapa com dados sem Supabase: `pnpm dev:local:demo`, que sobe com a demonstração inteira (17 OS em 14 áreas no período de 30 dias, conferido em 21/10/2026).
- Para o banco que já tem a demonstração: `pnpm demo:espalhar-gps` (na `api`) reposiciona o GPS das execuções, pausas e fotos das OS 5100xxx no mesmo ponto que o seed escolhe. Só mexe em posições que já existem e pode rodar de novo sem mudar nada. Rodado no banco de dev (Supabase) em 21/10/2026: 17 execuções, 7 pausas e 21 fotos reposicionadas.
- `pnpm demo:mais-os-mapa-calor` (na `api`, `scripts/mais-os-mapa-calor.ts`): insere ~47 OS fictícias extras (prefixo `5200xxx`), já encerradas e com GPS, em 11 áreas (as 7 da Grande Vitória da demonstração, mais 4 cidades novas do interior do ES), com quantidades diferentes por área para a intensidade variar de verdade. É inserção direta no banco (sem passar pela APR nem pela execução de verdade): sem evento, sem alerta, sem pontuação, sem tarefa de PDF. Idempotente (não insere de novo se já existir uma OS `5200xxx`). Essas OS também aparecem na Exportação para o SAP e nos dashboards, como as 5100xxx da demonstração — não têm número de nota nem PDF, e um "baixa no SAP" sobre elas não teria efeito real. Rodado no banco de dev em 21/10/2026, junto com o `demo:espalhar-gps` acima: o mapa foi de 2 para 37 áreas (período de 90 dias, visão do admin).

## 5. Conferência pendente

- A radiação ainda não foi vista num navegador de verdade (validado só por `tsc`, ESLint e pelo `next build`). Agora ela usa só a API pública do Leaflet (`L.Layer.extend`, `L.DomUtil`, `ctx.drawImage`/`getImageData`), a mesma de tudo o mais que já funciona nos dois ambientes — mas abrir a tela e testar o interruptor nos dois estados continua sendo o primeiro passo antes de dar a funcionalidade por pronta.
