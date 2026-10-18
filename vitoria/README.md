# Vitória

Imagens da Vitória, a assistente do sistema: o chatbot que orienta o usuário e a narradora dos treinamentos de serviço.

O desenho definitivo foi definido em 17/10/2026: uma técnica em 3D, com capacete, abafadores e crachá. O **briefing de design** que levou a ele está em [briefing-de-design.md](briefing-de-design.md) (a direção escolhida foi a "colega de campo", seção 6.1). Como a foto e as reações funcionam no sistema está em [vitoria.md](../funcionalidades/vitoria.md), seção 2.8.

## O que fica aqui e o que a web serve

| Onde | O quê | No git |
|---|---|---|
| `vitoria/NovaVitória/` | os **originais**: um PNG de 1254 px por expressão e um GIF de 800 px, 150 quadros, de 20 a 38 MB cada (cerca de 300 MB no total) | **não**: fica só na máquina de quem desenha |
| `web/public/vitoria/` | o que a web serve: `icone.webp` e as 10 `reacao-<nome>.webp` | sim (cerca de 4,3 MB) |

## Como gerar as imagens da web

Na pasta `web/`:

```
node scripts/gerar-vitoria.mjs
```

Ele lê os originais de `vitoria/NovaVitória/` (ou da pasta passada como argumento), usa o `sharp` que o Next já traz e leva cerca de 5 minutos.

- **`icone.webp`:** o `icon.png` inteiro (ela com as mãos apoiadas na borda, como se estivesse na janela), sem os cantos pretos, num círculo de 192 px. É a foto de perfil, no botão flutuante, no cabeçalho, ao lado das mensagens e nos treinamentos. Um recorte só do rosto foi tentado e descartado: perdia a pose, que é o que faz ela parecer "pendurada no ícone".
- **`reacao-<nome>.webp`:** cada GIF em 200 px, a 15 quadros por segundo (1 de cada 2), tocando uma vez, com 75 quadros e 5 s. Pesa de 380 a 490 KB.
- **`reacao-<nome>-quadro.webp`:** um quadro parado de cada animação (cerca de 8 KB). É o que a figurinha mostra antes de a animação carregar e depois de ela terminar. O quadro de cada uma é escolhido em `QUADRO_PARADO` do script (a `atencao` usa um quadro anterior à cara de brava; o `certo`, o do joinha).

Para regerar só o ícone, `--so-icone`; só o ícone e os quadros parados, `--so-quadros` (segundos, em vez dos 5 minutos das animações).

## As reações

Cada reação é uma **figurinha**: aparece abaixo da mensagem da Vitória, toca uma vez e fica no quadro parado; um toque nela toca de novo.

| Reação | Original | Quando aparece |
|---|---|---|
| `ola` | `ola.gif` | primeira vez que o painel abre; "oi", "bom dia", "tchau"; "acene" |
| `certo` | `certo.gif` | "obrigado", "valeu", "entendi"; "fique feliz"; "faça um joinha" |
| `atencao` | `atencao.gif` | recusa e aviso da Vitória (só o começo, com o dedo levantado); "fique brava" (inteira) |
| `errada` | `errada.gif` | "não sei", IA fora do ar e erro de conexão; resposta errada no quiz; "faça cara de quem errou" |
| `pensando` | `pensando.gif` | passo de treinamento marcado como "Pensando"; "fique pensativa" |
| `comemorando` | `comemorando.gif` | treinamento concluído; "comemore" |
| `triste` | `triste.gif` | só quando a pessoa pede ("fique triste") |
| `surpresa` | `surpresa.gif` | só quando a pessoa pede ("faça cara de surpresa") |
| `vergonha` | `vergonha.gif` | só quando a pessoa pede ("fique com vergonha") |
| `fofo` | `fofo.gif` | só quando a pessoa pede ("faça uma carinha fofa") |

`fofa.png` (o PNG da `fofo`), `ola.png` e os demais PNGs dos originais não são usados pela web: servem de referência da pose de cada animação.

## Para trocar ou acrescentar uma reação

1. Ponha o GIF em `vitoria/NovaVitória/` e acrescente a linha em `REACOES` de [`web/scripts/gerar-vitoria.mjs`](../web/scripts/gerar-vitoria.mjs).
2. Acrescente o nome em `REACOES` de [`shared/vitoria/reacoes.ts`](../shared/vitoria/reacoes.ts), com as palavras que a pedem em `EMOCOES` se for uma que a pessoa pode pedir.
3. Rode o script.

## Pendências do desenho

Estão no [vitoria.md](../funcionalidades/vitoria.md), seção 2.8.6: a marca da ES Gás (aprovação da empresa e símbolo desenhado errado), a jugular do capacete, o cabelo solto e o cordão do crachá no pescoço (revisão da Segurança), e a `atencao` inteira, que termina com cara de brava.
