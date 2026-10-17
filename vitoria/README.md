# Vitória

Imagens da Vitória, a assistente do sistema: o chatbot que orienta o usuário e a narradora dos treinamentos de serviço.

O desenho atual é **provisório e genérico**: uma técnica de capacete e farda com faixas refletivas, nas cores do sistema. Ele existe para o código ter o que mostrar enquanto o desenho definitivo não chega. O contexto e as direções para o desenho definitivo estão no [briefing de design](briefing-de-design.md).

## Expressões

| Arquivo | Quando aparece |
|---|---|
| `icone.svg` | botão flutuante e cabeçalho do chat (só o rosto, num círculo) |
| `padrao.svg` | conversa normal; expressão de quando nenhuma outra se aplica |
| `feliz.svg` | saudação e resposta certa no quiz |
| `explicando.svg` | passos do tutorial e explicações |
| `pensando.svg` | enquanto a resposta da IA não chega |
| `alerta.svg` | avisos de segurança e recusas ("isso eu não posso dizer") |
| `comemorando.svg` | treinamento concluído e pontos ganhos |
| `ops.svg` | resposta errada no quiz, "não sei" e IA fora do ar |

O [`expressoes.json`](expressoes.json) liga cada expressão ao arquivo. O código lê esse índice em vez de escrever os nomes dos arquivos.

## Como trocar pelo desenho definitivo

1. Substitua os arquivos mantendo os mesmos nomes.
2. Use imagens quadradas e com fundo transparente, menos o `icone`, que já vem com o fundo do círculo. Mantenha o personagem no mesmo enquadramento (do capacete aos ombros) para as expressões não "pularem" quando trocam.
3. SVG é o formato preferido. Se o novo desenho for PNG ou WebP (mínimo de 512 × 512), troque a extensão no `expressoes.json`. Nada no código precisa mudar.
4. Uma expressão nova entra como um arquivo a mais e uma linha a mais no `expressoes.json`.

Esta pasta é a origem das imagens. Quando a Vitória for implementada, a web e o app copiam daqui o que usam.
